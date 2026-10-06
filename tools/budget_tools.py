"""
Budget-related deterministic calculations.
Budgets are supplied by the user (per category, monthly amount) and compared
against actual spending computed from the loaded transaction data.
"""
import pandas as pd
from typing import Dict, List

from tools.transaction_tools import get_category_spending, get_category_total

# Categories generally considered discretionary (not essential) for estimation purposes.
DISCRETIONARY_CATEGORIES = {"Food", "Entertainment", "Shopping", "Other", "Subscriptions"}


def calculate_category_budget_status(df: pd.DataFrame, category: str, budget_amount: float) -> Dict:
    actual = get_category_total(df, category)
    remaining = round(budget_amount - actual, 2)
    status = "Within budget" if actual <= budget_amount else "Over budget"
    return {
        "category": category,
        "budget": round(float(budget_amount), 2),
        "actual": actual,
        "remaining": remaining,
        "status": status,
    }


def calculate_budget_status(df: pd.DataFrame, budgets: Dict[str, float]) -> List[Dict]:
    """budgets: {"Food": 5000, "Transport": 2000, ...}"""
    return [calculate_category_budget_status(df, cat, amt) for cat, amt in budgets.items()]


def identify_over_budget_categories(df: pd.DataFrame, budgets: Dict[str, float]) -> List[Dict]:
    results = calculate_budget_status(df, budgets)
    return [r for r in results if r["status"] == "Over budget"]


def estimate_discretionary_spending(df: pd.DataFrame) -> Dict:
    category_spending = get_category_spending(df)
    discretionary_total = 0.0
    breakdown = {}
    for cat, amt in category_spending.items():
        if cat in DISCRETIONARY_CATEGORIES:
            discretionary_total += amt
            breakdown[cat] = amt
    return {
        "discretionary_total": round(discretionary_total, 2),
        "breakdown": breakdown,
    }


def calculate_potential_savings(df: pd.DataFrame, reduction_percent: float = 20.0) -> Dict:
    """
    Estimates potential monthly savings if discretionary spending were reduced
    by a given percentage. This is an illustrative estimate, not a guarantee.
    """
    discretionary = estimate_discretionary_spending(df)
    potential = round(discretionary["discretionary_total"] * (reduction_percent / 100), 2)
    return {
        "current_discretionary_spending": discretionary["discretionary_total"],
        "reduction_percent_assumed": reduction_percent,
        "estimated_potential_savings": potential,
        "breakdown": discretionary["breakdown"],
    }
