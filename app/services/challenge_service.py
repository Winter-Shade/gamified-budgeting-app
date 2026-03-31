"""
Challenge Service — progress tracking, auto-completion, and XP/Gold rewards.

Challenge types:
  budget_limit — stay under target_value spending during the challenge period
  no_spend     — make zero expenses during the challenge period
  streak       — log at least one expense every consecutive day for target_value days
"""
from datetime import datetime, timezone, date, timedelta
from sqlalchemy import func
from app.extensions import db
from app.models.challenge import Challenge
from app.models.challenge_participant import ChallengeParticipant
from app.models.expense import Expense


def list_challenges(user_id: int | None = None) -> list[dict]:
    """Return all active challenges with the user's participation status."""
    today = date.today()
    challenges = (
        Challenge.query
        .filter(Challenge.end_date >= today)
        .order_by(Challenge.start_date.asc())
        .all()
    )
    result = []
    for c in challenges:
        data = c.to_dict()
        if user_id:
            participant = ChallengeParticipant.query.filter_by(
                challenge_id=c.id, user_id=user_id
            ).first()
            data["joined"] = participant is not None
            data["my_progress"] = participant.progress_value if participant else 0
            data["my_status"] = participant.status if participant else None
            data["progress_pct"] = _progress_pct(c, participant)
        result.append(data)
    return result


def get_my_challenges(user_id: int) -> list[dict]:
    """Return all challenges the user has joined (active, completed, failed)."""
    participants = (
        ChallengeParticipant.query
        .filter_by(user_id=user_id)
        .order_by(ChallengeParticipant.joined_at.desc())
        .all()
    )
    result = []
    for p in participants:
        challenge = Challenge.query.get(p.challenge_id)
        if not challenge:
            continue
        data = challenge.to_dict()
        data["joined"] = True
        data["my_progress"] = p.progress_value
        data["my_status"] = p.status
        data["progress_pct"] = _progress_pct(challenge, p)
        data["reward_gold"] = challenge.reward_xp // 10
        result.append(data)
    return result


def create_challenge(
    title: str,
    description: str,
    challenge_type: str,
    target_value: float,
    start_date: str,
    end_date: str,
    reward_xp: int,
    created_by: int,
) -> dict:
    """Create a new challenge."""
    if challenge_type not in ("streak", "budget_limit", "no_spend"):
        raise ValueError("Invalid challenge type. Must be: streak, budget_limit, no_spend")

    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Dates must be in YYYY-MM-DD format")

    if e_date <= s_date:
        raise ValueError("end_date must be after start_date")
    if reward_xp <= 0:
        raise ValueError("reward_xp must be positive")

    challenge = Challenge(
        title=title,
        description=description,
        type=challenge_type,
        target_value=target_value,
        start_date=s_date,
        end_date=e_date,
        reward_xp=reward_xp,
        created_by=created_by,
    )
    db.session.add(challenge)
    db.session.commit()
    return challenge.to_dict()


def join_challenge(user_id: int, challenge_id: int) -> dict:
    """Add user as participant in a challenge."""
    challenge = Challenge.query.get(challenge_id)
    if not challenge:
        raise ValueError("Challenge not found")

    today = date.today()
    if today > challenge.end_date:
        raise ValueError("Challenge has already ended")

    existing = ChallengeParticipant.query.filter_by(
        challenge_id=challenge_id, user_id=user_id
    ).first()
    if existing:
        raise ValueError("Already joined this challenge")

    participant = ChallengeParticipant(
        challenge_id=challenge_id,
        user_id=user_id,
        progress_value=0,
        status="active",
    )
    db.session.add(participant)
    db.session.commit()

    return {
        "participant": participant.to_dict(),
        "challenge": challenge.to_dict(),
    }


