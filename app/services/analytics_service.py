"""
Analytics Service — comprehensive spending insights.

Endpoints return:
  - category_breakdown      : pie chart (category → total spent)
  - daily_trend             : line chart (last 30 days of spending)
  - budget_vs_actual        : budget target vs actual spent %
  - monthly_comparison      : this month vs same month last year / previous month
  - spending_velocity       : projected spend vs budget (are you on track?)
  - weekly_avg              : average weekly spend for selected month
  - top_category            : highest-spend category this month
"""
from datetime import datetime, timezone, timedelta, date as date_type
from calendar import monthrange
from sqlalchemy import func, cast, Date, extract
from app.extensions import db
from app.models.expense import Expense
from app.models.category import Category
from app.services.budget_service import get_current_budget_summary


def get_analytics(user_id: int, month: str | None = None) -> dict:
    """Build comprehensive analytics response for the given month (default: current)."""
    year, mon = _parse_month(month)
    start, end = _month_range(year, mon)

    category_breakdown = _category_breakdown(user_id, start, end)
    daily_trend = _daily_trend(user_id)
    budget_vs_actual = _budget_vs_actual(user_id, year, mon, category_breakdown)
    monthly_comparison = _monthly_comparison(user_id, year, mon)
    spending_velocity = _spending_velocity(user_id, year, mon, budget_vs_actual)
    weekly_avg = _weekly_avg(user_id, start, end, year, mon)

    total_month = sum(item["value"] for item in category_breakdown)
    top_category = max(category_breakdown, key=lambda x: x["value"], default=None)

    return {
        "month": f"{year:04d}-{mon:02d}",
        "total_spent_month": round(total_month, 2),
        "category_breakdown": category_breakdown,
        "daily_trend": daily_trend,
        "budget_vs_actual": budget_vs_actual,
        "monthly_comparison": monthly_comparison,
        "spending_velocity": spending_velocity,
        "weekly_avg": weekly_avg,
        "top_category": top_category,
    }


def get_monthly_summary(user_id: int, months: int = 6) -> list[dict]:
    """Return month-by-month spending totals for the past N months."""
    result = []
    now = datetime.now(timezone.utc)
    for i in range(months - 1, -1, -1):
        # Step backwards month by month
        target = now - timedelta(days=30 * i)
        year, mon = target.year, target.month
        start, end = _month_range(year, mon)
        total = (
            db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
            .filter(
                Expense.user_id == user_id,
                Expense.expense_at >= start,
                Expense.expense_at < end,
            )
            .scalar()
        )
        result.append({
            "month": f"{year:04d}-{mon:02d}",
            "total": round(float(total), 2),
        })
    return result


# ── Private helpers ────────────────────────────────────────────────────────────

def _parse_month(month: str | None) -> tuple[int, int]:
    if month:
        try:
            year, mon = map(int, month.split("-"))
            return year, mon
        except (ValueError, AttributeError):
            raise ValueError("Month must be in YYYY-MM format")
    now = datetime.now(timezone.utc)
    return now.year, now.month


def _month_range(year: int, mon: int) -> tuple[datetime, datetime]:
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    if mon == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, mon + 1, 1, tzinfo=timezone.utc)
    return start, end


def _category_breakdown(user_id: int, start: datetime, end: datetime) -> list[dict]:
    rows = (
        db.session.query(
            Category.name,
            func.coalesce(func.sum(Expense.amount), 0.0).label("total"),
        )
        .join(Expense, Expense.category_id == Category.id)
        .filter(
            Expense.user_id == user_id,
            Expense.expense_at >= start,
            Expense.expense_at < end,
        )
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )
    return [{"name": name, "value": round(float(total), 2)} for name, total in rows]


def _daily_trend(user_id: int) -> list[dict]:
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (
        db.session.query(
            cast(Expense.expense_at, Date).label("day"),
            func.sum(Expense.amount).label("total"),
        )
        .filter(
            Expense.user_id == user_id,
            Expense.expense_at >= thirty_days_ago,
        )
        .group_by(cast(Expense.expense_at, Date))
        .order_by(cast(Expense.expense_at, Date))
        .all()
    )
    return [{"date": day.isoformat(), "amount": round(float(total), 2)} for day, total in rows]


