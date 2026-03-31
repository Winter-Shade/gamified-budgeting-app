from datetime import date, datetime, timezone
from app.extensions import db
from app.models.expense import Expense
from app.models.account import Account
from app.services.wallet_service import award_xp, XP_PER_EXPENSE


def add_expense(
    user_id: int, account_id: int, category_id: int, amount: float,
    description: str | None = None, expense_at: str | None = None,
) -> dict:
    """
    Add an expense:
    1. Validate account ownership and sufficient balance
    2. Deduct amount from account
    3. Insert expense record
    4. Award XP for tracking the expense
    5. Update any active challenge progress
    6. Commit atomically
    """
    if amount <= 0:
        raise ValueError("Expense amount must be positive")

    account = Account.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        raise ValueError("Account not found or does not belong to user")

    if account.balance < amount:
        raise ValueError(
            f"Insufficient balance. Available: {account.balance:.2f}, Required: {amount:.2f}"
        )

    # Parse the user-supplied expense datetime
    parsed_expense_at = None
    if expense_at:
        try:
            parsed_expense_at = datetime.fromisoformat(expense_at.replace("Z", "+00:00"))
            if parsed_expense_at.tzinfo is None:
                parsed_expense_at = parsed_expense_at.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            raise ValueError("expense_at must be in ISO format (e.g. 2026-03-15T14:30)")

    try:
        account.balance -= amount

        expense = Expense(
            user_id=user_id,
            account_id=account_id,
            category_id=category_id,
            amount=amount,
            description=description,
            expense_at=parsed_expense_at or datetime.now(timezone.utc),
        )
        db.session.add(expense)
        db.session.flush()  # Get expense.id before challenge/XP updates

        # Award XP for expense tracking
        xp_result = award_xp(
            user_id=user_id,
            xp=XP_PER_EXPENSE,
            transaction_type="EXPENSE_REWARD",
            description="Logged an expense",
            reference_id=expense.id,
        )

        # Update challenge progress (may auto-fail no_spend / update budget_limit)
        from app.services.challenge_service import update_challenge_progress_on_expense
        challenge_events = update_challenge_progress_on_expense(
            user_id=user_id,
            expense_amount=amount,
            expense_date=date.today(),
        )

        db.session.commit()

        return {
            "expense": expense.to_dict(),
            "account_balance": account.balance,
            "xp_awarded": xp_result["xp_awarded"],
            "level_up": xp_result["level_up"],
            "new_level": xp_result["new_level"],
            "challenge_events": challenge_events,
        }

    except Exception:
        db.session.rollback()
        raise


def update_expense(user_id: int, expense_id: int, **kwargs) -> dict:
    """Update an existing expense. Adjusts account balance if amount changed."""
    expense = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not expense:
        raise ValueError("Expense not found or does not belong to user")

    try:
        new_amount = kwargs.get("amount")
        if new_amount is not None:
            new_amount = float(new_amount)
            if new_amount <= 0:
                raise ValueError("Expense amount must be positive")

            diff = new_amount - expense.amount
            account = Account.query.get(expense.account_id)
            if account.balance < diff:
                raise ValueError("Insufficient balance for updated amount")
            account.balance -= diff
            expense.amount = new_amount

        if "category_id" in kwargs:
            expense.category_id = int(kwargs["category_id"])
        if "description" in kwargs:
            expense.description = kwargs["description"]
        if "expense_at" in kwargs and kwargs["expense_at"]:
            try:
                ea = kwargs["expense_at"]
                parsed = datetime.fromisoformat(ea.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                expense.expense_at = parsed
            except (ValueError, AttributeError):
                raise ValueError("expense_at must be in ISO format")

        db.session.commit()
        return {"expense": expense.to_dict()}

    except Exception:
        db.session.rollback()
        raise


def delete_expense(user_id: int, expense_id: int) -> dict:
    """Delete an expense and refund the amount to the account."""
    expense = Expense.query.filter_by(id=expense_id, user_id=user_id).first()
    if not expense:
        raise ValueError("Expense not found or does not belong to user")

    try:
        account = Account.query.get(expense.account_id)
        account.balance += expense.amount

        db.session.delete(expense)
        db.session.commit()

        return {"deleted": True, "refunded": expense.amount, "account_balance": account.balance}

    except Exception:
        db.session.rollback()
        raise


def get_expenses(user_id: int, category_id: int | None = None, limit: int | None = None) -> list[dict]:
    """Return all expenses for the user, most recent first. Optional category filter."""
    query = Expense.query.filter_by(user_id=user_id)
    if category_id:
        query = query.filter_by(category_id=category_id)
    query = query.order_by(Expense.created_at.desc())
    if limit:
        query = query.limit(limit)
    return [e.to_dict() for e in query.all()]