def update_challenge_progress_on_expense(user_id: int, expense_amount: float, expense_date: date | None = None) -> list[dict]:
    """
    Called after an expense is added.
    Checks all active challenge participations and updates progress.
    May auto-fail no_spend challenges.
    Returns list of any challenges that were auto-completed or auto-failed.
    """
    if expense_date is None:
        expense_date = date.today()

    active = (
        ChallengeParticipant.query
        .filter_by(user_id=user_id, status="active")
        .all()
    )

    events = []
    for participant in active:
        challenge = Challenge.query.get(participant.challenge_id)
        if not challenge:
            continue

        # Only process if expense falls within challenge window
        if not (challenge.start_date <= expense_date <= challenge.end_date):
            continue

        if challenge.type == "no_spend":
            # Any expense during the period = failed
            participant.status = "failed"
            events.append({"challenge_id": challenge.id, "title": challenge.title, "event": "failed"})

        elif challenge.type == "budget_limit":
            # Recalculate total spending during challenge period
            start_dt = datetime(challenge.start_date.year, challenge.start_date.month, challenge.start_date.day, tzinfo=timezone.utc)
            end_dt = datetime(challenge.end_date.year, challenge.end_date.month, challenge.end_date.day, tzinfo=timezone.utc) + timedelta(days=1)
            total_spent = (
                db.session.query(func.coalesce(func.sum(Expense.amount), 0.0))
                .filter(
                    Expense.user_id == user_id,
                    Expense.created_at >= start_dt,
                    Expense.created_at < end_dt,
                )
                .scalar()
            )
            participant.progress_value = float(total_spent)

            if float(total_spent) > challenge.target_value:
                participant.status = "failed"
                events.append({"challenge_id": challenge.id, "title": challenge.title, "event": "failed"})

        elif challenge.type == "streak":
            # Streak: how many consecutive days the user logged expenses
            streak = _compute_expense_streak(user_id, challenge.start_date, expense_date)
            participant.progress_value = streak
            if streak >= int(challenge.target_value):
                completed = _complete_challenge(user_id, participant, challenge)
                events.append({"challenge_id": challenge.id, "title": challenge.title, "event": "completed", **completed})

    db.session.flush()
    return events


def check_and_complete_budget_challenges(user_id: int) -> list[dict]:
    """
    Call this at the end of a challenge period (or on demand) to complete
    budget_limit challenges where the user stayed under the limit.
    """
    today = date.today()
    active = (
        ChallengeParticipant.query
        .filter_by(user_id=user_id, status="active")
        .all()
    )
    events = []
    for participant in active:
        challenge = Challenge.query.get(participant.challenge_id)
        if not challenge or challenge.type != "budget_limit":
            continue
        if today < challenge.end_date:
            continue  # Challenge not over yet
        # Check if user stayed under budget
        if participant.progress_value <= challenge.target_value:
            completed = _complete_challenge(user_id, participant, challenge)
            events.append({"challenge_id": challenge.id, "title": challenge.title, "event": "completed", **completed})

    db.session.flush()
    return events


def check_and_complete_no_spend_challenges(user_id: int) -> list[dict]:
    """Complete no_spend challenges that survived to end_date without spending."""
    today = date.today()
    active = (
        ChallengeParticipant.query
        .filter_by(user_id=user_id, status="active")
        .all()
    )
    events = []
    for participant in active:
        challenge = Challenge.query.get(participant.challenge_id)
        if not challenge or challenge.type != "no_spend":
            continue
        if today < challenge.end_date:
            continue
        # Still active at end_date = success
        completed = _complete_challenge(user_id, participant, challenge)
        events.append({"challenge_id": challenge.id, "title": challenge.title, "event": "completed", **completed})

    db.session.flush()
    return events


def _complete_challenge(user_id: int, participant: ChallengeParticipant, challenge: Challenge) -> dict:
    """Mark challenge as completed and award XP + Gold. Does NOT commit."""
    from app.services.wallet_service import award_xp_and_gold
    participant.status = "completed"
    gold = max(1, challenge.reward_xp // 10)
    reward = award_xp_and_gold(
        user_id=user_id,
        xp=challenge.reward_xp,
        gold=gold,
        transaction_type="CHALLENGE_COMPLETE",
        description=f"Completed: {challenge.title}",
        reference_id=challenge.id,
    )
    return {"xp_awarded": challenge.reward_xp, "gold_awarded": gold, "level_up": reward["level_up"]}


def _compute_expense_streak(user_id: int, start_date: date, up_to: date) -> int:
    """Count consecutive days with at least one expense, backwards from up_to."""
    streak = 0
    current = up_to
    while current >= start_date:
        day_start = datetime(current.year, current.month, current.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        count = Expense.query.filter(
            Expense.user_id == user_id,
            Expense.created_at >= day_start,
            Expense.created_at < day_end,
        ).count()
        if count > 0:
            streak += 1
            current -= timedelta(days=1)
        else:
            break
    return streak


def _progress_pct(challenge: Challenge, participant: ChallengeParticipant | None) -> float:
    if not participant:
        return 0.0
    if challenge.target_value <= 0:
        return 100.0 if participant.status == "completed" else 0.0
    if challenge.type == "budget_limit":
        # Progress = how much of the budget is used (inverse — lower is better)
        used_pct = (participant.progress_value / challenge.target_value) * 100
        return min(100.0, round(used_pct, 1))
    elif challenge.type == "streak":
        return min(100.0, round((participant.progress_value / challenge.target_value) * 100, 1))
    elif challenge.type == "no_spend":
        return 100.0 if participant.status == "completed" else (0.0 if participant.status == "failed" else 50.0)
    return 0.0
