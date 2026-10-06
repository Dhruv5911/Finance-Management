"""
FinanceAgent — the decision-making layer of FinAI.

Given a user message, the agent:
  1. Classifies intent accurately (savings rate, recent transactions, category spending,
     income/expenses/balance, largest expense, monthly summary, financial health,
     budget suggestion, sample data, knowledge/concepts, greetings)
  2. Runs the exact deterministic tools for that question
  3. Formulates a tailored, well-structured response (using Gemini when available,
     or our deterministic response engine if rate-limited/offline)
"""
import re
import json
from typing import Dict, List, Optional, Tuple

import pandas as pd

from tools import transaction_tools as txn
from tools import budget_tools as budget
from tools import goal_tools as goal
from tools import insight_tools as insight
from rag.rag_engine import RAGEngine


# ---------------------------------------------------------------------------
# Intent Patterns
# ---------------------------------------------------------------------------

GREETING_PATTERNS = [
    r"^\s*hi\b", r"^\s*hello\b", r"^\s*hey\b", r"^\s*howdy\b",
    r"^\s*good (morning|afternoon|evening|day)\b",
    r"^\s*what can you do\b", r"^\s*help\b", r"^\s*what are you\b",
    r"^\s*who are you\b", r"^\s*start\b", r"^\s*namaste\b",
]

SAMPLE_DATA_PATTERNS = [
    r"\bsample data\b", r"\bsample csv\b", r"\bcsv format\b", r"\btemplate\b",
    r"\bcsv template\b", r"\bdata format\b", r"\bexample data\b",
    r"\bhow to format\b", r"\bcolumns\b", r"\bgive me sample\b",
]

SAVINGS_RATE_PATTERNS = [
    r"\bsavings? rate\b", r"\bsaving rate\b", r"\bhow much.*saving\b",
    r"\bwhat percentage.*save\b", r"\bmy savings percentage\b", r"\brate of saving\b",
]

RECENT_TXN_PATTERNS = [
    r"\brecent transactions?\b", r"\blatest transactions?\b", r"\blast transactions?\b",
    r"\bshow (?:me )?(?:my )?transactions?\b", r"\blist (?:my )?transactions?\b",
    r"\bmy transactions?\b", r"\btransaction history\b", r"\bwhat did i buy\b",
    r"\ball transactions?\b",
]

CATEGORY_SPENDING_PATTERNS = [
    r"\bexpense[s]? per category\b", r"\bcategory spending\b", r"\bspending by category\b",
    r"\bwhere am i spending\b", r"\bcategory breakdown\b", r"\bspending categories\b",
    r"\bexpense[s]? by category\b", r"\bwhich category\b", r"\bbreakdown of expense\b",
]

LARGEST_EXPENSE_PATTERNS = [
    r"\blargest expense[s]?\b", r"\bbiggest expense[s]?\b", r"\bhighest expense[s]?\b",
    r"\btop expense[s]?\b", r"\bmost expensive\b", r"\bwhere did most.*go\b",
]

MONTHLY_SUMMARY_PATTERNS = [
    r"\bmonthly summary\b", r"\bmonth by month\b", r"\bmonthly trend\b",
    r"\bcompare months?\b", r"\bmonthly spending\b", r"\bmonthly income\b",
]

HEALTH_INSIGHT_PATTERNS = [
    r"\bfinancial health\b", r"\bhealth score\b", r"\bhow am i doing\b",
    r"\bspending insights?\b", r"\bfinancial status\b", r"\bfinancial situation\b",
    r"\bfinancial report\b", r"\boverall spending\b",
]

BUDGET_SUGGESTION_PATTERNS = [
    r"\bsuggest(?:ed)? (?:a |me a |my )?budget\b", r"\bbudget suggestion\b", r"\brecommend(?:ed)? (?:a )?budget\b",
    r"\bauto budget\b", r"\b50/?30/?20\b", r"\bhow should i budget\b", r"\bcreate (?:a )?budget\b",
    r"\bplan (?:my )?budget\b",
]

GOAL_PATTERNS = [
    r"\bsave\s*₹?\s*[\d,]+", r"\bsaving goal\b", r"\bhow much.*save\b",
    r"\bhow long.*save\b", r"\breach\s*₹?\s*[\d,]+", r"\bgoal\b",
    r"\bsavings target\b", r"\btarget amount\b", r"\bmonthly saving\b",
]

OUT_OF_DOMAIN_HINTS = [
    "president", "prime minister", "weather", "capital of", "movie",
    "recipe", "sports", "football", "cricket score", "song", "joke",
    "actor", "actress", "celebrity", "politics", "election",
]


