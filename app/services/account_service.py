from app.extensions import db
from app.models.account import Account


def create_account(user_id: int, name: str, balance: float, account_type: str) -> dict:
    """Create a new account for the user."""
    if account_type not in ("bank", "wallet", "cash"):
        raise ValueError("Account type must be one of: bank, wallet, cash")
    if balance < 0:
        raise ValueError("Initial balance cannot be negative")

    account = Account(user_id=user_id, name=name, balance=balance, type=account_type)
    db.session.add(account)
    db.session.commit()
    return account.to_dict()


def get_accounts(user_id: int) -> list[dict]:
    """Return all accounts belonging to the user."""
    accounts = Account.query.filter_by(user_id=user_id).all()
    return [a.to_dict() for a in accounts]


def deposit(user_id: int, account_id: int, amount: float,
            source: str = "other", description: str | None = None) -> dict:
    """Credit an account with income."""
    if amount <= 0:
        raise ValueError("Deposit amount must be positive")

    account = Account.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        raise ValueError("Account not found or does not belong to user")

    try:
        account.balance += amount
        db.session.commit()
        return {
            "account": account.to_dict(),
            "deposited": amount,
            "source": source,
            "description": description,
        }
    except Exception:
        db.session.rollback()
        raise
