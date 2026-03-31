from app.extensions import db
from datetime import datetime, timezone


class ChallengeParticipant(db.Model):
    __tablename__ = "challenge_participants"

    id = db.Column(db.Integer, primary_key=True)
    challenge_id = db.Column(
        db.Integer, db.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    progress_value = db.Column(db.Float, default=0, nullable=False)
    status = db.Column(db.String(20), default="active", nullable=False)
    joined_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("challenge_id", "user_id", name="uq_challenge_user"),
        db.CheckConstraint(
            "status IN ('active', 'completed', 'failed')",
            name="ck_participant_status",
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "challenge_id": self.challenge_id,
            "user_id": self.user_id,
            "progress_value": self.progress_value,
            "status": self.status,
            "joined_at": self.joined_at.isoformat(),
        }