def classify_intent(message: str) -> Dict[str, bool]:
    text = message.lower().strip()

    is_greeting = any(re.search(p, text) for p in GREETING_PATTERNS)
    is_sample_data = any(re.search(p, text) for p in SAMPLE_DATA_PATTERNS)
    is_savings_rate = any(re.search(p, text) for p in SAVINGS_RATE_PATTERNS)
    is_recent_txns = (
        "recent" in text or "last transaction" in text or "latest transaction" in text
        or any(re.search(p, text) for p in RECENT_TXN_PATTERNS)
    )
    is_category_spending = any(re.search(p, text) for p in CATEGORY_SPENDING_PATTERNS)
    is_largest_expense = any(re.search(p, text) for p in LARGEST_EXPENSE_PATTERNS)
    is_monthly_summary = any(re.search(p, text) for p in MONTHLY_SUMMARY_PATTERNS)
    is_health_insight = any(re.search(p, text) for p in HEALTH_INSIGHT_PATTERNS)
    is_budget_suggestion = any(re.search(p, text) for p in BUDGET_SUGGESTION_PATTERNS)
    is_goal = any(re.search(p, text) for p in GOAL_PATTERNS) and not is_savings_rate

    # General keywords
    is_income_query = any(w in text for w in ["total income", "my income", "how much did i earn", "earnings", "salary received"])
    is_expense_query = any(w in text for w in ["total expense", "total expenses", "how much did i spend", "my expenses", "total spent"])
    is_balance_query = any(w in text for w in ["balance", "current balance", "net balance", "how much is left", "net cash flow", "remaining money"])

    is_transaction = (
        is_savings_rate or is_recent_txns or is_category_spending or is_largest_expense or
        is_monthly_summary or is_health_insight or is_budget_suggestion or is_goal or
        is_income_query or is_expense_query or is_balance_query or
        any(w in text for w in ["spend", "spent", "earned", "transaction", "month", "search", "food", "rent", "shopping", "groceries"])
    )

    is_knowledge = not is_transaction and not is_sample_data and not is_greeting

    is_out_of_domain = (
        any(kw in text for kw in OUT_OF_DOMAIN_HINTS)
        and not is_transaction
        and not is_greeting
        and not is_sample_data
    )

    return {
        "greeting": is_greeting,
        "sample_data": is_sample_data,
        "savings_rate": is_savings_rate,
        "recent_txns": is_recent_txns,
        "category_spending": is_category_spending,
        "largest_expense": is_largest_expense,
        "monthly_summary": is_monthly_summary,
        "health_insight": is_health_insight,
        "budget_suggestion": is_budget_suggestion,
        "goal": is_goal,
        "income_query": is_income_query,
        "expense_query": is_expense_query,
        "balance_query": is_balance_query,
        "transaction": is_transaction,
        "knowledge": is_knowledge,
        "out_of_domain": is_out_of_domain,
    }


def extract_amount_and_timeline(message: str) -> Tuple[Optional[float], float]:
    """Extract target amount (₹) and timeline (months)."""
    amount = None
    amt_match = re.search(r"₹?\s*([\d,]+(?:\.\d+)?)\s*(?:rs|rupees|inr|lakh|k)?", message, re.IGNORECASE)
    if amt_match:
        try:
            raw = amt_match.group(1).replace(",", "")
            amount = float(raw)
            if "lakh" in message.lower():
                amount *= 100000
            elif re.search(r"\bk\b", message.lower()):
                amount *= 1000
        except ValueError:
            amount = None

    months = 1.0
    month_match = re.search(r"(\d+(?:\.\d+)?)\s*month", message, re.IGNORECASE)
    year_match = re.search(r"(\d+(?:\.\d+)?)\s*year", message, re.IGNORECASE)
    if month_match:
        months = float(month_match.group(1))
    elif year_match:
        months = float(year_match.group(1)) * 12

    return amount, months


def extract_category(message: str, known_categories: List[str]) -> Optional[str]:
    text = message.lower()
    for cat in known_categories:
        # Word-boundary match — a plain substring check would let "Rent"
        # match inside unrelated words like "cuRRENt" (e.g. "current balance").
        if re.search(r"\b" + re.escape(cat.lower()) + r"\b", text):
            return cat
    return None


def extract_search_keyword(message: str) -> Optional[str]:
    for pattern in [
        r"search (?:for |transactions? (?:for |with |about )?)?['\"]?([a-z0-9 ]+)['\"]?",
        r"find (?:transactions? (?:for |with |about )?)?['\"]?([a-z0-9 ]+)['\"]?",
        r"transactions? (?:for |with |about |related to )['\"]?([a-z0-9 ]+)['\"]?",
    ]:
        m = re.search(pattern, message.lower())
        if m:
            kw = m.group(1).strip()
            if len(kw) > 1:
                return kw
    return None


