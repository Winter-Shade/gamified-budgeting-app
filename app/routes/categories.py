from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from sqlalchemy import func
from app.routes import token_required
from app.extensions import db
from app.models.category import Category
from app.models.category_budget import CategoryBudget
from app.models.expense import Expense
from app.services.category_service import get_user_categories

categories_bp = Blueprint("categories", __name__)


@categories_bp.route("", methods=["GET"])
@token_required
def list_categories(user_id):
    month = request.args.get("month", datetime.now(timezone.utc).strftime("%Y-%m"))
    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + 1 if mon == 12 else year, 1 if mon == 12 else mon + 1, 1, tzinfo=timezone.utc)

    cats = get_user_categories(user_id)  # auto-seeds defaults if none exist

    spending = dict(
        db.session.query(Expense.category_id, func.sum(Expense.amount))
        .filter(Expense.user_id == user_id, Expense.expense_at >= start, Expense.expense_at < end)
        .group_by(Expense.category_id).all()
    )
    cat_budgets = {
        cb.category_id: cb.amount
        for cb in CategoryBudget.query.filter_by(user_id=user_id, month=month).all()
    }

    result = []
    for c in cats:
        spent  = round(float(spending.get(c.id, 0)), 2)
        budget = cat_budgets.get(c.id)
        result.append({
            **c.to_dict(),
            "spent":     spent,
            "budget":    budget,
            "remaining": round(budget - spent, 2) if budget is not None else None,
            "pct":       round(min(100, spent / budget * 100), 1) if budget else None,
        })
    return jsonify(result), 200


@categories_bp.route("", methods=["POST"])
@token_required
def create_category(user_id):
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    # Check name uniqueness for this user
    if Category.query.filter_by(name=name, user_id=user_id).first():
        return jsonify({"error": f"You already have a category named '{name}'"}), 409

    cat = Category(name=name, user_id=user_id, color=data.get("color"), icon=data.get("icon"))
    db.session.add(cat)
    db.session.commit()
    return jsonify({**cat.to_dict(), "spent": 0, "budget": None, "remaining": None, "pct": None}), 201


@categories_bp.route("/<int:cat_id>", methods=["PUT"])
@token_required
def update_category(user_id, cat_id):
    cat = Category.query.filter_by(id=cat_id, user_id=user_id).first()
    if not cat:
        return jsonify({"error": "Category not found"}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = data["name"].strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        # Check uniqueness (excluding self)
        clash = Category.query.filter(
            Category.name == name,
            Category.user_id == user_id,
            Category.id != cat_id,
        ).first()
        if clash:
            return jsonify({"error": f"A category named '{name}' already exists"}), 409
        cat.name = name
    if "icon" in data:
        cat.icon = data["icon"] or None
    if "color" in data:
        cat.color = data["color"] or None

    db.session.commit()
    return jsonify(cat.to_dict()), 200


@categories_bp.route("/<int:cat_id>", methods=["DELETE"])
@token_required
def delete_category(user_id, cat_id):
    cat = Category.query.filter_by(id=cat_id, user_id=user_id).first()
    if not cat:
        return jsonify({"error": "Category not found"}), 404

    # Re-assign the user's expenses in this category to "Other" (last category)
    other = Category.query.filter(
        Category.user_id == user_id,
        Category.id != cat_id,
    ).order_by(Category.id.desc()).first()

    if other:
        Expense.query.filter_by(user_id=user_id, category_id=cat_id).update(
            {"category_id": other.id}
        )

    db.session.delete(cat)
    db.session.commit()
    return jsonify({"deleted": True}), 200


@categories_bp.route("/<int:cat_id>/budget", methods=["POST"])
@token_required
def set_category_budget(user_id, cat_id):
    data = request.get_json(silent=True) or {}
    amount = data.get("amount")
    month  = data.get("month", datetime.now(timezone.utc).strftime("%Y-%m"))

    if amount is None:
        return jsonify({"error": "amount is required"}), 400
    if float(amount) < 0:
        return jsonify({"error": "amount must be non-negative"}), 400

    existing = CategoryBudget.query.filter_by(user_id=user_id, category_id=cat_id, month=month).first()
    if existing:
        existing.amount = float(amount)
    else:
        db.session.add(CategoryBudget(user_id=user_id, category_id=cat_id, month=month, amount=float(amount)))
    db.session.commit()
    return jsonify({"category_id": cat_id, "month": month, "amount": float(amount)}), 200


@categories_bp.route("/<int:cat_id>/budget", methods=["DELETE"])
@token_required
def delete_category_budget(user_id, cat_id):
    month = request.args.get("month", datetime.now(timezone.utc).strftime("%Y-%m"))
    cb = CategoryBudget.query.filter_by(user_id=user_id, category_id=cat_id, month=month).first()
    if cb:
        db.session.delete(cb)
        db.session.commit()
    return jsonify({"deleted": True}), 200
