from app.extensions import db
from datetime import datetime, timezone


class TradingSuggestion(db.Model):
    __tablename__ = "trading_suggestions"

    id = db.Column(db.Integer, primary_key=True)
    trader_id = db.Column(
        db.Integer, db.ForeignKey("trading_traders.id", ondelete="CASCADE"), nullable=False
    )
    action = db.Column(db.String(4), nullable=False)  # 'buy' | 'sell'
    symbol = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    reasoning = db.Column(db.Text, nullable=True)
    sources = db.Column(db.JSON, nullable=True)  # [{title, url}, ...]
    confidence = db.Column(db.String(20), nullable=True)  # 'high', 'medium', 'low'
    risk_level = db.Column(db.String(20), nullable=True)  # 'high', 'medium', 'low'
    status = db.Column(db.String(10), nullable=False, default="pending")  # pending/approved/rejected
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    resolved_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.CheckConstraint("action IN ('buy', 'sell')", name="ck_suggestion_action"),
        db.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_suggestion_status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "trader_id": self.trader_id,
            "action": self.action,
            "symbol": self.symbol,
            "quantity": self.quantity,
            "price": round(self.price, 2),
            "reasoning": self.reasoning,
            "sources": self.sources or [],
            "confidence": self.confidence,
            "risk_level": self.risk_level,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }
