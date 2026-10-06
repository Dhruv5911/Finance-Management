"""
Savings goal calculation tools — deterministic arithmetic for goal planning.
"""
import pandas as pd
from typing import Dict

from tools.transaction_tools import get_savings, get_total_income, get_total_expenses


def analyze_savings_goal(df: pd.DataFrame, target_amount: float, timeline_months: float,
                          current_savings: float = 0.0) -> Dict:
    """
    Calculates what's needed to reach a savings goal, using actual transaction
    data to estimate current monthly savings capacity.
    """
    timeline_months = max(float(timeline_months), 0.01)
    remaining_amount = max(target_amount - current_savings, 0.0)
    required_monthly_saving = round(remaining_amount / timeline_months, 2)

    # Estimate current monthly savings capacity from loaded transaction data
    income = get_total_income(df)
    expenses = get_total_expenses(df)
    current_net_savings = get_savings(df)

    months_of_data = df["date"].dt.to_period("M").nunique() if not df.empty else 0
    estimated_monthly_savings_capacity = round(current_net_savings / months_of_data, 2) if months_of_data > 0 else 0.0

    savings_gap = round(required_monthly_saving - estimated_monthly_savings_capacity, 2)
    progress_percent = round((current_savings / target_amount) * 100, 2) if target_amount > 0 else 0.0

    return {
        "target_amount": round(float(target_amount), 2),
        "timeline_months": timeline_months,
        "current_savings": round(float(current_savings), 2),
        "remaining_amount": round(remaining_amount, 2),
        "required_monthly_saving": required_monthly_saving,
        "estimated_current_monthly_savings_capacity": estimated_monthly_savings_capacity,
        "savings_gap": savings_gap,
        "progress_percent": progress_percent,
        "is_currently_on_track": savings_gap <= 0,
        "total_income_in_data": income,
        "total_expenses_in_data": expenses,
    }
