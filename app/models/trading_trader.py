from app.extensions import db
from datetime import datetime, timezone

VALID_MODELS = ("gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash")
VALID_INTERVALS = ("manual", "hourly", "every_6h", "every_12h", "daily", "weekly")


class TradingTrader(db.Model):
    __tablename__ = "trading_traders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    account_id = db.Column(
        db.Integer, db.ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.String(100), nullable=False)
    identity = db.Column(db.Text, nullable=True)  # Personality / character description
    strategy = db.Column(db.Text, nullable=False)  # Investment strategy instructions
    model = db.Column(db.String(80), nullable=False, default="gemini-2.0-flash")

    # Scheduling
    schedule_interval = db.Column(db.String(20), nullable=False, default="manual")
    schedule_active = db.Column(db.Boolean, nullable=False, default=False)
    last_run_at = db.Column(db.DateTime, nullable=True)
    next_run_at = db.Column(db.DateTime, nullable=True)
    run_count = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    holdings = db.relationship(
        "TradingHolding", backref="trader", lazy=True, cascade="all, delete-orphan"
    )
    transactions = db.relationship(
        "TradingTransaction", backref="trader", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self, include_holdings=False):
        d = {
            "id": self.id,
            "user_id": self.user_id,
            "account_id": self.account_id,
            "name": self.name,
            "identity": self.identity,
            "strategy": self.strategy,
            "model": self.model,
            "schedule_interval": self.schedule_interval,
            "schedule_active": self.schedule_active,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
            "run_count": self.run_count,
            "created_at": self.created_at.isoformat(),
        }
        if include_holdings:
            d["holdings"] = [h.to_dict() for h in self.holdings]
        return d
