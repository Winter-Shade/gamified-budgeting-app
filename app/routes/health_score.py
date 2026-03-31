from flask import jsonify
from flask import Blueprint
from app.routes import token_required
from app.services import health_score_service

health_score_bp = Blueprint("health_score", __name__)


@health_score_bp.route("", methods=["GET"])
@token_required
def get_health_score(user_id):
    """GET /health-score — financial health score with sub-component breakdown."""
    data = health_score_service.get_health_score(user_id)
    return jsonify(data), 200
