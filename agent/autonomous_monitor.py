"""
Autonomous monitor — the part of FinAI that acts without being asked.

Every AUTONOMOUS_CHECK_MINUTES, this checks the currently loaded transaction
data against saved budgets and the financial health score, and — only when
something actually changed or crossed a threshold — asks Gemini to write a
short proactive insight. Results sit in memory for the frontend to poll via
GET /api/alerts, so the UI can show a badge/notification without the user
ever having to open the chat and ask.

Runs as a single lightweight APScheduler background job — no external
infra, no separate worker process, safe to run inside the Flask dev server.
"""
import json
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler

from tools import budget_tools as budget
from tools import insight_tools as insight


class AutonomousMonitor:
    def __init__(self, get_state: Callable[[], Dict], gemini_client=None, gemini_model: str = ""):
        """
        get_state: zero-arg callable returning {"df": DataFrame|None, "budgets": dict|None}
                   (kept as a callable, not a snapshot, so the monitor always
                   sees the app's *current* data/budgets, including after a
                   new CSV upload).
        """
        self.get_state = get_state
        self.gemini_client = gemini_client
        self.gemini_model = gemini_model

        self.latest_alerts: List[Dict] = []
        self.last_checked: Optional[str] = None
        self._last_health_score: Optional[int] = None
        self._last_over_budget: set = set()

        self._scheduler = BackgroundScheduler(daemon=True)

    def start(self, interval_minutes: int):
        self._scheduler.add_job(
            self.check_once,
            "interval",
            minutes=interval_minutes,
            next_run_time=datetime.now(timezone.utc),  # also run once immediately at startup
            id="finai_autonomous_check",
            replace_existing=True,
        )
        self._scheduler.start()

    def check_once(self):
        """Runs one autonomous check. Only produces alerts for NEW conditions —
        re-running with nothing changed keeps latest_alerts empty rather than
        re-firing the same alert every interval."""
        self.last_checked = datetime.now(timezone.utc).isoformat()
        state = self.get_state() or {}
        df = state.get("df")
        budgets = state.get("budgets") or {}

        if df is None or df.empty:
            return

        new_alerts: List[Dict] = []

        # --- Health score drop ---
        health = insight.get_financial_health_score(df)
        score = health.get("score")
        if self._last_health_score is not None and score is not None and score < self._last_health_score - 5:
            new_alerts.append({
                "type": "health_drop",
                "severity": "warning",
                "message_facts": {"previous_score": self._last_health_score, "current_score": score,
                                   "breakdown": health.get("breakdown")},
            })
        self._last_health_score = score

        # --- Budget overruns (only newly-crossed categories, not repeats) ---
        if budgets:
            over_budget = budget.identify_over_budget_categories(df, budgets)
            over_names = {o["category"] for o in over_budget}
            newly_over = over_names - self._last_over_budget
            if newly_over:
                new_entries = [o for o in over_budget if o["category"] in newly_over]
                new_alerts.append({
                    "type": "budget_overrun",
                    "severity": "alert",
                    "message_facts": {"categories": new_entries},
                })
            self._last_over_budget = over_names

        if not new_alerts:
            return

        for a in new_alerts:
            a["narrative"] = self._narrate(a)
            a["timestamp"] = self.last_checked

        self.latest_alerts = new_alerts + self.latest_alerts
        self.latest_alerts = self.latest_alerts[:20]  # keep it bounded

    def _narrate(self, alert: Dict) -> str:
        """Turn the raw alert facts into a short human sentence — via Gemini
        if available, otherwise a plain deterministic template."""
        facts = alert["message_facts"]

        if self.gemini_client:
            try:
                prompt = (
                    "Write ONE short (<= 2 sentence), friendly but direct proactive alert for a personal "
                    "finance app user, in markdown, using ₹ with Indian number formatting. "
                    f"Alert type: {alert['type']}. Facts: {json.dumps(facts, default=str)}. "
                    "Do not invent any numbers not present in the facts."
                )
                response = self.gemini_client.models.generate_content(model=self.gemini_model, contents=prompt)
                text = getattr(response, "text", None)
                if text and text.strip():
                    return text.strip()
            except Exception:
                pass

        if alert["type"] == "health_drop":
            return (f"⚠️ Your financial health score dropped from {facts['previous_score']} "
                    f"to {facts['current_score']}.")
        if alert["type"] == "budget_overrun":
            names = ", ".join(c["category"] for c in facts["categories"])
            return f"🔻 You've gone over budget in: {names}."
        return "New alert."
