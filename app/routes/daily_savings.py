from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import daily_savings_service

daily_savings_bp = Blueprint("daily_savings", __name__)


@daily_savings_bp.route("", methods=["GET"])
@token_required
def get_active(user_id):
    """GET /daily-savings — get active challenge status."""
    data = daily_savings_service.get_active(user_id)
    return jsonify(data), 200


@daily_savings_bp.route("/history", methods=["GET"])
@token_required
def get_history(user_id):
    """GET /daily-savings/history — all challenges (active + past)."""
    data = daily_savings_service.get_history(user_id)
    return jsonify(data), 200


@daily_savings_bp.route("/start", methods=["POST"])
@token_required
def start(user_id):
    """POST /daily-savings/start — start a new daily savings challenge."""
    body = request.json or {}
    try:
        amount = float(body.get("daily_amount", 0))
        data = daily_savings_service.start_challenge(user_id, amount)
        return jsonify(data), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@daily_savings_bp.route("/check-in", methods=["POST"])
@token_required
def check_in(user_id):
    """POST /daily-savings/check-in — log today's savings."""
    try:
        data = daily_savings_service.check_in(user_id)
        return jsonify(data), 200
    except (ValueError, LookupError) as e:
        return jsonify({"error": str(e)}), 400


@daily_savings_bp.route("/grace", methods=["POST"])
@token_required
def use_grace(user_id):
    """POST /daily-savings/grace — use grace day for yesterday's miss."""
    try:
        data = daily_savings_service.use_grace(user_id)
        return jsonify(data), 200
    except (ValueError, LookupError) as e:
        return jsonify({"error": str(e)}), 400


@daily_savings_bp.route("/stop", methods=["POST"])
@token_required
def stop(user_id):
    """POST /daily-savings/stop — end the active challenge."""
    try:
        data = daily_savings_service.stop_challenge(user_id)
        return jsonify(data), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
