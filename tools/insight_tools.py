"""
Insight tools — higher-level analysis that synthesises transaction data
into actionable bullet-point insights, a financial health score, and
an auto-suggested budget based on the 50/30/20 rule.

All maths is deterministic Python/pandas — never done by the LLM.
"""
import pandas as pd
from typing import Dict, List

from tools.transaction_tools import (
    get_total_income,
    get_total_expenses,
    get_balance,
    get_savings_rate,
    get_category_spending,
    get_largest_expenses,
    get_monthly_summary,
    get_average_monthly_spending,
    get_highest_spending_month,
    get_spending_trend,
)

# Categories treated as "needs" for 50/30/20 classification
NEEDS_CATEGORIES = {"Rent", "Utilities", "Groceries", "Healthcare", "Transport", "Education", "Insurance", "EMI"}
# Categories treated as "wants" / discretionary
WANTS_CATEGORIES = {"Food", "Entertainment", "Shopping", "Subscriptions", "Other", "Travel", "Dining"}


def generate_spending_insights(df: pd.DataFrame) -> List[str]:
    """
    Returns a list of plain-English insight strings derived deterministically
    from transaction data. Gemini can narrate these, or they can be shown as-is.
    """
    if df is None or df.empty:
        return ["No transaction data is available to generate insights."]

    insights = []

    income = get_total_income(df)
    expenses = get_total_expenses(df)
    balance = get_balance(df)
    savings_rate = get_savings_rate(df)
    cat_spending = get_category_spending(df)

    # Savings rate assessment
    if savings_rate >= 30:
        insights.append(f"Excellent savings rate of {savings_rate:.1f}% — you are saving a strong portion of your income.")
    elif savings_rate >= 20:
        insights.append(f"Good savings rate of {savings_rate:.1f}% — above the commonly recommended 20% target.")
    elif savings_rate >= 10:
        insights.append(f"Moderate savings rate of {savings_rate:.1f}% — consider finding ways to increase this toward 20%+.")
    elif savings_rate > 0:
        insights.append(f"Low savings rate of {savings_rate:.1f}% — reviewing discretionary spending could help increase savings significantly.")
    else:
        insights.append(f"Warning: Negative net cash flow — expenses (₹{expenses:,.0f}) exceed income (₹{income:,.0f}). This is unsustainable long-term.")

    # Top spending category
    if cat_spending:
        top_cat, top_amt = next(iter(cat_spending.items()))
        top_pct = round((top_amt / expenses) * 100, 1) if expenses > 0 else 0
        insights.append(f"Highest spending category: {top_cat} at ₹{top_amt:,.0f} ({top_pct}% of total expenses).")

    # Spending concentration — if top 2 categories > 60% of total
    if len(cat_spending) >= 2:
        top2_sum = sum(list(cat_spending.values())[:2])
        if expenses > 0 and (top2_sum / expenses) > 0.6:
            cats = list(cat_spending.keys())[:2]
            insights.append(f"Spending is concentrated: {cats[0]} and {cats[1]} together account for over 60% of all expenses. Diversifying or reducing one of these could improve flexibility.")

    # Monthly trend
    trend = get_spending_trend(df)
    if len(trend) >= 2:
        latest = trend[-1]
        pct_change = latest.get("expense_change_pct")
        if pct_change is not None:
            if pct_change > 15:
                insights.append(f"Expenses increased by {pct_change:.1f}% in {latest['month']} compared to the previous month — worth reviewing what drove this rise.")
            elif pct_change < -10:
                insights.append(f"Expenses decreased by {abs(pct_change):.1f}% in {latest['month']} compared to the previous month — good spending control.")

    # Highest spending month
    worst = get_highest_spending_month(df)
    if worst:
        insights.append(f"Highest spending month was {worst['month']} with ₹{worst['expenses']:,.0f} in expenses.")

    # Average monthly stats
    avg = get_average_monthly_spending(df)
    if avg:
        insights.append(
            f"On average across {avg['months_of_data']} month(s): "
            f"₹{avg['avg_monthly_income']:,.0f} income, ₹{avg['avg_monthly_expenses']:,.0f} expenses, "
            f"₹{avg['avg_monthly_net']:,.0f} net savings per month."
        )

    # Largest individual expense
    largest = get_largest_expenses(df, 1)
    if largest:
        lx = largest[0]
        insights.append(f"Single largest expense: ₹{lx['amount']:,.0f} — {lx['description']} ({lx['category']}) on {lx['date']}.")

    return insights


