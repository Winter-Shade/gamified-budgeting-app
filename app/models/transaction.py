from app.extensions import db
from datetime import datetime, timezone

VALID_TRANSACTION_TYPES = (
    "EXPENSE_REWARD",
    "STREAK_REWARD",
    "CHALLENGE_COMPLETE",
    "BUDGET_DISCIPLINE",
)


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Type is validated at application level for extensibility
    type = db.Column(db.String(30), nullable=False)
    xp_change = db.Column(db.Integer, default=0, nullable=False)
    gold_change = db.Column(db.Integer, default=0, nullable=False)
    reference_id = db.Column(db.Integer, nullable=True)
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "xp_change": self.xp_change,
            "gold_change": self.gold_change,
            "reference_id": self.reference_id,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
        }
