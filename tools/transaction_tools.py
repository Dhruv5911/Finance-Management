"""
Deterministic transaction analysis tools.

All financial arithmetic happens here in Python/pandas — never in the LLM —
so numbers reported to the user are always exactly correct for the loaded data.
Each function accepts a pandas DataFrame with columns:
date (datetime64), description, category, type ('income'/'expense'), amount (float)
"""
import pandas as pd
from typing import Dict, List


def _expenses(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["type"] == "expense"]


def _income(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["type"] == "income"]


def get_total_income(df: pd.DataFrame) -> float:
    return round(float(_income(df)["amount"].sum()), 2)


def get_total_expenses(df: pd.DataFrame) -> float:
    return round(float(_expenses(df)["amount"].sum()), 2)


def get_balance(df: pd.DataFrame) -> float:
    return round(get_total_income(df) - get_total_expenses(df), 2)


def get_savings(df: pd.DataFrame) -> float:
    """Savings is treated as net cash flow (income - expenses)."""
    return get_balance(df)


def get_savings_rate(df: pd.DataFrame) -> float:
    income = get_total_income(df)
    if income <= 0:
        return 0.0
    return round((get_savings(df) / income) * 100, 2)


def get_category_spending(df: pd.DataFrame) -> Dict[str, float]:
    exp = _expenses(df)
    if exp.empty:
        return {}
    grouped = exp.groupby("category")["amount"].sum().sort_values(ascending=False)
    return {k: round(float(v), 2) for k, v in grouped.items()}


def get_category_total(df: pd.DataFrame, category: str) -> float:
    exp = _expenses(df)
    match = exp[exp["category"].str.lower() == category.lower()]
    return round(float(match["amount"].sum()), 2)


def get_largest_expenses(df: pd.DataFrame, n: int = 5) -> List[Dict]:
    exp = _expenses(df).sort_values("amount", ascending=False).head(n)
    return exp[["date", "description", "category", "amount"]].assign(
        date=lambda d: d["date"].dt.strftime("%Y-%m-%d")
    ).to_dict(orient="records")


def get_recent_transactions(df: pd.DataFrame, n: int = 10) -> List[Dict]:
    if df is None or df.empty:
        return []
    cols = ["id", "date", "description", "category", "type", "amount"] if "id" in df.columns else ["date", "description", "category", "type", "amount"]
    recent = df.sort_values("date", ascending=False).head(n)
    return recent[cols].assign(
        date=lambda d: d["date"].dt.strftime("%Y-%m-%d") if "date" in d.columns else ""
    ).to_dict(orient="records")


def get_monthly_summary(df: pd.DataFrame) -> List[Dict]:
    if df.empty:
        return []
    tmp = df.copy()
    tmp["month"] = tmp["date"].dt.to_period("M").astype(str)
    summary = []
    for month, group in tmp.groupby("month"):
        income = round(float(group[group["type"] == "income"]["amount"].sum()), 2)
        expenses = round(float(group[group["type"] == "expense"]["amount"].sum()), 2)
        summary.append({
            "month": month,
            "income": income,
            "expenses": expenses,
            "net": round(income - expenses, 2),
        })
    return sorted(summary, key=lambda x: x["month"])


def compare_months(df: pd.DataFrame, month_a: str, month_b: str) -> Dict:
    """month_a/month_b format: 'YYYY-MM'"""
    tmp = df.copy()
    tmp["month"] = tmp["date"].dt.to_period("M").astype(str)

    def summarize(m):
        group = tmp[tmp["month"] == m]
        income = round(float(group[group["type"] == "income"]["amount"].sum()), 2)
        expenses = round(float(group[group["type"] == "expense"]["amount"].sum()), 2)
        return {"month": m, "income": income, "expenses": expenses, "net": round(income - expenses, 2)}

    a = summarize(month_a)
    b = summarize(month_b)
    return {
        "month_a": a,
        "month_b": b,
        "expense_difference": round(a["expenses"] - b["expenses"], 2),
        "income_difference": round(a["income"] - b["income"], 2),
    }


def search_transactions(df: pd.DataFrame, keyword: str) -> List[Dict]:
    if not keyword:
        return []
    mask = df["description"].str.contains(keyword, case=False, na=False) | \
        df["category"].str.contains(keyword, case=False, na=False)
    matches = df[mask].sort_values("date", ascending=False)
    return matches[["date", "description", "category", "type", "amount"]].assign(
        date=lambda d: d["date"].dt.strftime("%Y-%m-%d")
    ).to_dict(orient="records")


def get_transaction_count(df: pd.DataFrame) -> int:
    return int(len(df))


def get_available_months(df: pd.DataFrame) -> List[str]:
    if df.empty:
        return []
    return sorted(df["date"].dt.to_period("M").astype(str).unique().tolist())


def get_spending_trend(df: pd.DataFrame) -> List[Dict]:
    """Month-over-month expense change with % difference."""
    monthly = get_monthly_summary(df)
    if len(monthly) < 2:
        return monthly
    for i in range(1, len(monthly)):
        prev = monthly[i - 1]["expenses"]
        curr = monthly[i]["expenses"]
        if prev > 0:
            monthly[i]["expense_change_pct"] = round(((curr - prev) / prev) * 100, 2)
        else:
            monthly[i]["expense_change_pct"] = 0.0
    monthly[0]["expense_change_pct"] = None
    return monthly


def get_top_income_sources(df: pd.DataFrame, n: int = 5) -> List[Dict]:
    """Top N income categories/descriptions by total amount."""
    inc = _income(df)
    if inc.empty:
        return []
    grouped = inc.groupby("category")["amount"].sum().sort_values(ascending=False).head(n)
    return [{"category": k, "total": round(float(v), 2)} for k, v in grouped.items()]


def get_expenses_by_month(df: pd.DataFrame, year_month: str) -> Dict:
    """Return income, expenses, net, and category breakdown for a specific month (YYYY-MM)."""
    tmp = df.copy()
    tmp["month"] = tmp["date"].dt.to_period("M").astype(str)
    group = tmp[tmp["month"] == year_month]
    if group.empty:
        return {"month": year_month, "found": False}
    income = round(float(group[group["type"] == "income"]["amount"].sum()), 2)
    expenses = round(float(group[group["type"] == "expense"]["amount"].sum()), 2)
    cat_breakdown = {
        k: round(float(v), 2)
        for k, v in group[group["type"] == "expense"].groupby("category")["amount"].sum().items()
    }
    return {
        "month": year_month,
        "found": True,
        "income": income,
        "expenses": expenses,
        "net": round(income - expenses, 2),
        "category_breakdown": cat_breakdown,
    }


def get_average_monthly_spending(df: pd.DataFrame) -> Dict:
    """Average monthly income, expenses, and net across all months in the data."""
    monthly = get_monthly_summary(df)
    if not monthly:
        return {}
    avg_income = round(sum(m["income"] for m in monthly) / len(monthly), 2)
    avg_expenses = round(sum(m["expenses"] for m in monthly) / len(monthly), 2)
    avg_net = round(sum(m["net"] for m in monthly) / len(monthly), 2)
    return {
        "months_of_data": len(monthly),
        "avg_monthly_income": avg_income,
        "avg_monthly_expenses": avg_expenses,
        "avg_monthly_net": avg_net,
    }


def get_highest_spending_month(df: pd.DataFrame) -> Dict:
    """Return the month with the highest total expense."""
    monthly = get_monthly_summary(df)
    if not monthly:
        return {}
    worst = max(monthly, key=lambda m: m["expenses"])
    return worst