# ---------------------------------------------------------------------------
# Compound-question splitting
# ---------------------------------------------------------------------------
# A single chat message can contain more than one question ("what is my
# income how do I save 500"). classify_intent() only ever detects one
# primary intent, so without splitting, only the first (or a merged/generic)
# answer would come back. We conservatively split a message into 2 parts
# only when we can find a clean boundary, and only when both halves look
# like real questions/requests (>=3 words) — otherwise we leave the message
# untouched so normal single questions are never affected.

_CONJUNCTION_SPLIT_RE = re.compile(r"\s+(?:and also|and|also|plus|&)\s+", re.IGNORECASE)


def split_into_subquestions(message: str) -> List[str]:
    """Best-effort split of a message into independent sub-questions.
    Returns [message] unchanged unless a confident 2-part split is found.

    Only splits on EXPLICIT separators the user typed (multiple "?" marks,
    or "and"/"also"/"plus"/"&"). We deliberately do NOT try to guess a
    split from a second WH-word (what/how/why...) with no punctuation —
    that produced false positives on single connected questions like
    "what is coding, how does it relate to finance", chopping them into
    two unrelated fragments that each got a weak, half-relevant answer.
    """
    text = message.strip()
    if not text:
        return [text]

    # 1) Explicit question marks — each "?"-terminated chunk is its own question.
    if text.count("?") >= 2:
        parts = [p.strip(" .!") for p in text.split("?")]
        parts = [p for p in parts if len(p.split()) >= 3]
        if len(parts) >= 2:
            return parts

    # 2) Conjunctions ("and", "also", "&", "plus").
    parts = [p.strip(" ?.!") for p in _CONJUNCTION_SPLIT_RE.split(text)]
    parts = [p for p in parts if p]
    if len(parts) == 2 and all(len(p.split()) >= 3 for p in parts):
        return parts

    return [text]


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Restricted content — refused locally, before classification, RAG, or the
# AI model ever see the message. This is intentionally a hard keyword gate
# (not left to the LLM's judgment) so it can't be talked around by rephrasing.
# ---------------------------------------------------------------------------

_RESTRICTED_PATTERNS = re.compile(
    r"\b("
    r"bombs?|explosives?|detonat\w*|"
    r"terroris\w*|hijack\w*|assassinat\w*|kidnap\w*|"
    r"(?:build|make|building|making|creat\w*)\s+(?:a\s+)?(?:gun|firearm|weapon)s?|"
    r"poison\w*\s+(?:someone|a\s+person|food|drink)|nerve\s+agents?|"
    r"chemical\s+weapons?|biological\s+weapons?|"
    r"hack\w*\s+(?:into|someone|a\s+(?:website|account|system))|malware|ransomware|"
    r"rob(?:bery|bing|bed)?\s+(?:a\s+)?(?:bank|store|house|someone)|"
    r"steal\w*\s+(?:someone'?s?|money|(?:an?\s+)?identity|a\s+car)|thefts?|"
    r"murder\w*|kill\w*\s+(?:someone|a\s+person)|"
    r"human\s+traffick\w*|child\s+abuse"
    r")\b",
    re.IGNORECASE,
)

_RESTRICTED_REFUSAL = (
    "🚫 I can't help with that. FinAI is a personal finance assistant, and I don't provide "
    "information related to weapons, explosives, violence, terrorism, hacking, theft, or other "
    "unsafe or illegal activity — no matter how the question is phrased.\n\n"
    "I'm happy to help with anything about your income, expenses, budgeting, savings goals, "
    "loans, or investments instead."
)


def is_restricted_request(message: str) -> bool:
    return bool(_RESTRICTED_PATTERNS.search(message))