def get_financial_health_score(df: pd.DataFrame) -> Dict:
    """
    Returns a simple 0–100 financial health score with breakdown.
    Score components:
      - Savings rate (0–40 pts): 40 pts if >= 30%, scales linearly
      - Expense diversity (0–20 pts): penalty if top category > 50% of spend
      - Positive cash flow (0–20 pts): full points if balance > 0
      - Monthly stability (0–20 pts): penalty for high month-to-month expense variance
    """
    if df is None or df.empty:
        return {"score": 0, "grade": "N/A", "breakdown": {}, "note": "No data available."}

    savings_rate = get_savings_rate(df)
    cat_spending = get_category_spending(df)
    expenses = get_total_expenses(df)
    balance = get_balance(df)
    monthly = get_monthly_summary(df)

    # Savings rate score (0–40)
    sr_score = min(40, round((savings_rate / 30) * 40, 1)) if savings_rate > 0 else 0

    # Expense diversity score (0–20)
    if cat_spending and expenses > 0:
        top_cat_pct = list(cat_spending.values())[0] / expenses
        if top_cat_pct <= 0.35:
            div_score = 20
        elif top_cat_pct <= 0.50:
            div_score = 15
        elif top_cat_pct <= 0.65:
            div_score = 8
        else:
            div_score = 3
    else:
        div_score = 10  # no data to judge

    # Positive cash flow score (0–20)
    cf_score = 20 if balance >= 0 else 0

    # Monthly stability score (0–20): lower variance = more stable
    stability_score = 20
    if len(monthly) >= 2:
        expense_vals = [m["expenses"] for m in monthly]
        mean_exp = sum(expense_vals) / len(expense_vals)
        if mean_exp > 0:
            variance_pct = (max(expense_vals) - min(expense_vals)) / mean_exp * 100
            if variance_pct > 50:
                stability_score = 5
            elif variance_pct > 30:
                stability_score = 12
            elif variance_pct > 15:
                stability_score = 17

    total = round(sr_score + div_score + cf_score + stability_score, 1)
    total = min(100, total)

    if total >= 80:
        grade = "Excellent"
    elif total >= 65:
        grade = "Good"
    elif total >= 45:
        grade = "Fair"
    else:
        grade = "Needs Improvement"

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "savings_rate_score": sr_score,
            "expense_diversity_score": div_score,
            "positive_cash_flow_score": cf_score,
            "monthly_stability_score": stability_score,
        },
        "savings_rate_pct": savings_rate,
    }


def suggest_budget(df: pd.DataFrame) -> Dict:
    """
    Auto-suggest monthly category budgets based on 50/30/20 rule applied to
    the average monthly income from actual transaction data.
    Returns suggested allocations and compares to actual spending.
    """
    if df is None or df.empty:
        return {"error": "No transaction data available for budget suggestion."}

    avg = get_average_monthly_spending(df)
    if not avg or avg["avg_monthly_income"] <= 0:
        return {"error": "Cannot suggest budget — no income data found."}

    avg_income = avg["avg_monthly_income"]
    needs_budget = round(avg_income * 0.50, 2)
    wants_budget = round(avg_income * 0.30, 2)
    savings_target = round(avg_income * 0.20, 2)

    # Current actual spending breakdown
    cat_spending = get_category_spending(df)
    months = avg["months_of_data"]
    actual_monthly = {k: round(v / months, 2) for k, v in cat_spending.items()} if months > 0 else {}

    actual_needs = sum(v for k, v in actual_monthly.items() if k in NEEDS_CATEGORIES)
    actual_wants = sum(v for k, v in actual_monthly.items() if k in WANTS_CATEGORIES)

    return {
        "avg_monthly_income": avg_income,
        "rule": "50/30/20",
        "suggested": {
            "needs_50pct": needs_budget,
            "wants_30pct": wants_budget,
            "savings_20pct": savings_target,
        },
        "actual_monthly_avg": {
            "needs_spending": round(actual_needs, 2),
            "wants_spending": round(actual_wants, 2),
            "net_savings": avg["avg_monthly_net"],
        },
        "category_suggested_budgets": {
            cat: round(amount / months, 2)
            for cat, amount in cat_spending.items()
        },
    }
