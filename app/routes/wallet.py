from flask import jsonify
from app.routes import token_required
from app.services import wallet_service
from flask import Blueprint

wallet_bp = Blueprint("wallet", __name__)


@wallet_bp.route("", methods=["GET"])
@token_required
def get_wallet(user_id):
    """GET /wallet — Return XP, Gold, Level, and level progress for the authenticated user."""
    try:
        data = wallet_service.get_wallet(user_id)
        return jsonify(data), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
