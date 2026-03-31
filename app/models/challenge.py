from app.extensions import db
from datetime import datetime, timezone


class Challenge(db.Model):
    __tablename__ = "challenges"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    type = db.Column(db.String(30), nullable=False)  # streak | budget_limit | no_spend
    target_value = db.Column(db.Float, nullable=False, default=0)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reward_xp = db.Column(db.Integer, nullable=False, default=10)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        db.CheckConstraint(
            "type IN ('streak', 'budget_limit', 'no_spend')",
            name="ck_challenge_type",
        ),
    )

    participants = db.relationship(
        "ChallengeParticipant", backref="challenge", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "type": self.type,
            "target_value": self.target_value,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "reward_xp": self.reward_xp,
            "created_by": self.created_by,
            "participant_count": len(self.participants) if self.participants else 0,
        }
