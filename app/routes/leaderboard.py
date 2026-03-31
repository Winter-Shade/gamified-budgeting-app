from flask import Blueprint, request, jsonify
from app.services import leaderboard_service

leaderboard_bp = Blueprint("leaderboard", __name__)


@leaderboard_bp.route("", methods=["GET"])
def get_leaderboard():
    """GET /leaderboard — Top users ranked by XP. Public endpoint."""
    limit = request.args.get("limit", 10, type=int)
    data = leaderboard_service.get_leaderboard(limit=limit)
    return jsonify(data), 200
