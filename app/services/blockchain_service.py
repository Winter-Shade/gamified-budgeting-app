from app.extensions import db
from app.models.blockchain_savings import BlockchainSavingsPlan, BlockchainDeposit
from datetime import datetime, timezone


def get_plans(user_id):
    plans = BlockchainSavingsPlan.query.filter_by(user_id=user_id).order_by(
        BlockchainSavingsPlan.created_at.desc()
    ).all()
    return [p.to_dict() for p in plans]


def create_plan(user_id, data):
    required = ["wallet_address", "deposit_amount_wei", "interval_days", "maturity_days", "penalty_bps"]
    for field in required:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    penalty = int(data["penalty_bps"])
    if penalty < 0 or penalty > 5000:
        raise ValueError("Penalty must be between 0 and 5000 basis points (0-50%)")

    plan = BlockchainSavingsPlan(
        user_id=user_id,
        wallet_address=data["wallet_address"],
        contract_address=data.get("contract_address"),
        plan_id_onchain=data.get("plan_id_onchain"),
        deposit_amount_wei=str(data["deposit_amount_wei"]),
        interval_days=int(data["interval_days"]),
        maturity_days=int(data["maturity_days"]),
        penalty_bps=penalty,
        terms_accepted_at=datetime.now(timezone.utc),
    )
    db.session.add(plan)
    db.session.commit()
    return plan.to_dict()


def record_deposit(user_id, plan_id, data):
    plan = BlockchainSavingsPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise LookupError("Plan not found")
    if plan.status == "withdrawn":
        raise ValueError("Plan already withdrawn")

    tx_hash = data.get("tx_hash")
    amount_wei = data.get("amount_wei")
    if not tx_hash or not amount_wei:
        raise ValueError("tx_hash and amount_wei are required")

    existing = BlockchainDeposit.query.filter_by(tx_hash=tx_hash).first()
    if existing:
        raise ValueError("Deposit with this tx_hash already recorded")

    deposit = BlockchainDeposit(
        plan_id=plan_id,
        tx_hash=tx_hash,
        amount_wei=str(amount_wei),
    )
    db.session.add(deposit)
    db.session.commit()
    return deposit.to_dict()


def get_deposits(user_id, plan_id):
    plan = BlockchainSavingsPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise LookupError("Plan not found")
    deposits = BlockchainDeposit.query.filter_by(plan_id=plan_id).order_by(
        BlockchainDeposit.created_at.desc()
    ).all()
    return [d.to_dict() for d in deposits]


def update_plan_status(user_id, plan_id, status):
    plan = BlockchainSavingsPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise LookupError("Plan not found")
    if status not in ("active", "matured", "withdrawn"):
        raise ValueError("Invalid status")
    plan.status = status
    db.session.commit()
    return plan.to_dict()


def update_plan_onchain(user_id, plan_id, data):
    plan = BlockchainSavingsPlan.query.filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise LookupError("Plan not found")
    if "contract_address" in data:
        plan.contract_address = data["contract_address"]
    if "plan_id_onchain" in data:
        plan.plan_id_onchain = data["plan_id_onchain"]
    db.session.commit()
    return plan.to_dict()
