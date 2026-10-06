"""
FinAI — Intelligent Personal Finance Assistant
Flask backend: API routes, CSV handling, and wiring together the agent, tools, and RAG engine.
"""
import os
import traceback
from datetime import datetime

import pandas as pd
from flask import Flask, request, jsonify, render_template, session, send_file
from flask_cors import CORS

from config import Config
from rag.rag_engine import RAGEngine
from agent.finance_agent import FinanceAgent
from agent.autonomous_monitor import AutonomousMonitor
from tools import transaction_tools as txn
from tools import goal_tools as goal_tools_mod

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "finai-dev-secret-change-me")
CORS(app)

# ---------------------------------------------------------------------------
# Startup: Gemini client, then RAG index (embeddings need the client), then
# the autonomous scheduler that watches for budget/health alerts on its own.
# ---------------------------------------------------------------------------

gemini_client = None
gemini_status = "not_configured"
if Config.GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=Config.GEMINI_API_KEY)
        gemini_status = "configured"
        print("[FinAI] Gemini client initialized.")
    except Exception as e:
        gemini_status = f"error: {e}"
        print(f"[FinAI] WARNING: Gemini client failed to initialize: {e}")
else:
    print("[FinAI] WARNING: GEMINI_API_KEY not set. Chat will use fallback (non-AI) responses "
          "until you add a key to .env.")

print("[FinAI] Building RAG index from knowledge base...")
rag_engine = RAGEngine(
    Config.KNOWLEDGE_BASE_PATH,
    gemini_client=gemini_client,
    embedding_model=Config.EMBEDDING_MODEL,
)
print(f"[FinAI] RAG index ready with {len(rag_engine.chunks)} chunks (backend: {rag_engine.backend}).")

agent = FinanceAgent(rag_engine=rag_engine, gemini_client=gemini_client, gemini_model=Config.GEMINI_MODEL)

# ---------------------------------------------------------------------------
# In-memory application state (no database — per instructions, kept simple)
# ---------------------------------------------------------------------------

STATE = {
    "df": None,          # currently loaded transactions DataFrame
    "source": None,      # "sample" or "uploaded"
    "filename": None,
    "budgets": {},        # last budgets the user submitted via /api/budget, reused by the monitor
}

# Autonomous background monitor: checks budgets/health on a timer and raises
# alerts on its own, without the user having to ask in chat.
monitor = AutonomousMonitor(
    get_state=lambda: {"df": STATE["df"], "budgets": STATE["budgets"]},
    gemini_client=gemini_client,
    gemini_model=Config.GEMINI_MODEL,
)
monitor.start(interval_minutes=Config.AUTONOMOUS_CHECK_MINUTES)


def _load_dataframe_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    # Only coerce columns that are actually present — missing columns are
    # reported clearly by _validate_dataframe() instead of raising here.
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    if "type" in df.columns:
        df["type"] = df["type"].astype(str).str.strip().str.lower()
    if "category" in df.columns:
        df["category"] = df["category"].astype(str).str.strip()
    if "description" in df.columns:
        df["description"] = df["description"].astype(str).str.strip()
    return df


