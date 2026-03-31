from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import budget_service

budgets_bp = Blueprint("budgets", __name__)


@budgets_bp.route("", methods=["POST"])
@token_required
def create_budget(user_id):
    """POST /budgets — Set a monthly budget."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    amount = data.get("amount")
    month = data.get("month")

    if not all([amount, month]):
        return jsonify({"error": "amount and month are required"}), 400

    try:
        result = budget_service.create_budget(user_id, float(amount), month)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@budgets_bp.route("", methods=["GET"])
@token_required
def list_budgets(user_id):
    """GET /budgets — List all budgets with spent/remaining computed."""
    budgets = budget_service.get_budgets(user_id)
    return jsonify(budgets), 200
