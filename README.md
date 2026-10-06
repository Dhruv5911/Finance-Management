# FinAI: Intelligent Personal Finance Assistant

An AI-103 project demonstrating Generative AI, an LLM, RAG, an AI agent with tool calling, CSV data processing, financial knowledge retrieval, and Responsible AI — wrapped in a working web application.

## Problem Statement

Many people struggle to understand where their money goes and how to plan toward savings goals. Spreadsheets are tedious, and generic chatbots either can't see your actual numbers or hallucinate financial facts. FinAI addresses this by combining **real transaction analysis** with **grounded financial education**, synthesized by an LLM into a natural conversation.

## Objectives

- Let a user upload their own transaction CSV (or use built-in sample data) and see an instant financial dashboard.
- Answer natural-language questions about that data using deterministic Python calculations (never hallucinated numbers).
- Answer general financial education questions (FD, SIP, PPF, 50/30/20 rule, etc.) using a local RAG pipeline over a hand-written knowledge base.
- Combine both for compound questions ("I want to save ₹5,000 — what should I cut?").
- Do all of this responsibly: no fabricated numbers, no guaranteed returns, no requests for banking credentials.

## Features

- CSV upload with validation (required columns, types, dates, amounts) and graceful sample-data fallback
- Dashboard: total income, total expenses, balance, savings rate
- Charts: expense-by-category doughnut, monthly income vs. expenses bar chart
- Searchable, filterable, sortable transaction table
- AI chat panel with quick-question buttons, source/tool transparency, and session-based chat memory
- Savings goal analyzer (target amount + timeline → required monthly saving, gap, progress)
- Budget planner (set per-category budgets, compare against actual spending)
- Local RAG engine (TF-IDF + cosine similarity) over an ~8,000-word finance knowledge base
- Real agent-style routing: the agent decides whether a question needs transaction tools, RAG, both, or neither, before calling Gemini to write the final answer

## Architecture

```
                          ┌─────────────────────┐
                          │   Browser (HTML/JS)  │
                          │  Dashboard + AI Chat  │
                          └──────────┬───────────┘
                                     │ REST (JSON)
                          ┌──────────▼───────────┐
                          │   Flask app (app.py)  │
                          │  routes + CSV state   │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
          ┌─────────▼───────┐ ┌──────▼──────┐ ┌────────▼────────┐
          │ FinanceAgent      │ │ transaction_ │ │  RAGEngine       │
          │ (agent/) - routes │ │ / budget_ /  │ │  (rag/) - TF-IDF │
          │ intent → tools,   │ │ goal_tools   │ │  over            │
          │ RAG, and Gemini   │ │ (pandas)     │ │  finance_        │
          └─────────┬────────┘ └─────────────┘ │  knowledge.md    │
                     │                           └──────────────────┘
                     ▼
          ┌─────────────────────┐
          │   Gemini API          │
          │  (final synthesis      │
          │   over given facts)     │
          └─────────────────────┘
```

The browser never talks to Gemini directly — only the Flask backend does, using a server-side API key.

## Technologies

Python · Flask · Google Gemini API (`google-genai` SDK) · Pandas · scikit-learn (TF-IDF) · HTML/CSS/JavaScript · Chart.js

## AI Concepts Demonstrated

- **Generative AI / LLM**: Gemini generates the final natural-language answer.
- **RAG**: user questions are matched against chunked knowledge-base sections via TF-IDF + cosine similarity; only the top-matching chunks are given to Gemini as context (not the whole document).
- **Agent / Tool Calling**: `agent/finance_agent.py` classifies intent and decides which deterministic Python tools (transaction/budget/goal calculations) and/or RAG retrieval to invoke before calling the LLM — the LLM never does financial arithmetic itself.
- **Prompting**: the agent builds a structured prompt containing only verified facts, retrieved knowledge, and conversation history, with explicit instructions not to invent numbers.
- **Responsible AI**: the system never asks for banking credentials, never claims to move real money, never guarantees investment returns, and clearly states when data or knowledge is unavailable rather than making something up.

## How RAG Works

1. `rag/document_processor.py` splits `data/finance_knowledge.md` into chunks by `##` section headers.
2. `rag/rag_engine.py` builds a TF-IDF vector index over all chunks at startup.
3. On each knowledge-related question, the query is vectorized and compared via cosine similarity against all chunks.
4. The top-K (default 4) chunks above a minimum relevance score are returned, with their section titles shown to the user as "Sources."

## How the Agent Works

`classify_intent()` in `agent/finance_agent.py` uses keyword/pattern matching to flag a message as transaction-related, knowledge-related, goal-related, budget-related, and/or out-of-domain. Based on that:
- Transaction/goal/budget intents trigger the relevant Python tool calls (pandas calculations) — results become verified "facts."
- Knowledge/goal/budget intents also trigger RAG retrieval.
- Both facts and retrieved knowledge (plus recent chat history, for pronoun resolution like "how long would *it* take") are assembled into one prompt and sent to Gemini, which is explicitly instructed to use only the given facts and never compute or invent numbers itself.
- Out-of-domain questions (e.g. "who is the president of France") are politely declined without calling Gemini.

## How CSV Analysis Works

Uploaded CSVs are validated for required columns (`date, description, category, type, amount`), valid dates, numeric amounts, and valid `type` values (`income`/`expense`). Valid data replaces the in-memory DataFrame that all tools operate on; invalid data returns specific, actionable error messages. No database is used — data lives in server memory for the running session, matching the scope of a local prototype.

## Responsible AI

FinAI will not: request bank passwords, OTPs, or card numbers; claim to access real bank accounts or execute transactions; guarantee investment returns; recommend one specific product as "the best"; or state specific current interest/tax rates as if permanent (the knowledge base explicitly tells the reader to verify current rates). If transaction data needed to answer a question isn't loaded, or the knowledge base doesn't cover a topic, the agent says so instead of guessing.

## Installation (Windows)

```
cd FinAI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

(macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`)

## Gemini API Setup

1. Copy `.env.example` to `.env`.
2. Get a Gemini API key from Google AI Studio.
3. Edit `.env` and set:
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```
4. Never commit `.env` — it's already in `.gitignore`.

Without a key, the app still runs fully — the chat falls back to showing the raw calculated facts and retrieved knowledge sections directly, so you can verify the tools/RAG/dashboard all work before wiring up Gemini.

## Running the Application

To run everything with a single command (starts the server and automatically opens your browser):

```bash
python run.py
```

Alternatively, you can run directly with Flask:
```bash
python app.py
```

Then visit **http://127.0.0.1:5000** in your browser.

## Example Questions to Test

- How much did I spend?
- Where am I spending the most?
- I want to save ₹5,000 this month. What should I do?
- What is an emergency fund?
- What is the 50/30/20 rule?
- What is an FD? What is SIP?
- Compare my spending between January and February.
- Based on my spending, how can I build an emergency fund? *(combined: tools + RAG)*
- Who is the president of France? *(out-of-domain — should politely decline)*

## Limitations

- Educational prototype: uses fictional sample data, no real bank integration, no transaction execution.
- No guaranteed investment returns or personalized licensed financial advice.
- Intent classification is keyword/pattern-based (transparent and debuggable for a student project) rather than a trained classifier — it can occasionally misroute an ambiguous question.
- Uploaded/edited data is kept in server memory only and resets when the app restarts.
- Financial rates, tax rules, and scheme limits mentioned conceptually in the knowledge base should be verified from current authoritative sources — they are intentionally not hardcoded as fixed numbers.
