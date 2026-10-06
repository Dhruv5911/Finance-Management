"""
Tool registry for the autonomous FinAI agent.

This is what turns FinAI from "regex guesses intent -> Gemini writes the
sentence" into a real agent: Gemini itself sees this list of tools and
decides which ones to call and with what arguments, for as many rounds as
it needs, before writing a final answer.

Every entry maps a Gemini-visible function name to:
  - the real Python callable in tools/ or rag/ that does the work
  - a JSON-schema "parameters" block Gemini uses to know what args to pass
  - needs_df: whether the transaction DataFrame must be injected as the
              first argument (Gemini never sees or passes the DataFrame
              itself — that would leak raw data into the prompt/response
              loop unnecessarily and risks it "inventing" rows)
"""
from typing import Any, Callable, Dict, List

from tools import transaction_tools as txn
from tools import budget_tools as budget
from tools import goal_tools as goal
from tools import insight_tools as insight


def _rag_search(rag_engine, query: str, top_k: int = 3) -> List[Dict]:
    return rag_engine.retrieve_context(query, top_k=top_k)


# name -> {"fn", "description", "parameters", "needs_df", "needs_rag", "needs_budgets"}
TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "get_total_income": {
        "fn": txn.get_total_income,
        "description": "Total income across all loaded transactions.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_total_expenses": {
        "fn": txn.get_total_expenses,
        "description": "Total expenses across all loaded transactions.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_balance": {
        "fn": txn.get_balance,
        "description": "Net balance (income minus expenses).",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_savings_rate": {
        "fn": txn.get_savings_rate,
        "description": "Savings rate as a percentage of income.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_category_spending": {
        "fn": txn.get_category_spending,
        "description": "Total expense amount for every category, highest first.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_category_total": {
        "fn": txn.get_category_total,
        "description": "Total spent in one specific named category.",
        "parameters": {
            "type": "object",
            "properties": {"category": {"type": "string", "description": "Exact category name, e.g. 'Groceries'"}},
            "required": ["category"],
        },
        "needs_df": True,
    },
    "get_largest_expenses": {
        "fn": txn.get_largest_expenses,
        "description": "The N largest single expense transactions.",
        "parameters": {
            "type": "object",
            "properties": {"n": {"type": "integer", "description": "How many to return (default 5)"}},
        },
        "needs_df": True,
    },
    "get_recent_transactions": {
        "fn": txn.get_recent_transactions,
        "description": "The N most recent transactions, newest first.",
        "parameters": {
            "type": "object",
            "properties": {"n": {"type": "integer", "description": "How many to return (default 10)"}},
        },
        "needs_df": True,
    },
    "get_monthly_summary": {
        "fn": txn.get_monthly_summary,
        "description": "Income, expenses and net savings for every month present in the data.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_spending_trend": {
        "fn": txn.get_spending_trend,
        "description": "Month-over-month spending trend (rising / falling / stable).",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "search_transactions": {
        "fn": txn.search_transactions,
        "description": "Search transactions by a keyword in their description or category.",
        "parameters": {
            "type": "object",
            "properties": {"keyword": {"type": "string"}},
            "required": ["keyword"],
        },
        "needs_df": True,
    },
    "get_top_income_sources": {
        "fn": txn.get_top_income_sources,
        "description": "The largest income sources by description.",
        "parameters": {
            "type": "object",
            "properties": {"n": {"type": "integer", "description": "How many to return (default 5)"}},
        },
        "needs_df": True,
    },
    "get_average_monthly_spending": {
        "fn": txn.get_average_monthly_spending,
        "description": "Average monthly spending across the loaded data.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_highest_spending_month": {
        "fn": txn.get_highest_spending_month,
        "description": "The single month with the highest total spending.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "calculate_budget_status": {
        "fn": budget.calculate_budget_status,
        "description": "Compare actual category spending against user-set budget limits. "
                        "Only call this if the user has provided budgets.",
        "parameters": {
            "type": "object",
            "properties": {
                "budgets": {
                    "type": "object",
                    "description": "Map of category name -> monthly budget limit, e.g. {'Food': 5000}",
                }
            },
            "required": ["budgets"],
        },
        "needs_df": True,
        "needs_budgets": True,
    },
    "estimate_discretionary_spending": {
        "fn": budget.estimate_discretionary_spending,
        "description": "Estimate how much of the user's spending is discretionary (non-essential).",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "calculate_potential_savings": {
        "fn": budget.calculate_potential_savings,
        "description": "Estimate potential monthly savings if discretionary spending were cut by a percentage.",
        "parameters": {
            "type": "object",
            "properties": {"reduction_percent": {"type": "number", "description": "e.g. 20 for a 20% cut"}},
        },
        "needs_df": True,
    },
    "analyze_savings_goal": {
        "fn": goal.analyze_savings_goal,
        "description": "Check whether a savings goal (target amount, in a timeline) is achievable "
                        "given the user's current transaction data, and what monthly saving it requires.",
        "parameters": {
            "type": "object",
            "properties": {
                "target_amount": {"type": "number"},
                "timeline_months": {"type": "number"},
                "current_savings": {"type": "number", "description": "Already saved so far, default 0"},
            },
            "required": ["target_amount", "timeline_months"],
        },
        "needs_df": True,
    },
    "generate_spending_insights": {
        "fn": insight.generate_spending_insights,
        "description": "Plain-English list of notable patterns/insights in the user's spending.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "get_financial_health_score": {
        "fn": insight.get_financial_health_score,
        "description": "A 0-100 financial health score with a breakdown of what drove it.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "suggest_budget": {
        "fn": insight.suggest_budget,
        "description": "Auto-suggest a monthly budget per category using the 50/30/20 rule.",
        "parameters": {"type": "object", "properties": {}},
        "needs_df": True,
    },
    "search_finance_knowledge": {
        "fn": _rag_search,
        "description": "Semantic search over FinAI's finance knowledge base (SIP, EMI, credit scores, "
                        "tax concepts, etc). Call this for conceptual/educational finance questions that "
                        "are NOT about the user's own transactions.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer", "description": "How many chunks to retrieve (default 3)"},
            },
            "required": ["query"],
        },
        "needs_rag": True,
    },
}


def build_gemini_tool_declarations(types_module) -> Any:
    """Build a single google.genai `types.Tool` from TOOL_REGISTRY."""
    declarations = [
        types_module.FunctionDeclaration(
            name=name,
            description=spec["description"],
            parameters=spec["parameters"],
        )
        for name, spec in TOOL_REGISTRY.items()
    ]
    return types_module.Tool(function_declarations=declarations)


def dispatch(name: str, args: Dict[str, Any], df, rag_engine, budgets) -> Any:
    """Execute one Gemini-requested tool call and return a JSON-serializable result."""
    spec = TOOL_REGISTRY.get(name)
    if spec is None:
        return {"error": f"Unknown tool '{name}'"}

    fn: Callable = spec["fn"]
    call_args = dict(args or {})

    try:
        if spec.get("needs_rag"):
            return fn(rag_engine, **call_args)

        if spec.get("needs_df"):
            if df is None or df.empty:
                return {"error": "No transaction data is currently loaded."}
            if spec.get("needs_budgets") and "budgets" not in call_args:
                call_args["budgets"] = budgets or {}
            return fn(df, **call_args)

        return fn(**call_args)
    except Exception as e:
        return {"error": f"Tool '{name}' failed: {e}"}
