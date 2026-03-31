from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import challenge_service

challenges_bp = Blueprint("challenges", __name__)


@challenges_bp.route("", methods=["GET"])
@token_required
def list_challenges(user_id):
    """GET /challenges — List all active challenges with user's participation status."""
    data = challenge_service.list_challenges(user_id=user_id)
    return jsonify(data), 200


@challenges_bp.route("/mine", methods=["GET"])
@token_required
def my_challenges(user_id):
    """GET /challenges/mine — Challenges the user has joined."""
    data = challenge_service.get_my_challenges(user_id=user_id)
    return jsonify(data), 200


@challenges_bp.route("", methods=["POST"])
@token_required
def create_challenge(user_id):
    """POST /challenges — Create a new challenge."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    required = ["title", "type", "target_value", "start_date", "end_date", "reward_xp"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        result = challenge_service.create_challenge(
            title=data["title"],
            description=data.get("description", ""),
            challenge_type=data["type"],
            target_value=float(data["target_value"]),
            start_date=data["start_date"],
            end_date=data["end_date"],
            reward_xp=int(data["reward_xp"]),
            created_by=user_id,
        )
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@challenges_bp.route("/<int:challenge_id>/join", methods=["POST"])
@token_required
def join_challenge(user_id, challenge_id):
    """POST /challenges/<id>/join — Join a challenge."""
    try:
        result = challenge_service.join_challenge(user_id, challenge_id)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@challenges_bp.route("/eco-templates", methods=["GET"])
@token_required
def eco_templates(user_id):
    """GET /challenges/eco-templates — preset eco challenge templates."""
    from app.services.eco_templates import get_templates
    return jsonify(get_templates()), 200


@challenges_bp.route("/check-completions", methods=["POST"])
@token_required
def check_completions(user_id):
    """
    POST /challenges/check-completions
    Manually trigger completion checks for ended challenges.
    Returns list of newly completed/failed challenges.
    """
    events = []
    events += challenge_service.check_and_complete_budget_challenges(user_id)
    events += challenge_service.check_and_complete_no_spend_challenges(user_id)
    from app.extensions import db
    db.session.commit()
    return jsonify({"events": events}), 200