class FinanceAgent:
    def __init__(self, rag_engine: RAGEngine, gemini_client, gemini_model: str):
        self.rag = rag_engine
        self.gemini_client = gemini_client
        self.gemini_model = gemini_model

    def handle_message(self, message: str, df: pd.DataFrame, conversation_history: List[Dict],
                        budgets: Optional[Dict[str, float]] = None) -> Dict:
        # Hard safety gate — checked first, before splitting, classification,
        # RAG, or the AI model ever see the message.
        if is_restricted_request(message):
            return {
                "answer": _RESTRICTED_REFUSAL,
                "sources": [], "tools_used": [], "data_used": False, "rag_used": False,
            }

        sub_questions = split_into_subquestions(message)

        if len(sub_questions) <= 1:
            return self._handle_single_message(message, df, conversation_history, budgets)

        # Compound message — answer each part and merge the results so the
        # user gets a relevant answer for every question they asked, not
        # just the first one.
        merged_answer_parts: List[str] = []
        merged_sources: List[str] = []
        merged_tools: List[str] = []
        any_data_used = False
        any_rag_used = False

        for sub_q in sub_questions:
            result = self._handle_single_message(sub_q, df, conversation_history, budgets)
            merged_answer_parts.append(result["answer"])
            for s in result.get("sources", []):
                if s not in merged_sources:
                    merged_sources.append(s)
            for t in result.get("tools_used", []):
                if t not in merged_tools:
                    merged_tools.append(t)
            any_data_used = any_data_used or result.get("data_used", False)
            any_rag_used = any_rag_used or result.get("rag_used", False)

        return {
            "answer": "\n\n---\n\n".join(merged_answer_parts),
            "sources": merged_sources,
            "tools_used": merged_tools,
            "data_used": any_data_used,
            "rag_used": any_rag_used,
        }

    def _handle_single_message(self, message: str, df: pd.DataFrame, conversation_history: List[Dict],
                        budgets: Optional[Dict[str, float]] = None) -> Dict:
        intent = classify_intent(message)

        tools_used: List[str] = []
        rag_results: List[Dict] = []
        facts: Dict = {}

        data_available = df is not None and not df.empty
        known_categories = sorted(df["category"].unique().tolist()) if data_available else []

        # ---- 1. Sample Data Request ----
        if intent["sample_data"]:
            return {
                "answer": (
                    "### 📄 Sample CSV Format for FinAI\n\n"
                    "You can upload your own financial transactions CSV. It must contain these **5 columns**:\n\n"
                    "| Column | Type | Description | Example |\n"
                    "|---|---|---|---|\n"
                    "| `date` | YYYY-MM-DD | Transaction date | `2026-01-15` |\n"
                    "| `description` | Text | Merchant / Details | `DMart Groceries` |\n"
                    "| `category` | Text | Category name | `Groceries`, `Rent`, `Food` |\n"
                    "| `type` | Text | `income` or `expense` | `expense` |\n"
                    "| `amount` | Number | Numeric amount in ₹ | `2500` |\n\n"
                    "#### 📋 Copyable Sample CSV Content:\n"
                    "```csv\n"
                    "date,description,category,type,amount\n"
                    "2026-01-01,Monthly Salary,Salary,income,50000\n"
                    "2026-01-03,House Rent,Rent,expense,12000\n"
                    "2026-01-05,DMart Groceries,Groceries,expense,2163\n"
                    "2026-01-06,Internet Bill,Utilities,expense,799\n"
                    "2026-01-09,Pizza Order,Food,expense,854\n"
                    "```\n\n"
                    "💡 **Download**: Click the **'Sample CSV'** button in the top bar to download the full ready-to-use CSV template!"
                ),
                "sources": [],
                "tools_used": [],
                "data_used": False,
                "rag_used": False,
            }

        # ---- 2. Greeting ----
        if intent["greeting"] and not intent["transaction"] and not intent["knowledge"]:
            return {
                "answer": (
                    "Hi! I'm **FinAI**, your personal finance assistant 👋\n\n"
                    "Here's what I can do for you:\n"
                    "- 📊 **Savings Rate** — Ask *'What is my savings rate?'*\n"
                    "- 📋 **Recent Transactions** — Ask *'Show my recent transactions'*\n"
                    "- 🥧 **Category Expenses** — Ask *'Show expense per category'*\n"
                    "- 💡 **Financial Health** — Ask *'How is my financial health?'*\n"
                    "- 🎯 **Savings Goals** — Ask *'I want to save ₹50,000 in 6 months'*\n"
                    "- 📚 **Finance Concepts** — Ask about UPI, SIP, FD, ELSS, NPS, credit scores & loans\n\n"
                    "What would you like to check today?"
                ),
                "sources": [],
                "tools_used": [],
                "data_used": False,
                "rag_used": False,
            }

        # ---- 3. Out-of-Domain ----
        if intent["out_of_domain"]:
            return {
                "answer": (
                    "I'm FinAI, a personal finance assistant — I focus on your income, expenses, "
                    "budgeting, savings goals, and financial education. I'm not able to help "
                    "with that topic, but feel free to ask me anything about your finances or transactions!"
                ),
                "sources": [],
                "tools_used": [],
                "data_used": False,
                "rag_used": False,
            }

        # ---- 4. Data Extraction & Tools ----
        if data_available:
            # Savings rate
            if intent["savings_rate"]:
                facts["savings_rate"] = txn.get_savings_rate(df)
                facts["total_income"] = txn.get_total_income(df)
                facts["total_expenses"] = txn.get_total_expenses(df)
                facts["balance"] = txn.get_balance(df)
                tools_used += ["get_savings_rate", "get_total_income", "get_total_expenses", "get_balance"]

            # Recent transactions
            elif intent["recent_txns"]:
                facts["recent_transactions"] = txn.get_recent_transactions(df, 10)
                facts["total_transactions"] = txn.get_transaction_count(df)
                tools_used.append("get_recent_transactions")

            # Category spending
            elif intent["category_spending"]:
                facts["category_spending"] = txn.get_category_spending(df)
                facts["total_expenses"] = txn.get_total_expenses(df)
                tools_used += ["get_category_spending", "get_total_expenses"]

            # Largest expenses
            elif intent["largest_expense"]:
                facts["largest_expenses"] = txn.get_largest_expenses(df, 5)
                tools_used.append("get_largest_expenses")

            # Monthly summary / trend
            elif intent["monthly_summary"]:
                facts["monthly_summary"] = txn.get_monthly_summary(df)
                facts["spending_trend"] = txn.get_spending_trend(df)
                tools_used += ["get_monthly_summary", "get_spending_trend"]

            # Financial health / insights
            elif intent["health_insight"]:
                facts["financial_health"] = insight.get_financial_health_score(df)
                facts["spending_insights"] = insight.generate_spending_insights(df)
                tools_used += ["get_financial_health_score", "generate_spending_insights"]

            # Budget suggestion
            elif intent["budget_suggestion"]:
                facts["budget_suggestion"] = insight.suggest_budget(df)
                tools_used.append("suggest_budget")

            # Specific category query. Skip when the match is just the word
            # "savings" inside a "savings rate" question — that's a coincidence
            # with the "Savings" category name, not a real category question,
            # and would otherwise attach an unrelated "Total Spending on Savings"
            # block to a savings-rate answer.
            category_match = extract_category(message, known_categories)
            if category_match and category_match.lower() == "savings" and intent["savings_rate"]:
                category_match = None
            if category_match:
                facts["category_total"] = {category_match: txn.get_category_total(df, category_match)}
                facts["category_transactions"] = txn.search_transactions(df, category_match)[:5]
                tools_used.append("get_category_total")

            # Search keyword
            search_kw = extract_search_keyword(message)
            if search_kw:
                facts["search_results"] = txn.search_transactions(df, search_kw)
                tools_used.append("search_transactions")

            # Goal analysis
            if intent["goal"]:
                amount, timeline = extract_amount_and_timeline(message)
                if amount:
                    facts["goal_analysis"] = goal.analyze_savings_goal(df, amount, timeline)
                    tools_used.append("analyze_savings_goal")

            # Income / expense / balance queries
            if intent["income_query"]:
                facts["total_income"] = txn.get_total_income(df)
                tools_used.append("get_total_income")
            if intent["expense_query"]:
                facts["total_expenses"] = txn.get_total_expenses(df)
                tools_used.append("get_total_expenses")
            if intent["balance_query"]:
                facts["balance"] = txn.get_balance(df)
                tools_used.append("get_balance")

        # ---- 5. RAG Retrieval (for conceptual questions or knowledge augmentation) ----
        if intent["knowledge"] or (intent["savings_rate"] and not data_available):
            rag_results = self.rag.retrieve_context(message, top_k=3)
            if rag_results:
                tools_used.append("rag_retrieve_context")

        # ---- 6. Generate Response ----
        answer = self._generate_response(
            message, intent, facts, rag_results, conversation_history, data_available, df
        )

        return {
            "answer": answer,
            "sources": [r["title"] for r in rag_results],
            "tools_used": tools_used,
            "data_used": bool(facts),
            "rag_used": bool(rag_results),
        }

    def _generate_response(self, message: str, intent: Dict, facts: Dict,
                            rag_results: List[Dict], conversation_history: List[Dict],
                            data_available: bool, df: Optional[pd.DataFrame] = None) -> str:

        # If we have Gemini client available, attempt LLM generation with targeted prompt
        if self.gemini_client:
            try:
                system_instructions = (
                    "You are FinAI, an expert, encouraging personal finance assistant for Indian users. "
                    "You ONLY help with personal finance topics: the user's income/expenses/transactions, "
                    "budgeting, savings, savings goals, loans/EMI, investments, and general finance concepts "
                    "(e.g. SIP, credit score, inflation, tax basics).\n"
                    "Rules:\n"
                    "- If the USER QUESTION is not about personal finance in any way (e.g. general knowledge, "
                    "coding, entertainment, sports, science, or any other unrelated topic), do NOT answer it. "
                    "Instead, reply briefly that you're a personal finance assistant and can't help with that, "
                    "and invite them to ask a finance-related question instead. Do not answer the off-topic "
                    "question even partially, even if you know the answer.\n"
                    "- Use ONLY the calculated financial facts provided below for numbers about the user's data.\n"
                    "- If CALCULATED FINANCIAL FACTS is 'None' or empty, the question is NOT about the user's "
                    "transactions — do not invent or reuse numbers, dates, or transaction details from earlier "
                    "in the conversation.\n"
                    "- If RETRIEVED KNOWLEDGE is 'None' but the question IS a genuine finance question, answer "
                    "it from your own finance knowledge — just don't force in unrelated retrieved content.\n"
                    "- If answering about savings rate, format the rate and explain the income vs expense math clearly.\n"
                    "- If answering about recent transactions, format them in a clean markdown table.\n"
                    "- If answering about category spending, format as a markdown table with percentage of total expenses.\n"
                    "- If answering conceptual finance questions, use the retrieved knowledge base when relevant.\n"
                    "- Always use ₹ with Indian number formatting (e.g., ₹36,000, ₹1,25,000).\n"
                    "- Never use LaTeX (no $$...$$ or \\frac{}{}); write any formula in plain text using ×, ÷, =.\n"
                    "- Be concise, practical, and clear. Format answers with markdown bold headers and lists."
                )

                prompt = f"""{system_instructions}

CALCULATED FINANCIAL FACTS (Ground Truth):
{json.dumps(facts, indent=2, default=str) if facts else "None"}

RETRIEVED KNOWLEDGE:
{"\n\n".join(f"[{r['title']}]\n{r['text'][:400]}" for r in rag_results) if rag_results else "None"}

USER QUESTION:
{message}

Answer the user directly and helpfully in markdown."""

                response = self.gemini_client.models.generate_content(
                    model=self.gemini_model,
                    contents=prompt,
                )
                text = getattr(response, "text", None)
                if text and text.strip():
                    return text.strip()
            except Exception:
                pass  # Fall back to our deterministic template engine

        # Deterministic / Fallback Response Engine
        return self._format_deterministic_response(intent, facts, rag_results, data_available, df)

    def _format_deterministic_response(self, intent: Dict, facts: Dict,
                                       rag_results: List[Dict], data_available: bool,
                                       df: Optional[pd.DataFrame] = None) -> str:
        """High-precision, beautiful deterministic response generator.

        Builds one block of markdown per matched fact and joins them —
        a message like "what is my income how to save 500 every month"
        sets BOTH intent["income_query"] and intent["goal"], and both
        get answered instead of only the first one that used to `return`.
        """
        blocks: List[str] = []
        savings_rate_shown = False

        # 1. Savings Rate Query
        if intent["savings_rate"] and data_available and "savings_rate" in facts:
            rate = facts["savings_rate"]
            income = facts.get("total_income", 0)
            expenses = facts.get("total_expenses", 0)
            balance = facts.get("balance", 0)

            status_icon = "🟢" if rate >= 20 else ("🟡" if rate > 0 else "🔴")
            evaluation = (
                "**Excellent!** You are saving above the recommended 20% benchmark." if rate >= 30
                else "**Good!** You are meeting the standard 50/30/20 rule target of 20%." if rate >= 20
                else "**Low.** You are saving less than 20% of your income. Consider reviewing discretionary expenses." if rate > 0
                else "**Warning: Negative Savings Rate.** Your expenses exceed your income. This means you are spending into reserves or credit."
            )

            blocks.append(
                f"### {status_icon} Your Savings Rate: **{rate:.1f}%**\n\n"
                f"- **Total Income:** ₹{income:,.2f}\n"
                f"- **Total Expenses:** ₹{expenses:,.2f}\n"
                f"- **Net Savings:** ₹{balance:,.2f}\n\n"
                f"{evaluation}\n\n"
                f"**Formula:** Savings Rate = (Net Savings ÷ Total Income) × 100 "
                f"= (₹{balance:,.0f} ÷ ₹{income:,.0f}) × 100 = **{rate:.1f}%**\n\n"
                f"💡 **Benchmark Guideline:** The 50/30/20 budgeting rule suggests aiming for at least **20%** of your after-tax income in savings and investments."
            )
            savings_rate_shown = True  # already covers income/expenses/balance below

        # 2. Recent Transactions Query
        if intent["recent_txns"] and data_available and "recent_transactions" in facts:
            txns = facts["recent_transactions"]
            total_count = facts.get("total_transactions", len(txns))
            lines = [
                f"### 📋 Recent Transactions (Showing latest {len(txns)} of {total_count})\n",
                "| Date | Description | Category | Type | Amount |",
                "|---|---|---|---|---|"
            ]
            for t in txns:
                sign = "+" if t["type"] == "income" else "-"
                lines.append(f"| {t['date']} | {t['description']} | **{t['category']}** | `{t['type']}` | {sign}₹{t['amount']:,.2f} |")
            lines.append("\n💡 *Tip: You can use the search bar in the Transactions section on the sidebar to filter transactions by date, merchant, or category.*")
            blocks.append("\n".join(lines))

        # 3. Category Spending Breakdown
        if intent["category_spending"] and data_available and "category_spending" in facts:
            cat_data = facts["category_spending"]
            total_exp = facts.get("total_expenses", sum(cat_data.values()))
            top_cat, top_amt = next(iter(cat_data.items())) if cat_data else ("None", 0)
            top_pct = (top_amt / total_exp * 100) if total_exp > 0 else 0

            lines = [
                "### 📊 Expense by Category Breakdown\n",
                f"**Total Expenses:** ₹{total_exp:,.2f} across {len(cat_data)} categories.\n",
                f"**Highest Category:** **{top_cat}** at ₹{top_amt:,.2f} ({top_pct:.1f}% of total spend).\n",
                "| Category | Amount (₹) | % of Expenses |",
                "|---|---|---|"
            ]
            for cat, amt in list(cat_data.items())[:10]:
                pct = (amt / total_exp * 100) if total_exp > 0 else 0
                lines.append(f"| **{cat}** | ₹{amt:,.2f} | {pct:.1f}% |")
            blocks.append("\n".join(lines))

        # 4. Largest Expenses
        if intent["largest_expense"] and data_available and "largest_expenses" in facts:
            lx_list = facts["largest_expenses"]
            lines = [
                "### 🔻 Top Largest Single Expenses\n",
                "| Amount | Description | Category | Date |",
                "|---|---|---|---|"
            ]
            for lx in lx_list:
                lines.append(f"| **₹{lx['amount']:,.2f}** | {lx['description']} | {lx['category']} | {lx['date']} |")
            blocks.append("\n".join(lines))

        # 5. Monthly Summary
        if intent["monthly_summary"] and data_available and "monthly_summary" in facts:
            m_list = facts["monthly_summary"]
            lines = [
                "### 📅 Monthly Income vs Expenses Trend\n",
                "| Month | Income | Expenses | Net Savings |",
                "|---|---|---|---|"
            ]
            for m in m_list:
                net_sign = "+" if m["net"] >= 0 else ""
                lines.append(f"| **{m['month']}** | ₹{m['income']:,.2f} | ₹{m['expenses']:,.2f} | {net_sign}₹{m['net']:,.2f} |")
            blocks.append("\n".join(lines))

        # 6. Financial Health / Insights
        if intent["health_insight"] and data_available and "financial_health" in facts:
            h = facts["financial_health"]
            insights_list = facts.get("spending_insights", [])
            lines = [
                f"### 🛡️ Financial Health Score: **{h['score']}/100** ({h['grade']})\n",
                "**Score Breakdown:**",
                f"- Savings Rate: {h['breakdown'].get('savings_rate_score', 0)}/40 pts",
                f"- Expense Diversity: {h['breakdown'].get('expense_diversity_score', 0)}/20 pts",
                f"- Positive Cash Flow: {h['breakdown'].get('positive_cash_flow_score', 0)}/20 pts",
                f"- Month-to-Month Stability: {h['breakdown'].get('monthly_stability_score', 0)}/20 pts\n",
                "**Key Insights:**"
            ]
            for ins in insights_list:
                lines.append(f"- {ins}")
            blocks.append("\n".join(lines))

        # 7. Budget Suggestion
        if intent["budget_suggestion"] and data_available and "budget_suggestion" in facts:
            sug = facts["budget_suggestion"]
            avg_inc = sug.get("avg_monthly_income", 0)
            suggested = sug.get("suggested", {})
            actual = sug.get("actual_monthly_avg", {})
            blocks.append(
                f"### 🎯 Suggested Monthly Budget (50/30/20 Rule)\n\n"
                f"Based on your average monthly income of **₹{avg_inc:,.2f}**:\n\n"
                f"| Category Bucket | Recommended % | Recommended Limit | Your Current Average |\n"
                f"|---|---|---|---|\n"
                f"| **Needs (Essential)** | 50% | **₹{suggested.get('needs_50pct', 0):,.2f}** | ₹{actual.get('needs_spending', 0):,.2f} |\n"
                f"| **Wants (Discretionary)** | 30% | **₹{suggested.get('wants_30pct', 0):,.2f}** | ₹{actual.get('wants_spending', 0):,.2f} |\n"
                f"| **Savings & Goals** | 20% | **₹{suggested.get('savings_20pct', 0):,.2f}** | ₹{actual.get('net_savings', 0):,.2f} |\n\n"
                f"💡 *Needs include Rent, Groceries, Utilities, Transport. Wants include Dining, Shopping, Entertainment.*"
            )

        # 8. Category Total
        if "category_total" in facts:
            for cat, total in facts["category_total"].items():
                blocks.append(f"### 🏷️ Total Spending on **{cat}**: **₹{total:,.2f}**")
                break  # only ever one category match today

        # 9. Savings Goal Analysis
        if intent.get("goal") and "goal_analysis" in facts:
            g = facts["goal_analysis"]
            status_icon = "🟢" if g["is_currently_on_track"] else "🟡"
            lines = [
                f"### 🎯 Savings Goal: **₹{g['target_amount']:,.2f}** in {g['timeline_months']:.1f} month(s)\n",
                f"- **Amount Still Needed:** ₹{g['remaining_amount']:,.2f}",
                f"- **Required Monthly Saving:** ₹{g['required_monthly_saving']:,.2f}",
                f"- **Your Current Monthly Savings Capacity:** ₹{g['estimated_current_monthly_savings_capacity']:,.2f} "
                f"(based on your loaded transaction data)",
            ]
            if g["is_currently_on_track"]:
                lines.append(f"\n{status_icon} **You're on track!** Your current savings pace covers this goal.")
            else:
                lines.append(
                    f"\n{status_icon} **Gap:** You'd need about ₹{g['savings_gap']:,.2f} more in savings per month "
                    f"to hit this goal — consider trimming discretionary spending or extending the timeline."
                )
            blocks.append("\n".join(lines))

        # 10. Direct income / expense / balance queries (e.g. "What is my income?").
        # Skipped when the savings-rate block already fired, since that block
        # already shows income, expenses, and balance together.
        if not savings_rate_shown:
            if intent.get("income_query") and "total_income" in facts:
                blocks.append(f"### 💰 Total Income: **₹{facts['total_income']:,.2f}**")
            if intent.get("expense_query") and "total_expenses" in facts:
                blocks.append(f"### 💸 Total Expenses: **₹{facts['total_expenses']:,.2f}**")
            if intent.get("balance_query") and "balance" in facts:
                blocks.append(f"### 🏦 Current Balance: **₹{facts['balance']:,.2f}**")

        if blocks:
            return "\n\n---\n\n".join(blocks)

        # 11. RAG Knowledge Reference (only when retrieval actually found something relevant)
        if rag_results:
            lines = ["### 📚 Financial Knowledge Reference:\n"]
            for r in rag_results:
                lines.append(f"#### {r['title']}\n{r['text']}\n")
            return "\n".join(lines)

        # 12. General / off-topic questions with no relevant RAG match — FinAI
        # is scoped to personal finance only, so this is a firm redirect,
        # not an attempt to answer from general knowledge.
        if intent.get("knowledge"):
            return (
                "I'm FinAI, a personal finance assistant — I can only help with topics like your "
                "income, expenses, budgeting, savings, savings goals, loans, or investments. "
                "That question is outside what I can help with. Try asking me something "
                "finance-related instead, like your savings rate or spending by category!"
            )

        # 13. General Fallback for finance/transaction-shaped questions we couldn't pin down
        if data_available and df is not None:
            inc = txn.get_total_income(df)
            exp = txn.get_total_expenses(df)
            bal = txn.get_balance(df)
            rate = txn.get_savings_rate(df)
            return (
                f"### 📊 Financial Summary\n\n"
                f"- **Total Income:** ₹{inc:,.2f}\n"
                f"- **Total Expenses:** ₹{exp:,.2f}\n"
                f"- **Net Balance:** ₹{bal:,.2f}\n"
                f"- **Savings Rate:** {rate:.1f}%\n\n"
                f"Try asking specific questions like:\n"
                f"- *'What is my savings rate?'*\n"
                f"- *'Show my recent transactions'*\n"
                f"- *'Show expense per category'*\n"
                f"- *'How is my financial health?'*"
            )

        return (
            "I couldn't find transaction data loaded. Please upload a CSV file or click 'Use Sample Data' to analyze your finances!"
        )