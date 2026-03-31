from app.extensions import db
from datetime import datetime, timezone


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    billing_cycle = db.Column(db.String(20), nullable=False, default="monthly")  # monthly | weekly | yearly | quarterly
    next_billing_date = db.Column(db.Date, nullable=True)
    category = db.Column(db.String(60), nullable=True)  # e.g. "streaming", "software", "fitness"
    color = db.Column(db.String(10), nullable=True)     # hex color for UI
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def monthly_equivalent(self):
        cycle = self.billing_cycle
        if cycle == "weekly":
            return self.amount * 52 / 12
        if cycle == "yearly":
            return self.amount / 12
        if cycle == "quarterly":
            return self.amount / 3
        return self.amount  # monthly

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount": self.amount,
            "billing_cycle": self.billing_cycle,
            "next_billing_date": self.next_billing_date.isoformat() if self.next_billing_date else None,
            "category": self.category,
            "color": self.color,
            "is_active": self.is_active,
            "monthly_equivalent": round(self.monthly_equivalent(), 2),
            "created_at": self.created_at.isoformat(),
        }
