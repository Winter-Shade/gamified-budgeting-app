import json
from app.extensions import db
from datetime import datetime, timezone


class Challenge250(db.Model):
    """
    1-250 Savings Challenge — one row per user.
    Each step N contributes ₹N. Total = ₹31,375.
    Modes:
      manual   — user self-tracks; we just mark steps as done.
      transfer — each check deducts ₹N from linked account.
    """
    __tablename__ = "challenge_250"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    mode = db.Column(db.String(10), nullable=False, default="manual")  # manual | transfer
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    _checked_steps = db.Column("checked_steps", db.Text, nullable=False, default="[]")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)

    @property
    def checked_steps(self) -> list[int]:
        return json.loads(self._checked_steps)

    @checked_steps.setter
    def checked_steps(self, value: list[int]):
        self._checked_steps = json.dumps(sorted(set(value)))

    def to_dict(self) -> dict:
        steps = self.checked_steps
        total_saved = sum(steps)
        pct = round(total_saved / 31375 * 100, 1)
        return {
            "id": self.id,
            "user_id": self.user_id,
            "mode": self.mode,
            "account_id": self.account_id,
            "checked_steps": steps,
            "steps_done": len(steps),
            "total_steps": 250,
            "total_saved": total_saved,
            "target_total": 31375,
            "progress_pct": pct,
            "completed": len(steps) == 250,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
