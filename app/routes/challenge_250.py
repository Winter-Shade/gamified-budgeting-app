from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import challenge_250_service

challenge_250_bp = Blueprint("challenge_250", __name__)


@challenge_250_bp.route("", methods=["GET"])
@token_required
def get_status(user_id):
    """GET /challenge-250 — get current 250-challenge status."""
    data = challenge_250_service.get_status(user_id)
    return jsonify(data), 200


@challenge_250_bp.route("/start", methods=["POST"])
@token_required
def start(user_id):
    """POST /challenge-250/start — start or reset the 250 challenge."""
    body = request.json or {}
    try:
        data = challenge_250_service.start_challenge(
            user_id,
            mode=body.get("mode", "manual"),
            account_id=body.get("account_id"),
        )
        return jsonify(data), 201
    except (ValueError, LookupError) as e:
        return jsonify({"error": str(e)}), 400


@challenge_250_bp.route("/check", methods=["POST"])
@token_required
def check_step(user_id):
    """POST /challenge-250/check — mark a step as done."""
    body = request.json or {}
    try:
        step = int(body.get("step", 0))
        data = challenge_250_service.check_step(user_id, step)
        return jsonify(data), 200
    except (ValueError, LookupError) as e:
        return jsonify({"error": str(e)}), 400


@challenge_250_bp.route("/uncheck", methods=["POST"])
@token_required
def uncheck_step(user_id):
    """POST /challenge-250/uncheck — uncheck a step."""
    body = request.json or {}
    try:
        step = int(body.get("step", 0))
        data = challenge_250_service.uncheck_step(user_id, step)
        return jsonify(data), 200
    except (ValueError, LookupError) as e:
        return jsonify({"error": str(e)}), 400


@challenge_250_bp.route("/reset", methods=["POST"])
@token_required
def reset(user_id):
    """POST /challenge-250/reset — clear all checked steps."""
    try:
        data = challenge_250_service.reset_challenge(user_id)
        return jsonify(data), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
