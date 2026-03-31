from app.extensions import db
from datetime import datetime, timezone


class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    account_id = db.Column(
        db.Integer, db.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    category_id = db.Column(
        db.Integer, db.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    # User-specified date/time for the expense (allows backdating)
    expense_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "account_id": self.account_id,
            "category_id": self.category_id,
            "amount": self.amount,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "expense_at": self.expense_at.isoformat() if self.expense_at else self.created_at.isoformat(),
        }
