from app.extensions import db
from app.models.wallet import Wallet
from app.models.user import User


def get_leaderboard(limit: int = 10) -> list[dict]:
    """
    Return top users ranked by XP (descending).
    """
    results = (
        db.session.query(User.id, User.username, Wallet.xp, Wallet.gold, Wallet.level)
        .join(Wallet, User.id == Wallet.user_id)
        .order_by(Wallet.xp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "rank": idx + 1,
            "user_id": row.id,
            "username": row.username,
            "xp": row.xp,
            "gold": row.gold,
            "level": row.level,
        }
        for idx, row in enumerate(results)
    ]
