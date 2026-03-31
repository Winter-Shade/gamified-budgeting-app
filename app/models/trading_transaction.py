from app.extensions import db
from datetime import datetime, timezone


class TradingTransaction(db.Model):
    __tablename__ = "trading_transactions"

    id = db.Column(db.Integer, primary_key=True)
    trader_id = db.Column(
        db.Integer, db.ForeignKey("trading_traders.id", ondelete="CASCADE"), nullable=False
    )
    symbol = db.Column(db.String(20), nullable=False)
    side = db.Column(db.String(4), nullable=False)  # 'buy' | 'sell'
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    total_value = db.Column(db.Float, nullable=False)
    rationale = db.Column(db.Text, nullable=True)
    executed_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.CheckConstraint("side IN ('buy', 'sell')", name="ck_trading_tx_side"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "trader_id": self.trader_id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "price": round(self.price, 2),
            "total_value": round(self.total_value, 2),
            "rationale": self.rationale,
            "executed_at": self.executed_at.isoformat(),
        }
