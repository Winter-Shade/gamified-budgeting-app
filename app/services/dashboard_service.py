from sqlalchemy import func, cast, Date
from app.extensions import db
from app.models.account import Account
from app.models.expense import Expense
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from app.services.budget_service import get_current_budget_summary
from datetime import datetime, timezone, timedelta


def get_dashboard(user_id: int) -> dict:
    """
    Build the aggregated dashboard response:
    - total_balance, total_spent, remaining_budget
    - xp, level, gold (from wallet)
    - recent_transactions (last 5 expenses)
    - weekly_summary (daily totals for last 7 days)
    """
    # Total balance across all accounts
    total_balance = (
        db.session.query(func.coalesce(func.sum(Account.balance), 0.0))
        .filter(Account.user_id == user_id)
        .scalar()
    )

    # Total spent this month
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        start_of_next_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        start_of_next_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)

    total_spent = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= start_of_month,
            Expense.created_at < start_of_next_month,
        )
        .scalar()
    )

    # Budget info
    budget_summary = get_current_budget_summary(user_id)
    remaining_budget = budget_summary["remaining"] if budget_summary else None
    budget_amount = budget_summary["budget"] if budget_summary else None

    # Wallet info
    wallet = Wallet.query.filter_by(user_id=user_id).first()

    # Recent transactions (last 5 expenses)
    recent = (
        Expense.query.filter_by(user_id=user_id)
        .order_by(Expense.created_at.desc())
        .limit(5)
        .all()
    )

    # Weekly summary (daily totals for last 7 days)
    seven_days_ago = now - timedelta(days=7)
    weekly_data = (
        db.session.query(
            cast(Expense.created_at, Date).label("day"),
            func.sum(Expense.amount).label("total"),
        )
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= seven_days_ago,
        )
        .group_by(cast(Expense.created_at, Date))
        .order_by(cast(Expense.created_at, Date))
        .all()
    )

    weekly_summary = [
        {"date": day.isoformat(), "amount": round(float(total), 2)}
        for day, total in weekly_data
    ]

    account_count = (
        db.session.query(func.count(Account.id))
        .filter(Account.user_id == user_id)
        .scalar()
    )

    return {
        "total_balance": float(total_balance),
        "total_spent": float(total_spent),
        "remaining_budget": remaining_budget,
        "budget_amount": budget_amount,
        "xp": wallet.xp if wallet else 0,
        "level": wallet.level if wallet else 1,
        "gold": wallet.gold if wallet else 0,
        "recent_transactions": [e.to_dict() for e in recent],
        "weekly_summary": weekly_summary,
        "account_count": account_count,
    }