def _budget_vs_actual(user_id: int, year: int, mon: int, category_breakdown: list[dict]) -> dict | None:
    now = datetime.now(timezone.utc)
    if year == now.year and mon == now.month:
        budget_summary = get_current_budget_summary(user_id)
    else:
        # Historical month — look up budget for that month
        from app.models.budget import Budget
        budget = Budget.query.filter_by(user_id=user_id, month=f"{year:04d}-{mon:02d}").first()
        if not budget:
            return None
        total_spent = sum(c["value"] for c in category_breakdown)
        budget_summary = {
            "budget": budget.amount,
            "spent": total_spent,
            "remaining": budget.amount - total_spent,
        }

    if not budget_summary:
        return None

    pct = round((budget_summary["spent"] / budget_summary["budget"]) * 100, 1) if budget_summary["budget"] > 0 else 0
    return {
        "budget": budget_summary["budget"],
        "spent": budget_summary["spent"],
        "remaining": budget_summary["remaining"],
        "percentage": pct,
        "status": "over" if pct > 100 else ("warning" if pct > 80 else "good"),
    }


def _monthly_comparison(user_id: int, year: int, mon: int) -> dict:
    """Compare current month with previous month and same month last year."""
    start, end = _month_range(year, mon)
    this_total = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.expense_at >= start, Expense.expense_at < end)
        .scalar()
    )

    # Previous month
    if mon == 1:
        prev_year, prev_mon = year - 1, 12
    else:
        prev_year, prev_mon = year, mon - 1
    prev_start, prev_end = _month_range(prev_year, prev_mon)
    prev_total = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.expense_at >= prev_start, Expense.expense_at < prev_end)
        .scalar()
    )

    # Same month last year
    ly_start, ly_end = _month_range(year - 1, mon)
    ly_total = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.expense_at >= ly_start, Expense.expense_at < ly_end)
        .scalar()
    )

    this_f = float(this_total)
    prev_f = float(prev_total)
    ly_f = float(ly_total)

    def pct_change(current, previous):
        if previous == 0:
            return None
        return round(((current - previous) / previous) * 100, 1)

    return {
        "this_month": round(this_f, 2),
        "previous_month": round(prev_f, 2),
        "previous_month_label": f"{prev_year:04d}-{prev_mon:02d}",
        "vs_previous_month_pct": pct_change(this_f, prev_f),
        "same_month_last_year": round(ly_f, 2),
        "vs_last_year_pct": pct_change(this_f, ly_f),
    }


def _spending_velocity(user_id: int, year: int, mon: int, budget_vs_actual: dict | None) -> dict:
    """
    Project end-of-month spending based on daily average so far.
    Returns: projected_total, days_elapsed, days_in_month, on_track (bool)
    """
    now = datetime.now(timezone.utc)
    days_in_month = monthrange(year, mon)[1]

    if year == now.year and mon == now.month:
        days_elapsed = now.day
    else:
        days_elapsed = days_in_month  # Historical month — full data

    start, end = _month_range(year, mon)
    total_so_far = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.expense_at >= start, Expense.expense_at < end)
        .scalar()
    )
    total_so_far = float(total_so_far)

    daily_avg = total_so_far / days_elapsed if days_elapsed > 0 else 0.0
    projected = round(daily_avg * days_in_month, 2)

    on_track = None
    if budget_vs_actual and budget_vs_actual.get("budget"):
        on_track = projected <= budget_vs_actual["budget"]

    return {
        "days_elapsed": days_elapsed,
        "days_in_month": days_in_month,
        "daily_avg": round(daily_avg, 2),
        "projected_total": projected,
        "on_track": on_track,
    }


def _weekly_avg(user_id: int, start: datetime, end: datetime, year: int, mon: int) -> float:
    """Average weekly spending for the month."""
    total = (
        db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.user_id == user_id, Expense.expense_at >= start, Expense.expense_at < end)
        .scalar()
    )
    days_in_month = monthrange(year, mon)[1]
    weeks = days_in_month / 7
    return round(float(total) / weeks, 2) if weeks > 0 else 0.0
