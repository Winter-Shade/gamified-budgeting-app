from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import analytics_service

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("", methods=["GET"])
@token_required
def get_analytics(user_id):
    """
    GET /analytics?month=YYYY-MM
    Full analytics: category breakdown, daily trend, budget vs actual,
    monthly comparison, spending velocity, weekly avg, top category.
    """
    month = request.args.get("month")
    try:
        data = analytics_service.get_analytics(user_id, month=month)
        return jsonify(data), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@analytics_bp.route("/monthly-summary", methods=["GET"])
@token_required
def monthly_summary(user_id):
    """
    GET /analytics/monthly-summary?months=6
    Month-by-month spending totals for the past N months (default 6).
    Useful for bar/line charts showing spending trends.
    """
    try:
        months = int(request.args.get("months", 6))
        months = max(1, min(months, 24))
    except ValueError:
        return jsonify({"error": "months must be an integer"}), 400

    data = analytics_service.get_monthly_summary(user_id, months=months)
    return jsonify(data), 200
