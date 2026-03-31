from app.extensions import db


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.String(120), nullable=False)
    balance = db.Column(db.Float, default=0.0, nullable=False)
    type = db.Column(db.String(20), nullable=False)

    __table_args__ = (
        db.CheckConstraint(
            "type IN ('bank', 'wallet', 'cash')", name="ck_account_type"
        ),
    )

    expenses = db.relationship("Expense", backref="account", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "balance": self.balance,
            "type": self.type,
        }
