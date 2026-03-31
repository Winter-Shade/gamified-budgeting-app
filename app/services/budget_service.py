from datetime import datetime, timezone
from sqlalchemy import func
from app.extensions import db
from app.models.budget import Budget
from app.models.expense import Expense


def create_budget(user_id: int, amount: float, month: str) -> dict:
    """
    Create a monthly budget. Only one budget per user per month.
    month format: YYYY-MM
    """
    if amount <= 0:
        raise ValueError("Budget amount must be positive")

    # Validate month format
    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise ValueError("Month must be in YYYY-MM format")

    existing = Budget.query.filter_by(user_id=user_id, month=month).first()
    if existing:
        existing.amount = amount
        db.session.commit()
        return existing.to_dict()

    budget = Budget(user_id=user_id, amount=amount, month=month)
    db.session.add(budget)
    db.session.commit()
    return budget.to_dict()


def get_budgets(user_id: int) -> list[dict]:
    """Return all budgets for the user with computed spent/remaining."""
    budgets = Budget.query.filter_by(user_id=user_id).order_by(Budget.month.desc()).all()
    result = []
    for b in budgets:
        spent = _get_monthly_spend(user_id, b.month)
        result.append({
            **b.to_dict(),
            "spent": spent,
            "remaining": b.amount - spent,
        })
    return result


def get_current_budget_summary(user_id: int) -> dict | None:
    """Return current month's budget summary or None if no budget set."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    budget = Budget.query.filter_by(user_id=user_id, month=current_month).first()
    if not budget:
        return None

    spent = _get_monthly_spend(user_id, current_month)
    return {
        "budget": budget.amount,
        "spent": spent,
        "remaining": budget.amount - spent,
    }


def _get_monthly_spend(user_id: int, month: str) -> float:
    """Compute SUM(expenses) for a given user and month."""
    # Parse month boundaries
    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    if mon == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    total = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= start,
            Expense.created_at < end,
        )
        .scalar()
    )
    return float(total)
