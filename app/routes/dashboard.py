from flask import Blueprint, jsonify
from app.routes import token_required
from app.services import dashboard_service

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("", methods=["GET"])
@token_required
def get_dashboard(user_id):
    """GET /dashboard — Aggregated dashboard data."""
    data = dashboard_service.get_dashboard(user_id)
    return jsonify(data), 200
