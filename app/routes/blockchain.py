from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import blockchain_service

blockchain_bp = Blueprint("blockchain", __name__)


@blockchain_bp.route("/plans", methods=["GET"])
@token_required
def list_plans(user_id):
    return jsonify(blockchain_service.get_plans(user_id)), 200


@blockchain_bp.route("/plans", methods=["POST"])
@token_required
def create_plan(user_id):
    try:
        plan = blockchain_service.create_plan(user_id, request.json or {})
        return jsonify(plan), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@blockchain_bp.route("/plans/<int:plan_id>/deposits", methods=["GET"])
@token_required
def list_deposits(user_id, plan_id):
    try:
        return jsonify(blockchain_service.get_deposits(user_id, plan_id)), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404


@blockchain_bp.route("/plans/<int:plan_id>/deposits", methods=["POST"])
@token_required
def record_deposit(user_id, plan_id):
    try:
        deposit = blockchain_service.record_deposit(user_id, plan_id, request.json or {})
        return jsonify(deposit), 201
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@blockchain_bp.route("/plans/<int:plan_id>/status", methods=["PUT"])
@token_required
def update_status(user_id, plan_id):
    try:
        data = request.json or {}
        plan = blockchain_service.update_plan_status(user_id, plan_id, data.get("status"))
        return jsonify(plan), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@blockchain_bp.route("/plans/<int:plan_id>/onchain", methods=["PUT"])
@token_required
def update_onchain(user_id, plan_id):
    try:
        plan = blockchain_service.update_plan_onchain(user_id, plan_id, request.json or {})
        return jsonify(plan), 200
    except LookupError as e:
        return jsonify({"error": str(e)}), 404


@blockchain_bp.route("/contract-info", methods=["GET"])
@token_required
def contract_info(user_id):
    """Return the deployed contract address and ABI for the frontend."""
    import json, os
    # Project root is two levels up from this file (app/routes/ -> project root)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    deploy_path = os.path.join(project_root, "blockchain", "deployment.json")
    abi_path = os.path.join(project_root, "blockchain", "artifacts", "contracts",
                            "CommitmentSavings.sol", "CommitmentSavings.json")

    result = {"address": None, "abi": None}

    if os.path.exists(deploy_path):
        with open(deploy_path) as f:
            result["address"] = json.load(f).get("address")

    if os.path.exists(abi_path):
        with open(abi_path) as f:
            result["abi"] = json.load(f).get("abi")

    return jsonify(result), 200
