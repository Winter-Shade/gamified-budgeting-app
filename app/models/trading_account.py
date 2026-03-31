from app.extensions import db
from datetime import datetime, timezone


class TradingAccount(db.Model):
    __tablename__ = "trading_accounts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.String(100), nullable=False, default="My Trading Account")
    initial_balance = db.Column(db.Float, nullable=False, default=10000.0)
    cash_balance = db.Column(db.Float, nullable=False, default=10000.0)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    traders = db.relationship(
        "TradingTrader", backref="account", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "initial_balance": self.initial_balance,
            "cash_balance": round(self.cash_balance, 2),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
