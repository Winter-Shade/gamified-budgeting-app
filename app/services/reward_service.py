"""
Reward Service — ALL XP logic goes through here.

Rules:
  ❌ No XP for adding/editing/deleting expenses
  ✅ XP only from: streaks, budget discipline, challenge completions
  All rewards → transactions table → wallet update
"""
from app.extensions import db
from app.models.transaction import Transaction
from app.models.wallet import Wallet
from app.models.challenge import Challenge
from app.models.challenge_participant import ChallengeParticipant


def _apply_reward(user_id: int, txn_type: str, xp: int, reference_id: int | None = None) -> dict:
    """
    Internal helper: create transaction record + update wallet.
    Must be called inside an active DB session.
    Prevents duplicate rewards by checking existing transactions.
    """
    # Idempotency check — prevent duplicate rewards for same reference
    if reference_id is not None:
        existing = Transaction.query.filter_by(
            user_id=user_id, type=txn_type, reference_id=reference_id
        ).first()
        if existing:
            wallet = Wallet.query.filter_by(user_id=user_id).first()
            return {
                "xp_earned": 0,
                "total_xp": wallet.xp if wallet else 0,
                "level": wallet.level if wallet else 1,
                "duplicate": True,
            }

    txn = Transaction(
        user_id=user_id,
        type=txn_type,
        xp_change=xp,
        gold_change=0,
        reference_id=reference_id,
    )
    db.session.add(txn)

    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        raise ValueError("Wallet not found for user")

    wallet.xp += xp
    wallet.level = wallet.xp // 100 + 1

    return {
        "xp_earned": xp,
        "total_xp": wallet.xp,
        "level": wallet.level,
        "duplicate": False,
    }


def process_streak_reward(user_id: int, streak_id: int, streak_type: str = "weekly") -> dict:
    """
    Award XP for streak completion.
    Weekly streak → +5 XP
    Monthly streak → +15 XP (configurable)
    """
    xp = 5 if streak_type == "weekly" else 15
    return _apply_reward(user_id, "STREAK_REWARD", xp, reference_id=streak_id)


def process_budget_discipline(user_id: int, reference_id: int | None = None) -> dict:
    """
    Award XP for staying under budget for 3 consecutive days.
    +3 XP per achievement.
    """
    return _apply_reward(user_id, "BUDGET_DISCIPLINE", 3, reference_id=reference_id)


def process_challenge_completion(user_id: int, challenge_id: int) -> dict:
    """
    Award XP when user completes a challenge.
    XP amount comes from the challenge's reward_xp field.
    """
    challenge = Challenge.query.get(challenge_id)
    if not challenge:
        raise ValueError("Challenge not found")

    # Verify participation and status
    participant = ChallengeParticipant.query.filter_by(
        challenge_id=challenge_id, user_id=user_id
    ).first()
    if not participant:
        raise ValueError("User is not a participant in this challenge")
    if participant.status == "completed":
        # Already completed — idempotent
        wallet = Wallet.query.filter_by(user_id=user_id).first()
        return {
            "xp_earned": 0,
            "total_xp": wallet.xp if wallet else 0,
            "level": wallet.level if wallet else 1,
            "duplicate": True,
        }

    participant.status = "completed"
    return _apply_reward(user_id, "CHALLENGE_COMPLETE", challenge.reward_xp, reference_id=challenge_id)
