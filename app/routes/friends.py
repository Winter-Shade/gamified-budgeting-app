from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.extensions import db
from app.models.friendship import Friendship
from app.models.user import User

friends_bp = Blueprint("friends", __name__)


@friends_bp.route("", methods=["GET"])
@token_required
def list_friends(user_id):
    """GET /friends — List all friends (accepted) for the user."""
    friendships = Friendship.query.filter(
        db.or_(
            db.and_(Friendship.user_id == user_id, Friendship.status == "accepted"),
            db.and_(Friendship.friend_id == user_id, Friendship.status == "accepted"),
        )
    ).all()

    friends = []
    for f in friendships:
        friend_user_id = f.friend_id if f.user_id == user_id else f.user_id
        friend_user = User.query.get(friend_user_id)
        if friend_user:
            friends.append({
                "friendship_id": f.id,
                "user_id": friend_user.id,
                "username": friend_user.username,
                "status": f.status,
                "since": f.created_at.isoformat(),
            })

    return jsonify(friends), 200


@friends_bp.route("", methods=["POST"])
@token_required
def add_friend(user_id):
    """POST /friends — Send a friend request (auto-accepted for now)."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    friend_username = data.get("username")
    if not friend_username:
        return jsonify({"error": "username is required"}), 400

    friend = User.query.filter_by(username=friend_username).first()
    if not friend:
        return jsonify({"error": "User not found"}), 404

    if friend.id == user_id:
        return jsonify({"error": "Cannot add yourself as a friend"}), 400

    existing = Friendship.query.filter(
        db.or_(
            db.and_(Friendship.user_id == user_id, Friendship.friend_id == friend.id),
            db.and_(Friendship.user_id == friend.id, Friendship.friend_id == user_id),
        )
    ).first()

    if existing:
        return jsonify({"error": "Friendship already exists"}), 409

    friendship = Friendship(
        user_id=user_id,
        friend_id=friend.id,
        status="accepted",  # Auto-accept for basic structure
    )
    db.session.add(friendship)
    db.session.commit()

    return jsonify({
        "friendship_id": friendship.id,
        "friend": friend.to_dict(),
        "status": friendship.status,
    }), 201
