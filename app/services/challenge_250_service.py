"""
1-250 Savings Challenge service.

Rules:
- Each step N = ₹N.  Completing all 250 steps = ₹31,375 saved.
- Manual mode: just marks steps; no money movement in app.
- Transfer mode: deducts ₹N from the linked account when checked,
  refunds when unchecked.
- A user can only have one active 250-challenge (the row is replaced on reset).
"""
from datetime import datetime, timezone
from app.extensions import db
from app.models.challenge_250 import Challenge250
from app.models.account import Account


def get_status(user_id: int) -> dict | None:
    row = Challenge250.query.filter_by(user_id=user_id).first()
    return row.to_dict() if row else None


def start_challenge(user_id: int, mode: str, account_id: int | None) -> dict:
    if mode not in ("manual", "transfer"):
        raise ValueError("mode must be 'manual' or 'transfer'")
    if mode == "transfer" and not account_id:
        raise ValueError("account_id required for transfer mode")
    if mode == "transfer":
        acct = Account.query.filter_by(id=account_id, user_id=user_id).first()
        if not acct:
            raise LookupError("Account not found")

    # Reset existing row if present
    existing = Challenge250.query.filter_by(user_id=user_id).first()
    if existing:
        db.session.delete(existing)
        db.session.flush()

    row = Challenge250(user_id=user_id, mode=mode, account_id=account_id)
    row.checked_steps = []
    db.session.add(row)
    db.session.commit()
    return row.to_dict()


def check_step(user_id: int, step: int) -> dict:
    if not (1 <= step <= 250):
        raise ValueError("Step must be between 1 and 250")

    row = Challenge250.query.filter_by(user_id=user_id).first()
    if not row:
        raise LookupError("Challenge not started")

    steps = row.checked_steps
    if step in steps:
        raise ValueError(f"Step {step} already checked")

    if row.mode == "transfer" and row.account_id:
        acct = Account.query.filter_by(id=row.account_id, user_id=user_id).first()
        if not acct:
            raise LookupError("Linked account not found")
        if acct.balance < step:
            raise ValueError(f"Insufficient balance (need ₹{step})")
        acct.balance = round(acct.balance - step, 2)

    steps.append(step)
    row.checked_steps = steps

    if len(row.checked_steps) == 250:
        row.completed_at = datetime.now(timezone.utc)

    db.session.commit()
    return row.to_dict()


def uncheck_step(user_id: int, step: int) -> dict:
    if not (1 <= step <= 250):
        raise ValueError("Step must be between 1 and 250")

    row = Challenge250.query.filter_by(user_id=user_id).first()
    if not row:
        raise LookupError("Challenge not started")

    steps = row.checked_steps
    if step not in steps:
        raise ValueError(f"Step {step} is not checked")

    if row.mode == "transfer" and row.account_id:
        acct = Account.query.filter_by(id=row.account_id, user_id=user_id).first()
        if acct:
            acct.balance = round(acct.balance + step, 2)

    steps.remove(step)
    row.checked_steps = steps
    row.completed_at = None  # no longer complete if we uncheck
    db.session.commit()
    return row.to_dict()


def reset_challenge(user_id: int) -> dict:
    """Clear all checked steps. In transfer mode, no automatic refund — user manages manually."""
    row = Challenge250.query.filter_by(user_id=user_id).first()
    if not row:
        raise LookupError("Challenge not started")
    row.checked_steps = []
    row.completed_at = None
    db.session.commit()
    return row.to_dict()
