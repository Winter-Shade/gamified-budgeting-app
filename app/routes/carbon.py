from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import carbon_service

carbon_bp = Blueprint("carbon", __name__)


@carbon_bp.route("/monthly", methods=["GET"])
@token_required
def monthly_carbon(user_id):
    """GET /carbon/monthly?month=YYYY-MM — CO₂ breakdown for the month."""
    month = request.args.get("month")
    try:
        data = carbon_service.get_monthly_carbon(user_id, month)
        return jsonify(data), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@carbon_bp.route("/trend", methods=["GET"])
@token_required
def carbon_trend(user_id):
    """GET /carbon/trend?months=6 — month-by-month CO₂ trend."""
    try:
        months = int(request.args.get("months", 6))
        months = max(1, min(months, 24))
    except ValueError:
        return jsonify({"error": "months must be an integer"}), 400

    data = carbon_service.get_carbon_trend(user_id, months)
    return jsonify(data), 200
