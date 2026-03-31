from app.extensions import db
from datetime import datetime, timezone, date


class DailySavingsChallenge(db.Model):
    """One active Daily Savings Challenge per user at a time."""
    __tablename__ = "daily_savings_challenges"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    daily_amount = db.Column(db.Float, nullable=False)
    current_streak = db.Column(db.Integer, nullable=False, default=0)
    best_streak = db.Column(db.Integer, nullable=False, default=0)
    grace_used = db.Column(db.Boolean, nullable=False, default=False)
    last_log_date = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at = db.Column(db.DateTime, nullable=True)

    logs = db.relationship("DailySavingsLog", backref="challenge", lazy=True, cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        today = date.today()
        # Can check in if not logged today
        can_check_in = self.is_active and (self.last_log_date is None or self.last_log_date < today)
        # Can use grace if active, not already used, missed yesterday
        missed_yesterday = (
            self.last_log_date is not None
            and (today - self.last_log_date).days == 2  # missed exactly yesterday
        )
        can_use_grace = self.is_active and not self.grace_used and missed_yesterday

        return {
            "id": self.id,
            "user_id": self.user_id,
            "daily_amount": self.daily_amount,
            "current_streak": self.current_streak,
            "best_streak": self.best_streak,
            "grace_used": self.grace_used,
            "last_log_date": self.last_log_date.isoformat() if self.last_log_date else None,
            "is_active": self.is_active,
            "can_check_in": can_check_in,
            "can_use_grace": can_use_grace,
            "total_saved": round(self.current_streak * self.daily_amount, 2),
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class DailySavingsLog(db.Model):
    """Per-day check-in record."""
    __tablename__ = "daily_savings_logs"

    id = db.Column(db.Integer, primary_key=True)
    challenge_id = db.Column(db.Integer, db.ForeignKey("daily_savings_challenges.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    log_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(10), nullable=False, default="checked")  # checked | grace

    __table_args__ = (
        db.UniqueConstraint("challenge_id", "log_date", name="uq_daily_log"),
    )
