"""
Carbon Footprint Service — computes CO₂ equivalent from expense data.

Emission factors are in kg CO₂ per ₹100 spent (see carbon_emission_factor.py).
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy import func, cast, Date
from app.extensions import db
from app.models.expense import Expense
from app.models.category import Category
from app.models.carbon_emission_factor import get_factor


def get_monthly_carbon(user_id: int, month: str | None = None) -> dict:
    """Return total CO₂ for the month, broken down by category."""
    year, mon = _parse_month(month)
    start, end = _month_range(year, mon)

    rows = (
        db.session.query(Category.name, func.sum(Expense.amount).label("total"))
        .join(Expense, Expense.category_id == Category.id)
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= start,
            Expense.created_at < end,
        )
        .group_by(Category.name)
        .all()
    )

    breakdown = []
    total_co2 = 0.0
    for cat_name, amount in rows:
        factor = get_factor(cat_name)
        co2 = round(float(amount) / 100 * factor, 3)
        total_co2 += co2
        breakdown.append({
            "category": cat_name,
            "amount_spent": round(float(amount), 2),
            "emission_factor": factor,
            "co2_kg": co2,
        })

    breakdown.sort(key=lambda x: x["co2_kg"], reverse=True)

    return {
        "month": f"{year:04d}-{mon:02d}",
        "total_co2_kg": round(total_co2, 2),
        "breakdown": breakdown,
        "equivalent_trees": round(total_co2 / 21.7, 2),  # avg tree absorbs ~21.7 kg CO2/yr
    }


def get_carbon_trend(user_id: int, months: int = 6) -> list[dict]:
    """Return month-by-month CO₂ totals for the last N months."""
    result = []
    now = datetime.now(timezone.utc)

    for i in range(months - 1, -1, -1):
        target = now - timedelta(days=30 * i)
        year, mon = target.year, target.month
        start, end = _month_range(year, mon)

        rows = (
            db.session.query(Category.name, func.sum(Expense.amount).label("total"))
            .join(Expense, Expense.category_id == Category.id)
            .filter(
                Expense.user_id == user_id,
                Expense.created_at >= start,
                Expense.created_at < end,
            )
            .group_by(Category.name)
            .all()
        )

        total_co2 = sum(float(amount) / 100 * get_factor(cat) for cat, amount in rows)
        result.append({
            "month": f"{year:04d}-{mon:02d}",
            "co2_kg": round(total_co2, 2),
        })

    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=timezone.utc)
    return start, end
