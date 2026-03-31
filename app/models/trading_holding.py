from app.extensions import db
from datetime import datetime, timezone


class TradingHolding(db.Model):
    __tablename__ = "trading_holdings"

    id = db.Column(db.Integer, primary_key=True)
    trader_id = db.Column(
        db.Integer, db.ForeignKey("trading_traders.id", ondelete="CASCADE"), nullable=False
    )
    symbol = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    avg_cost = db.Column(db.Float, nullable=False, default=0.0)  # average cost per share
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        db.UniqueConstraint("trader_id", "symbol", name="uq_trader_holding"),
    )

    def to_dict(self, current_price: float | None = None):
        d = {
            "id": self.id,
            "trader_id": self.trader_id,
            "symbol": self.symbol,
            "quantity": self.quantity,
            "avg_cost": round(self.avg_cost, 2),
            "cost_basis": round(self.avg_cost * self.quantity, 2),
            "updated_at": self.updated_at.isoformat(),
        }
        if current_price is not None:
            d["current_price"] = round(current_price, 2)
            d["market_value"] = round(current_price * self.quantity, 2)
            d["unrealized_pnl"] = round((current_price - self.avg_cost) * self.quantity, 2)
        return d
