from app.extensions import db
from datetime import datetime, timezone


class SavingsGoal(db.Model):
    __tablename__ = "savings_goals"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, nullable=False, default=0.0)
    deadline = db.Column(db.Date, nullable=True)
    category = db.Column(db.String(60), nullable=True)  # e.g. "travel", "emergency", "gadget"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        days_left = None
        if self.deadline:
            today = datetime.now(timezone.utc).date()
            days_left = (self.deadline - today).days

        progress_pct = round((self.current_amount / self.target_amount) * 100, 1) if self.target_amount > 0 else 0

        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "target_amount": self.target_amount,
            "current_amount": self.current_amount,
            "remaining_amount": round(self.target_amount - self.current_amount, 2),
            "progress_pct": progress_pct,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "days_left": days_left,
            "category": self.category,
            "created_at": self.created_at.isoformat(),
            "completed": self.current_amount >= self.target_amount,
        }
