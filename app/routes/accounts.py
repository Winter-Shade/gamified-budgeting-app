from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import account_service

accounts_bp = Blueprint("accounts", __name__)


@accounts_bp.route("", methods=["POST"])
@token_required
def create_account(user_id):
    """POST /accounts — Create a new account for the authenticated user."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    name = data.get("name")
    balance = data.get("balance", 0.0)
    account_type = data.get("type")

    if not all([name, account_type]):
        return jsonify({"error": "name and type are required"}), 400

    try:
        result = account_service.create_account(user_id, name, float(balance), account_type)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@accounts_bp.route("", methods=["GET"])
@token_required
def list_accounts(user_id):
    """GET /accounts — List all accounts for the authenticated user."""
    accounts = account_service.get_accounts(user_id)
    return jsonify(accounts), 200


@accounts_bp.route("/<int:account_id>/deposit", methods=["POST"])
@token_required
def deposit(user_id, account_id):
    """POST /accounts/<id>/deposit — Credit an account (log income)."""
    data = request.get_json(silent=True) or {}
    amount = data.get("amount")
    if amount is None:
        return jsonify({"error": "amount is required"}), 400
    try:
        result = account_service.deposit(user_id, account_id, float(amount),
                                         source=data.get("source", "other"),
                                         description=data.get("description"))
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