def _validate_dataframe(df: pd.DataFrame):
    errors = []
    missing_cols = [c for c in Config.REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required column(s): {', '.join(missing_cols)}")
        return errors  # can't validate further without columns

    if df.empty:
        errors.append("The CSV file has no data rows.")
        return errors

    if df["date"].isna().any():
        errors.append("Some rows have an invalid or unparseable date. Use format YYYY-MM-DD.")

    if df["amount"].isna().any():
        errors.append("Some rows have a missing or non-numeric amount.")

    invalid_types = df[~df["type"].isin(Config.VALID_TYPES)]
    if not invalid_types.empty:
        errors.append("Some rows have an invalid 'type' value. Must be 'income' or 'expense'.")

    empty_desc = df["description"].isna() | (df["description"].str.strip() == "")
    if empty_desc.any():
        errors.append("Some rows are missing a description.")

    return errors


def _load_sample_data():
    df = _load_dataframe_from_csv(Config.SAMPLE_CSV_PATH)
    df = df.dropna(subset=["date", "amount"]).reset_index(drop=True)
    df["id"] = df.index.astype(int)
    STATE["df"] = df
    STATE["source"] = "sample"
    STATE["filename"] = "sample_transactions.csv"


# Load sample data at startup so the dashboard has something to show immediately
_load_sample_data()


# ---------------------------------------------------------------------------
# Routes — pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def upload_csv():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file was provided."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file was selected."}), 400

        if not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only .csv files are supported."}), 400

        save_path = os.path.join(Config.UPLOAD_FOLDER, "current_upload.csv")
        file.save(save_path)

        try:
            df = _load_dataframe_from_csv(save_path)
        except Exception:
            return jsonify({"error": "Could not parse this file as a CSV. Please check its formatting."}), 400

        errors = _validate_dataframe(df)
        if errors:
            return jsonify({"error": "CSV validation failed.", "details": errors}), 400

        # Drop rows that failed to parse (shouldn't happen if validation passed, but stay safe)
        df = df.dropna(subset=["date", "amount"]).reset_index(drop=True)
        df["id"] = df.index.astype(int)

        STATE["df"] = df
        STATE["source"] = "uploaded"
        STATE["filename"] = file.filename

        return jsonify({
            "message": f"Successfully loaded {len(df)} transactions from {file.filename}.",
            "row_count": len(df),
        })
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while processing the upload."}), 500


@app.route("/api/clear-data", methods=["POST"])
def clear_data():
    try:
        _load_sample_data()
        return jsonify({"message": "Reverted to sample data.", "row_count": len(STATE["df"])})
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not reset data."}), 500


@app.route("/api/download-sample", methods=["GET"])
def download_sample():
    try:
        return send_file(
            Config.SAMPLE_CSV_PATH,
            as_attachment=True,
            download_name="sample_transactions.csv",
            mimetype="text/csv"
        )
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not download sample file."}), 500


@app.route("/api/summary", methods=["GET"])
def summary():
    df = STATE["df"]
    if df is None or df.empty:
        return jsonify({"total_income": 0, "total_expenses": 0, "balance": 0, "savings_rate": 0,
                         "transaction_count": 0, "source": STATE["source"]})
    return jsonify({
        "total_income": txn.get_total_income(df),
        "total_expenses": txn.get_total_expenses(df),
        "balance": txn.get_balance(df),
        "savings_rate": txn.get_savings_rate(df),
        "transaction_count": txn.get_transaction_count(df),
        "source": STATE["source"],
        "filename": STATE["filename"],
    })


@app.route("/api/transactions", methods=["GET"])
def transactions():
    df = STATE["df"]
    if df is None or df.empty:
        return jsonify({"transactions": []})
    cols = ["id", "date", "description", "category", "type", "amount"] if "id" in df.columns else ["date", "description", "category", "type", "amount"]
    out = df.sort_values("date", ascending=False)[cols]
    out = out.assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d"))
    return jsonify({"transactions": out.to_dict(orient="records")})


@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    try:
        payload = request.get_json(force=True) or {}
        date_str = str(payload.get("date", "")).strip()
        desc = str(payload.get("description", "")).strip()
        category = str(payload.get("category", "")).strip()
        txn_type = str(payload.get("type", "")).strip().lower()
        amount_raw = payload.get("amount")

        # Validation matching CSV rules
        if not date_str:
            return jsonify({"error": "Date is required (format: YYYY-MM-DD)."}), 400
        try:
            parsed_date = pd.to_datetime(date_str, format="%Y-%m-%d")
        except Exception:
            try:
                parsed_date = pd.to_datetime(date_str)
            except Exception:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

        if not desc:
            return jsonify({"error": "Description cannot be empty."}), 400

        if not category:
            return jsonify({"error": "Category cannot be empty."}), 400

        if txn_type not in Config.VALID_TYPES:
            return jsonify({"error": f"Invalid type '{txn_type}'. Must be 'income' or 'expense'."}), 400

        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({"error": "Amount must be a positive number greater than 0."}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Amount must be a valid numeric value."}), 400

        df = STATE["df"]
        if df is None:
            df = pd.DataFrame(columns=Config.REQUIRED_COLUMNS + ["id"])

        # Determine next ID
        if not df.empty and "id" in df.columns and not df["id"].isna().all():
            next_id = int(df["id"].max()) + 1
        else:
            next_id = 0

        new_row = pd.DataFrame([{
            "id": next_id,
            "date": parsed_date,
            "description": desc,
            "category": category,
            "type": txn_type,
            "amount": round(amount, 2),
        }])

        STATE["df"] = pd.concat([df, new_row], ignore_index=True)

        return jsonify({
            "message": "Transaction added successfully.",
            "transaction": {
                "id": next_id,
                "date": parsed_date.strftime("%Y-%m-%d"),
                "description": desc,
                "category": category,
                "type": txn_type,
                "amount": round(amount, 2),
            },
            "transaction_count": len(STATE["df"]),
        }), 201
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while adding transaction."}), 500


@app.route("/api/transactions/<int:txn_id>", methods=["DELETE"])
def delete_transaction(txn_id):
    try:
        df = STATE["df"]
        if df is None or df.empty or "id" not in df.columns or txn_id not in df["id"].values:
            return jsonify({"error": f"Transaction with ID {txn_id} not found."}), 404

        STATE["df"] = df[df["id"] != txn_id].copy().reset_index(drop=True)
        remaining_count = len(STATE["df"])
        return jsonify({
            "message": "Transaction deleted.",
            "remaining_count": remaining_count
        })
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while deleting transaction."}), 500


@app.route("/api/categories", methods=["GET"])
def categories():
    df = STATE["df"]
    if df is None or df.empty:
        return jsonify({"categories": {}})
    return jsonify({"categories": txn.get_category_spending(df)})


@app.route("/api/monthly-summary", methods=["GET"])
def monthly_summary():
    df = STATE["df"]
    if df is None or df.empty:
        return jsonify({"months": []})
    return jsonify({"months": txn.get_monthly_summary(df)})


@app.route("/api/budget", methods=["POST"])
def budget_status():
    try:
        from tools import budget_tools
        df = STATE["df"]
        payload = request.get_json(force=True) or {}
        budgets = payload.get("budgets", {})
        if df is None or df.empty:
            return jsonify({"error": "No transaction data is loaded."}), 400
        if not budgets:
            return jsonify({"error": "No budgets were provided."}), 400
        STATE["budgets"] = budgets  # remembered so the autonomous monitor can check it too
        results = budget_tools.calculate_budget_status(df, budgets)
        return jsonify({"results": results})
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not calculate budget status."}), 500


@app.route("/api/goal", methods=["POST"])
def goal_endpoint():
    try:
        df = STATE["df"]
        payload = request.get_json(force=True) or {}
        target_amount = payload.get("target_amount")
        timeline_months = payload.get("timeline_months")
        current_savings = payload.get("current_savings", 0)

        if target_amount is None or timeline_months is None:
            return jsonify({"error": "target_amount and timeline_months are required."}), 400
        if df is None or df.empty:
            return jsonify({"error": "No transaction data is loaded."}), 400

        result = goal_tools_mod.analyze_savings_goal(
            df, float(target_amount), float(timeline_months), float(current_savings)
        )
        return jsonify(result)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not analyze savings goal."}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        payload = request.get_json(force=True) or {}
        message = (payload.get("message") or "").strip()
        budgets = payload.get("budgets")  # optional, from budget planner UI

        if not message:
            return jsonify({"error": "Message cannot be empty."}), 400

        if "chat_history" not in session:
            session["chat_history"] = []

        history = session["chat_history"]

        df = STATE["df"]
        result = agent.handle_message(message, df, history, budgets=budgets)

        history.append({"role": "user", "content": message[:200]})
        history.append({"role": "assistant", "content": result["answer"][:300]})
        session["chat_history"] = history[-6:]  # keep recent 6 turns for context
        session.modified = True

        return jsonify(result)
    except Exception:
        traceback.print_exc()
        return jsonify({
            "answer": "Something went wrong while processing your question. Please try again.",
            "sources": [], "tools_used": [], "data_used": False, "rag_used": False,
            "error": True,
        }), 500


@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():
    session["chat_history"] = []
    return jsonify({"message": "Chat history cleared."})


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "gemini_status": gemini_status,
        "rag_backend": rag_engine.backend,
        "rag_chunks_loaded": len(rag_engine.chunks),
        "data_source": STATE["source"],
        "transaction_count": txn.get_transaction_count(STATE["df"]) if STATE["df"] is not None else 0,
        "autonomous_monitor_last_checked": monitor.last_checked,
    })


@app.route("/api/alerts", methods=["GET"])
def alerts():
    """Alerts the autonomous monitor raised on its own, in the background —
    the frontend can poll this to show a notification without the user
    having to ask anything in chat first."""
    return jsonify({
        "alerts": monitor.latest_alerts,
        "last_checked": monitor.last_checked,
    })


@app.route("/api/alerts/dismiss", methods=["POST"])
def dismiss_alerts():
    monitor.latest_alerts = []
    return jsonify({"message": "Alerts cleared."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
