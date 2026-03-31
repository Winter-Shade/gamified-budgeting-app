"""
Wallet Service — XP, Gold, and Level management.

Level thresholds (cumulative XP required to reach each level):
  Level 1:  0 XP   (start)
  Level 2:  100 XP
  Level 3:  250 XP
  Level 4:  500 XP
  Level 5:  900 XP
  Level 6:  1400 XP
  Level 7:  2100 XP
  Level 8:  3000 XP
  Level 9:  4200 XP
  Level 10: 6000 XP  (max)
"""
from app.extensions import db
from app.models.wallet import Wallet
from app.models.transaction import Transaction

XP_PER_EXPENSE = 10       # XP awarded each time user logs an expense
GOLD_PER_10_REWARD_XP = 1 # Gold awarded per 10 reward_xp when completing a challenge

LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000]


def compute_level(xp: int) -> int:
    """Determine level from total XP."""
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
        else:
            break
    return level


def xp_for_next_level(level: int) -> int | None:
    """Return XP needed to reach the next level, or None if max level."""
    if level >= len(LEVEL_THRESHOLDS):
        return None
    return LEVEL_THRESHOLDS[level]


def get_wallet(user_id: int) -> dict:
    """Return the wallet data for a user, enriched with level progress info."""
    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        raise ValueError("Wallet not found for user")
    return _enrich(wallet)


def award_xp(
    user_id: int,
    xp: int,
    transaction_type: str,
    description: str | None = None,
    reference_id: int | None = None,
) -> dict:
    """
    Award XP to user and update level if threshold crossed.
    Does NOT commit — caller is responsible for committing.
    Returns info about the award and whether a level-up occurred.
    """
    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        raise ValueError("Wallet not found")

    old_level = wallet.level
    wallet.xp += xp
    new_level = compute_level(wallet.xp)
    wallet.level = new_level

    txn = Transaction(
        user_id=user_id,
        type=transaction_type,
        xp_change=xp,
        gold_change=0,
        reference_id=reference_id,
        description=description,
    )
    db.session.add(txn)

    return {
        "xp_awarded": xp,
        "total_xp": wallet.xp,
        "level_up": new_level > old_level,
        "old_level": old_level,
        "new_level": new_level,
    }


def award_gold(
    user_id: int,
    gold: int,
    transaction_type: str,
    description: str | None = None,
    reference_id: int | None = None,
) -> dict:
    """
    Award Gold to user.
    Does NOT commit — caller is responsible for committing.
    """
    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        raise ValueError("Wallet not found")

    wallet.gold += gold

    txn = Transaction(
        user_id=user_id,
        type=transaction_type,
        xp_change=0,
        gold_change=gold,
        reference_id=reference_id,
        description=description,
    )
    db.session.add(txn)

    return {"gold_awarded": gold, "total_gold": wallet.gold}


def award_xp_and_gold(
    user_id: int,
    xp: int,
    gold: int,
    transaction_type: str,
    description: str | None = None,
    reference_id: int | None = None,
) -> dict:
    """
    Award both XP and Gold in a single transaction record.
    Does NOT commit — caller is responsible for committing.
    """
    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        raise ValueError("Wallet not found")

    old_level = wallet.level
    wallet.xp += xp
    wallet.gold += gold
    new_level = compute_level(wallet.xp)
    wallet.level = new_level

    txn = Transaction(
        user_id=user_id,
        type=transaction_type,
        xp_change=xp,
        gold_change=gold,
        reference_id=reference_id,
        description=description,
    )
    db.session.add(txn)

    return {
        "xp_awarded": xp,
        "gold_awarded": gold,
        "total_xp": wallet.xp,
        "total_gold": wallet.gold,
        "level_up": new_level > old_level,
        "old_level": old_level,
        "new_level": new_level,
    }


def get_recent_rewards(user_id: int, limit: int = 10) -> list[dict]:
    """Return recent reward transactions for a user."""
    txns = (
        Transaction.query
        .filter_by(user_id=user_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return [t.to_dict() for t in txns]


def _enrich(wallet: Wallet) -> dict:
    d = wallet.to_dict()
    d["next_level_xp"] = xp_for_next_level(wallet.level)
    d["current_level_min_xp"] = LEVEL_THRESHOLDS[wallet.level - 1]
    d["level_progress_pct"] = _level_progress_pct(wallet.xp, wallet.level)
    return d


def _level_progress_pct(xp: int, level: int) -> float:
    """Percentage progress towards the next level (0-100)."""
    current_min = LEVEL_THRESHOLDS[level - 1]
    next_min = xp_for_next_level(level)
    if next_min is None:
        return 100.0
    span = next_min - current_min
    return round(((xp - current_min) / span) * 100, 1) if span > 0 else 100.0
