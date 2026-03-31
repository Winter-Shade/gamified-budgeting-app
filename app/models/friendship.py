from app.extensions import db
from datetime import datetime, timezone


class Friendship(db.Model):
    __tablename__ = "friendships"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    friend_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status = db.Column(db.String(20), default="pending", nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "friend_id", name="uq_friendship"),
        db.CheckConstraint(
            "status IN ('pending', 'accepted')", name="ck_friendship_status"
        ),
        db.CheckConstraint(
            "user_id != friend_id", name="ck_no_self_friend"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "friend_id": self.friend_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
