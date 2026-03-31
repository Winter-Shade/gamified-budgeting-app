from flask import Blueprint, request, jsonify
from sqlalchemy import func, cast, Date
from app.routes import token_required
from app.extensions import db
from app.models.expense import Expense
from datetime import datetime, timezone

calendar_bp = Blueprint("calendar", __name__)


@calendar_bp.route("", methods=["GET"])
@token_required
def get_calendar(user_id):
    """
    GET /calendar?month=YYYY-MM
    Return daily spend aggregated for a heatmap calendar.
    """
    month = request.args.get("month")
    now = datetime.now(timezone.utc)

    if month:
        try:
            year, mon = map(int, month.split("-"))
        except ValueError:
            return jsonify({"error": "Month must be in YYYY-MM format"}), 400
    else:
        year, mon = now.year, now.month

    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    if mon == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    daily_data = (
        db.session.query(
            cast(Expense.expense_at, Date).label("day"),
            func.sum(Expense.amount).label("total"),
            func.count(Expense.id).label("count"),
        )
        .filter(
            Expense.user_id == user_id,
            Expense.expense_at >= start,
            Expense.expense_at < end,
        )
        .group_by(cast(Expense.expense_at, Date))
        .order_by(cast(Expense.expense_at, Date))
        .all()
    )

    days = [
        {
            "date": day.isoformat(),
            "amount": round(float(total), 2),
            "count": count,
        }
        for day, total, count in daily_data
    ]

    return jsonify({
        "month": f"{year:04d}-{mon:02d}",
        "days": days,
    }), 200
