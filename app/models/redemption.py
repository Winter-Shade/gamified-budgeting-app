from app.extensions import db
from datetime import datetime, timezone


class Redemption(db.Model):
    __tablename__ = "redemptions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reward_id = db.Column(
        db.Integer, db.ForeignKey("rewards_catalog.id", ondelete="CASCADE"), nullable=False
    )
    gold_spent = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default="completed", nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.CheckConstraint(
            "status IN ('pending', 'completed', 'refunded')",
            name="ck_redemption_status",
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "reward_id": self.reward_id,
            "gold_spent": self.gold_spent,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
