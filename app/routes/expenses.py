from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import expense_service

expenses_bp = Blueprint("expenses", __name__)


@expenses_bp.route("", methods=["POST"])
@token_required
def add_expense(user_id):
    """POST /expenses — Add an expense. No XP awarded."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    account_id = data.get("account_id")
    category_id = data.get("category_id")
    amount = data.get("amount")
    description = data.get("description")

    if not all([account_id, category_id, amount]):
        return jsonify({"error": "account_id, category_id, and amount are required"}), 400

    try:
        result = expense_service.add_expense(
            user_id, int(account_id), int(category_id), float(amount),
            description=description,
        )
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@expenses_bp.route("", methods=["GET"])
@token_required
def list_expenses(user_id):
    """GET /expenses — List all expenses for the authenticated user."""
    category_id = request.args.get("category_id", type=int)
    expenses = expense_service.get_expenses(user_id, category_id=category_id)
    return jsonify(expenses), 200


@expenses_bp.route("/<int:expense_id>", methods=["PUT"])
@token_required
def update_expense(user_id, expense_id):
    """PUT /expenses/<id> — Update an expense."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    try:
        result = expense_service.update_expense(user_id, expense_id, **data)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@expenses_bp.route("/<int:expense_id>", methods=["DELETE"])
@token_required
def delete_expense(user_id, expense_id):
    """DELETE /expenses/<id> — Delete an expense and refund the account."""
    try:
        result = expense_service.delete_expense(user_id, expense_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
