from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import savings_goal_service

savings_goals_bp = Blueprint("savings_goals", __name__)


@savings_goals_bp.route("", methods=["GET"])
@token_required
def list_goals(user_id):
    """GET /goals — list all savings goals for the user."""
    return jsonify(savings_goal_service.get_goals(user_id)), 200


@savings_goals_bp.route("", methods=["POST"])
@token_required
def create_goal(user_id):
    """POST /goals — create a new savings goal."""
    try:
        goal = savings_goal_service.create_goal(user_id, request.json or {})
        return jsonify(goal), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@savings_goals_bp.route("/<int:goal_id>", methods=["PUT"])
@token_required
def update_goal(user_id, goal_id):
    """PUT /goals/<id> — update a savings goal."""
    try:
        goal = savings_goal_service.update_goal(user_id, goal_id, request.json or {})
        return jsonify(goal), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@savings_goals_bp.route("/<int:goal_id>", methods=["DELETE"])
@token_required
def delete_goal(user_id, goal_id):
    """DELETE /goals/<id>."""
    try:
        savings_goal_service.delete_goal(user_id, goal_id)
        return jsonify({"message": "Goal deleted"}), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404


@savings_goals_bp.route("/<int:goal_id>/contribute", methods=["POST"])
@token_required
def contribute(user_id, goal_id):
    """POST /goals/<id>/contribute — add money to a goal."""
    data = request.json or {}
    try:
        amount = float(data.get("amount", 0))
        goal = savings_goal_service.contribute(user_id, goal_id, amount)
        return jsonify(goal), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
