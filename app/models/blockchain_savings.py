from app.extensions import db
from datetime import datetime, timezone


class BlockchainSavingsPlan(db.Model):
    __tablename__ = "blockchain_savings_plans"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    wallet_address = db.Column(db.String(42), nullable=False)
    contract_address = db.Column(db.String(42), nullable=True)
    plan_id_onchain = db.Column(db.Integer, nullable=True)

    deposit_amount_wei = db.Column(db.String(78), nullable=False)  # store as string for big numbers
    interval_days = db.Column(db.Integer, nullable=False)
    maturity_days = db.Column(db.Integer, nullable=False)
    penalty_bps = db.Column(db.Integer, nullable=False)

    status = db.Column(db.String(20), nullable=False, default="active")  # active, matured, withdrawn
    terms_accepted_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    deposits = db.relationship("BlockchainDeposit", backref="plan", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        maturity_date = self.created_at.timestamp() + (self.maturity_days * 86400)
        now = datetime.now(timezone.utc).timestamp()
        return {
            "id": self.id,
            "user_id": self.user_id,
            "wallet_address": self.wallet_address,
            "contract_address": self.contract_address,
            "plan_id_onchain": self.plan_id_onchain,
            "deposit_amount_wei": self.deposit_amount_wei,
            "interval_days": self.interval_days,
            "maturity_days": self.maturity_days,
            "penalty_bps": self.penalty_bps,
            "status": self.status,
            "is_matured": now >= maturity_date,
            "terms_accepted_at": self.terms_accepted_at.isoformat(),
            "created_at": self.created_at.isoformat(),
            "total_deposits": self.deposits.count(),
        }


class BlockchainDeposit(db.Model):
    __tablename__ = "blockchain_deposits"

    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey("blockchain_savings_plans.id", ondelete="CASCADE"), nullable=False)
    tx_hash = db.Column(db.String(66), nullable=False, unique=True)
    amount_wei = db.Column(db.String(78), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "plan_id": self.plan_id,
            "tx_hash": self.tx_hash,
            "amount_wei": self.amount_wei,
            "created_at": self.created_at.isoformat(),
        }
