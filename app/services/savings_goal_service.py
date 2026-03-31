from datetime import datetime, date
from app.extensions import db
from app.models.savings_goal import SavingsGoal


def get_goals(user_id: int) -> list[dict]:
    goals = SavingsGoal.query.filter_by(user_id=user_id).order_by(SavingsGoal.created_at.desc()).all()
    return [g.to_dict() for g in goals]


def create_goal(user_id: int, data: dict) -> dict:
    name = data.get("name", "").strip()
    if not name:
        raise ValueError("Goal name is required")
    target = float(data.get("target_amount", 0))
    if target <= 0:
        raise ValueError("target_amount must be positive")

    deadline = None
    if data.get("deadline"):
        deadline = date.fromisoformat(data["deadline"])

    goal = SavingsGoal(
        user_id=user_id,
        name=name,
        target_amount=target,
        current_amount=float(data.get("current_amount", 0)),
        deadline=deadline,
        category=data.get("category"),
    )
    db.session.add(goal)
    db.session.commit()
    return goal.to_dict()


def update_goal(user_id: int, goal_id: int, data: dict) -> dict:
    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first()
    if not goal:
        raise LookupError("Goal not found")

    if "name" in data:
        goal.name = data["name"].strip()
    if "target_amount" in data:
        goal.target_amount = float(data["target_amount"])
    if "current_amount" in data:
        goal.current_amount = float(data["current_amount"])
    if "deadline" in data:
        goal.deadline = date.fromisoformat(data["deadline"]) if data["deadline"] else None
    if "category" in data:
        goal.category = data["category"]

    db.session.commit()
    return goal.to_dict()


def contribute(user_id: int, goal_id: int, amount: float) -> dict:
    if amount <= 0:
        raise ValueError("Amount must be positive")
    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first()
    if not goal:
        raise LookupError("Goal not found")
    goal.current_amount = min(goal.current_amount + amount, goal.target_amount)
    db.session.commit()
    return goal.to_dict()


def delete_goal(user_id: int, goal_id: int) -> None:
    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=user_id).first()
    if not goal:
        raise LookupError("Goal not found")
    db.session.delete(goal)
    db.session.commit()
