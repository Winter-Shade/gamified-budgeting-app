from app.extensions import db
from datetime import datetime, timezone


class Streak(db.Model):
    __tablename__ = "streaks"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type = db.Column(db.String(20), nullable=False)  # weekly | monthly
    current_streak = db.Column(db.Integer, default=0, nullable=False)
    longest_streak = db.Column(db.Integer, default=0, nullable=False)
    last_updated = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "type", name="uq_user_streak_type"),
        db.CheckConstraint(
            "type IN ('weekly', 'monthly')", name="ck_streak_type"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "last_updated": self.last_updated.isoformat(),
        }
