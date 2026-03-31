"""
Daily Savings Challenge service.

Rules:
- User sets a fixed daily amount (e.g. ₹50/day).
- Check in once per day to maintain the streak.
- One grace day allowed per challenge — skipping one day doesn't break the streak,
  but the grace day is logged and cannot be used again.
- Missing a day without grace = streak resets to 0.
- Only one active challenge per user at a time.
"""
from datetime import datetime, timezone, date, timedelta
from app.extensions import db
from app.models.daily_savings import DailySavingsChallenge, DailySavingsLog


def get_active(user_id: int) -> dict | None:
    row = DailySavingsChallenge.query.filter_by(user_id=user_id, is_active=True).first()
    if not row:
        return None
    _maybe_break_streak(row)
    return row.to_dict()


def get_history(user_id: int) -> list[dict]:
    rows = DailySavingsChallenge.query.filter_by(user_id=user_id).order_by(DailySavingsChallenge.started_at.desc()).all()
    return [r.to_dict() for r in rows]


def start_challenge(user_id: int, daily_amount: float) -> dict:
    if daily_amount <= 0:
        raise ValueError("daily_amount must be positive")

    # End any existing active challenge first
    existing = DailySavingsChallenge.query.filter_by(user_id=user_id, is_active=True).first()
    if existing:
        existing.is_active = False
        existing.ended_at = datetime.now(timezone.utc)
        db.session.flush()

    row = DailySavingsChallenge(user_id=user_id, daily_amount=daily_amount)
    db.session.add(row)
    db.session.commit()
    return row.to_dict()


def check_in(user_id: int) -> dict:
    row = DailySavingsChallenge.query.filter_by(user_id=user_id, is_active=True).first()
    if not row:
        raise LookupError("No active daily savings challenge")

    today = date.today()
    if row.last_log_date == today:
        raise ValueError("Already checked in today")

    _maybe_break_streak(row)

    # Log the check-in
    log = DailySavingsLog(challenge_id=row.id, user_id=user_id, log_date=today, status="checked")
    db.session.add(log)

    row.current_streak += 1
    row.best_streak = max(row.best_streak, row.current_streak)
    row.last_log_date = today
    db.session.commit()
    return row.to_dict()


def use_grace(user_id: int) -> dict:
    """Apply the grace day for yesterday's missed check-in."""
    row = DailySavingsChallenge.query.filter_by(user_id=user_id, is_active=True).first()
    if not row:
        raise LookupError("No active daily savings challenge")
    if row.grace_used:
        raise ValueError("Grace day already used for this challenge")

    today = date.today()
    yesterday = today - timedelta(days=1)

    if row.last_log_date is None or (today - row.last_log_date).days != 2:
        raise ValueError("Grace can only be applied when exactly one day was missed")

    log = DailySavingsLog(challenge_id=row.id, user_id=user_id, log_date=yesterday, status="grace")
    db.session.add(log)

    row.grace_used = True
    row.last_log_date = yesterday  # treat yesterday as covered; streak continues
    db.session.commit()
    return row.to_dict()


def stop_challenge(user_id: int) -> dict:
    row = DailySavingsChallenge.query.filter_by(user_id=user_id, is_active=True).first()
    if not row:
        raise LookupError("No active daily savings challenge")
    row.is_active = False
    row.ended_at = datetime.now(timezone.utc)
    db.session.commit()
    return row.to_dict()


def _maybe_break_streak(row: DailySavingsChallenge) -> None:
    """If the user missed more than 1 day without a grace, reset the streak. Does NOT commit."""
    if not row.is_active or row.last_log_date is None:
        return
    today = date.today()
    days_since = (today - row.last_log_date).days
    if days_since > 1:
        # If grace not yet used and exactly 2 days since last log (missed 1 day), don't auto-break yet — user can still use grace.
        # If more than 2 days, streak is definitely broken.
        if days_since > 2 or row.grace_used:
            row.current_streak = 0
            db.session.flush()
