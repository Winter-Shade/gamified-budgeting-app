from flask import Blueprint, request, jsonify
from datetime import date
from app.routes import token_required
from app.extensions import db
from app.models.subscription import Subscription

subscriptions_bp = Blueprint("subscriptions", __name__)

VALID_CYCLES = {"monthly", "weekly", "yearly", "quarterly"}


@subscriptions_bp.route("", methods=["GET"])
@token_required
def list_subscriptions(user_id):
    subs = Subscription.query.filter_by(user_id=user_id).order_by(Subscription.name).all()
    items = [s.to_dict() for s in subs]
    active = [s for s in subs if s.is_active]
    total_monthly = round(sum(s.monthly_equivalent() for s in active), 2)
    total_yearly  = round(total_monthly * 12, 2)
    return jsonify({
        "subscriptions": items,
        "summary": {
            "total_monthly": total_monthly,
            "total_yearly": total_yearly,
            "active_count": len(active),
        }
    }), 200


@subscriptions_bp.route("", methods=["POST"])
@token_required
def create_subscription(user_id):
    data = request.get_json(silent=True) or {}
    name   = data.get("name", "").strip()
    amount = data.get("amount")
    cycle  = data.get("billing_cycle", "monthly")

    if not name or amount is None:
        return jsonify({"error": "name and amount are required"}), 400
    if cycle not in VALID_CYCLES:
        return jsonify({"error": f"billing_cycle must be one of {sorted(VALID_CYCLES)}"}), 400

    nbd_str = data.get("next_billing_date")
    nbd = None
    if nbd_str:
        try:
            nbd = date.fromisoformat(nbd_str)
        except ValueError:
            return jsonify({"error": "next_billing_date must be YYYY-MM-DD"}), 400

    sub = Subscription(
        user_id=user_id,
        name=name,
        amount=float(amount),
        billing_cycle=cycle,
        next_billing_date=nbd,
        category=data.get("category"),
        color=data.get("color"),
        is_active=data.get("is_active", True),
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify(sub.to_dict()), 201


@subscriptions_bp.route("/<int:sub_id>", methods=["PUT"])
@token_required
def update_subscription(user_id, sub_id):
    sub = Subscription.query.filter_by(id=sub_id, user_id=user_id).first()
    if not sub:
        return jsonify({"error": "Subscription not found"}), 404

    data = request.get_json(silent=True) or {}

    if "name" in data:
        sub.name = data["name"].strip()
    if "amount" in data:
        sub.amount = float(data["amount"])
    if "billing_cycle" in data:
        if data["billing_cycle"] not in VALID_CYCLES:
            return jsonify({"error": f"billing_cycle must be one of {sorted(VALID_CYCLES)}"}), 400
        sub.billing_cycle = data["billing_cycle"]
    if "next_billing_date" in data:
        nbd_str = data["next_billing_date"]
        if nbd_str:
            try:
                sub.next_billing_date = date.fromisoformat(nbd_str)
            except ValueError:
                return jsonify({"error": "next_billing_date must be YYYY-MM-DD"}), 400
        else:
            sub.next_billing_date = None
    if "category" in data:
        sub.category = data["category"]
    if "color" in data:
        sub.color = data["color"]
    if "is_active" in data:
        sub.is_active = bool(data["is_active"])

    db.session.commit()
    return jsonify(sub.to_dict()), 200


@subscriptions_bp.route("/<int:sub_id>", methods=["DELETE"])
@token_required
def delete_subscription(user_id, sub_id):
    sub = Subscription.query.filter_by(id=sub_id, user_id=user_id).first()
    if not sub:
        return jsonify({"error": "Subscription not found"}), 404
    db.session.delete(sub)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200
