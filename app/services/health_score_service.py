"""
Financial Health Score — composite score from 5 sub-dimensions.

Weights:
  Savings Rate         30%
  Budget Adherence     25%
  Goal Progress        20%
  Spending Consistency 15%
  Emergency Buffer     10%

Each sub-score is 0-100; final score is a weighted average (0-100).
"""
from datetime import datetime, timezone, timedelta
from calendar import monthrange
from sqlalchemy import func
from app.extensions import db
from app.models.expense import Expense
from app.models.savings_goal import SavingsGoal


def get_health_score(user_id: int) -> dict:
    now = datetime.now(timezone.utc)
    year, mon = now.year, now.month
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    savings_rate_score, savings_rate_detail       = _savings_rate_score(user_id, start, end)
    budget_adherence_score, budget_adherence_detail = _budget_adherence_score(user_id, year, mon)
    goal_progress_score, goal_progress_detail     = _goal_progress_score(user_id)
    consistency_score, consistency_detail         = _consistency_score(user_id)
    emergency_score, emergency_detail             = _emergency_buffer_score(user_id)

    total = round(
        savings_rate_score    * 0.30 +
        budget_adherence_score * 0.25 +
        goal_progress_score   * 0.20 +
        consistency_score     * 0.15 +
        emergency_score       * 0.10,
        1
    )

    return {
        "score": total,
        "grade": _grade(total),
        "components": {
            "savings_rate":    {"score": savings_rate_score,    "weight": 30, **savings_rate_detail},
            "budget_adherence": {"score": budget_adherence_score, "weight": 25, **budget_adherence_detail},
            "goal_progress":   {"score": goal_progress_score,   "weight": 20, **goal_progress_detail},
            "consistency":     {"score": consistency_score,     "weight": 15, **consistency_detail},
            "emergency_buffer": {"score": emergency_score,       "weight": 10, **emergency_detail},
        },
    }


def _grade(score: float) -> str:
    if score >= 85: return "Excellent"
    if score >= 70: return "Good"
    if score >= 55: return "Fair"
    if score >= 40: return "Needs Work"
    return "Poor"


# ── Sub-score helpers ──────────────────────────────────────────────────────────

def _savings_rate_score(user_id: int, start: datetime, end: datetime) -> tuple[float, dict]:
    """
    Score based on what fraction of income wasn't spent.
    We approximate income as total balance across accounts + spent.
    If budget is set, we use it as a proxy for income.
    """
    from app.models.budget import Budget
    from app.models.account import Account

    now = datetime.now(timezone.utc)
    year, mon = now.year, now.month

    total_spent = float(
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.created_at >= start, Expense.created_at < end)
        .scalar()
    )

    budget = Budget.query.filter_by(user_id=user_id, month=f"{year:04d}-{mon:02d}").first()
    total_balance = float(
        db.session.query(func.coalesce(func.sum(Account.balance), 0.0))
        .filter(Account.user_id == user_id)
        .scalar()
    )

    # Use budget as proxy for monthly income if available
    if budget and budget.amount > 0:
        income_proxy = budget.amount
    elif total_balance > 0:
        income_proxy = total_balance * 0.1  # rough monthly income estimate
    else:
        return 50.0, {"detail": "Insufficient data"}

    savings = max(0, income_proxy - total_spent)
    rate = savings / income_proxy if income_proxy > 0 else 0

    # Ideal savings rate: 20%+ = 100, 10% = 60, 0% = 20
    if rate >= 0.20:
        score = 100.0
    elif rate >= 0.10:
        score = 60 + (rate - 0.10) / 0.10 * 40
    else:
        score = 20 + rate / 0.10 * 40

    return round(score, 1), {"savings_rate_pct": round(rate * 100, 1), "detail": f"{round(rate*100,1)}% saved this month"}


def _budget_adherence_score(user_id: int, year: int, mon: int) -> tuple[float, dict]:
    from app.models.budget import Budget

    budget = Budget.query.filter_by(user_id=user_id, month=f"{year:04d}-{mon:02d}").first()
    if not budget or budget.amount == 0:
        return 50.0, {"detail": "No budget set"}

    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    spent = float(
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.created_at >= start, Expense.created_at < end)
        .scalar()
    )

    pct_used = spent / budget.amount
    if pct_used <= 0.70:
        score = 100.0
    elif pct_used <= 1.0:
        score = 100 - ((pct_used - 0.70) / 0.30) * 60
    else:
        over_pct = pct_used - 1.0
        score = max(0, 40 - over_pct * 100)

    return round(score, 1), {"spent_pct": round(pct_used * 100, 1), "detail": f"{round(pct_used*100,1)}% of budget used"}


def _goal_progress_score(user_id: int) -> tuple[float, dict]:
    goals = SavingsGoal.query.filter_by(user_id=user_id).all()
    if not goals:
        return 50.0, {"detail": "No savings goals set"}

    active = [g for g in goals if g.current_amount < g.target_amount]
    completed = len(goals) - len(active)

    if not active:
        return 100.0, {"detail": "All goals completed!", "completed": completed, "active": 0}

    avg_progress = sum(g.current_amount / g.target_amount for g in active) / len(active)
    score = round(avg_progress * 100, 1)
    return score, {"detail": f"{round(avg_progress*100,1)}% avg progress", "completed": completed, "active": len(active)}


def _consistency_score(user_id: int) -> tuple[float, dict]:
    """
    Score based on how consistent spending is day-to-day (lower variance = better).
    We look at the last 30 days.
    """
    thirty_ago = datetime.now(timezone.utc) - timedelta(days=30)
    from sqlalchemy import cast, Date

    rows = (
        db.session.query(func.sum(Expense.amount))
        .filter(Expense.user_id == user_id, Expense.created_at >= thirty_ago)
        .group_by(cast(Expense.created_at, Date))
        .all()
    )
    amounts = [float(r[0]) for r in rows if r[0]]

    if len(amounts) < 3:
        return 50.0, {"detail": "Not enough data yet"}

    mean = sum(amounts) / len(amounts)
    variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
    cv = (variance ** 0.5) / mean if mean > 0 else 0  # coefficient of variation

    # Low CV = consistent; CV < 0.5 = great, CV > 2.0 = poor
    if cv <= 0.5:
        score = 100.0
    elif cv <= 2.0:
        score = 100 - ((cv - 0.5) / 1.5) * 70
    else:
        score = 30.0

    return round(score, 1), {"detail": f"Spending variance: {'low' if cv <= 0.5 else 'medium' if cv <= 1.0 else 'high'}"}


def _emergency_buffer_score(user_id: int) -> tuple[float, dict]:
    """
    Score based on how many months of expenses the current balance covers.
    3+ months = 100, 1 month = 50, 0 = 0.
    """
    from app.models.account import Account

    total_balance = float(
        db.session.query(func.coalesce(func.sum(Account.balance), 0.0))
        .filter(Account.user_id == user_id)
        .scalar()
    )

    now = datetime.now(timezone.utc)
    three_months_ago = now - timedelta(days=90)
    total_3mo = float(
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.created_at >= three_months_ago)
        .scalar()
    )
    avg_monthly = total_3mo / 3 if total_3mo > 0 else 0

    if avg_monthly == 0:
        return 50.0, {"detail": "Not enough expense data"}

    months_covered = total_balance / avg_monthly
    if months_covered >= 3:
        score = 100.0
    elif months_covered >= 1:
        score = 50 + (months_covered - 1) / 2 * 50
    else:
        score = months_covered / 1 * 50

    return round(score, 1), {"months_covered": round(months_covered, 1), "detail": f"{round(months_covered,1)} months of expenses covered"}
