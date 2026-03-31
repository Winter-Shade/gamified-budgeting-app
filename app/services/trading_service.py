"""
Trading Service — CRUD for TradingAccount and TradingTrader.
Scheduling logic for recurring trader runs.
"""
from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.models.trading_account import TradingAccount
from app.models.trading_trader import TradingTrader, VALID_INTERVALS, VALID_MODELS
from app.models.trading_holding import TradingHolding
from app.models.trading_transaction import TradingTransaction
from app.services import market_service

INTERVAL_MINUTES = {
    "manual": None,
    "hourly": 60,
    "every_6h": 360,
    "every_12h": 720,
    "daily": 1440,
    "weekly": 10080,
}


# ── Trading Accounts ──────────────────────────────────────────────────────────

def create_trading_account(user_id: int, name: str, initial_balance: float) -> dict:
    if initial_balance <= 0:
        raise ValueError("Initial balance must be positive")
    account = TradingAccount(
        user_id=user_id,
        name=name,
        initial_balance=initial_balance,
        cash_balance=initial_balance,
    )
    db.session.add(account)
    db.session.commit()
    return account.to_dict()


def get_trading_accounts(user_id: int) -> list[dict]:
    accounts = TradingAccount.query.filter_by(user_id=user_id).all()
    result = []
    for acc in accounts:
        d = acc.to_dict()
        # Compute total portfolio value across all traders on this account
        d["trader_count"] = len(acc.traders)
        d["total_holdings_value"] = _account_holdings_value(acc)
        d["total_value"] = round(acc.cash_balance + d["total_holdings_value"], 2)
        d["pnl"] = round(d["total_value"] - acc.initial_balance, 2)
        result.append(d)
    return result


def update_trading_account(user_id: int, account_id: int, **kwargs) -> dict:
    account = TradingAccount.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        raise ValueError("Trading account not found")

    if "name" in kwargs:
        account.name = str(kwargs["name"])
    if "cash_balance" in kwargs:
        new_bal = float(kwargs["cash_balance"])
        if new_bal < 0:
            raise ValueError("Balance cannot be negative")
        account.cash_balance = new_bal
    if "reset" in kwargs and kwargs["reset"]:
        # Reset: restore cash to initial_balance and clear all trader holdings/transactions
        account.cash_balance = account.initial_balance
        for trader in account.traders:
            TradingHolding.query.filter_by(trader_id=trader.id).delete()
            TradingTransaction.query.filter_by(trader_id=trader.id).delete()
            trader.run_count = 0
            trader.last_run_at = None
            trader.next_run_at = None

    account.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return account.to_dict()


def delete_trading_account(user_id: int, account_id: int) -> dict:
    account = TradingAccount.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        raise ValueError("Trading account not found")
    db.session.delete(account)
    db.session.commit()
    return {"deleted": True}


# ── Trading Traders ───────────────────────────────────────────────────────────

def create_trader(
    user_id: int,
    account_id: int,
    name: str,
    strategy: str,
    identity: str | None = None,
    model: str = "gemini-2.0-flash",
) -> dict:
    account = TradingAccount.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        raise ValueError("Trading account not found")
    if model not in VALID_MODELS:
        raise ValueError(f"Invalid model. Must be one of: {', '.join(VALID_MODELS)}")
    if not strategy.strip():
        raise ValueError("Strategy cannot be empty")

    trader = TradingTrader(
        user_id=user_id,
        account_id=account_id,
        name=name,
        identity=identity,
        strategy=strategy,
        model=model,
    )
    db.session.add(trader)
    db.session.commit()
    return trader.to_dict()


def get_traders(user_id: int, account_id: int | None = None) -> list[dict]:
    query = TradingTrader.query.filter_by(user_id=user_id)
    if account_id:
        query = query.filter_by(account_id=account_id)
    traders = query.order_by(TradingTrader.created_at.desc()).all()
    result = []
    for t in traders:
        d = t.to_dict()
        d["holdings"] = _trader_holdings_with_prices(t)
        d["portfolio_value"] = sum(h.get("market_value", 0) for h in d["holdings"])
        d["total_value"] = round(d["portfolio_value"], 2)  # trader doesn't own cash directly
        result.append(d)
    return result


def get_trader(user_id: int, trader_id: int) -> dict:
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")
    d = trader.to_dict()
    d["holdings"] = _trader_holdings_with_prices(trader)
    d["portfolio_value"] = sum(h.get("market_value", 0) for h in d["holdings"])
    return d


def update_trader(user_id: int, trader_id: int, **kwargs) -> dict:
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")

    if "name" in kwargs:
        trader.name = str(kwargs["name"])
    if "identity" in kwargs:
        trader.identity = kwargs["identity"]
    if "strategy" in kwargs:
        if not str(kwargs["strategy"]).strip():
            raise ValueError("Strategy cannot be empty")
        trader.strategy = kwargs["strategy"]
    if "model" in kwargs:
        if kwargs["model"] not in VALID_MODELS:
            raise ValueError(f"Invalid model. Must be one of: {', '.join(VALID_MODELS)}")
        trader.model = kwargs["model"]

    db.session.commit()
    return trader.to_dict()


def delete_trader(user_id: int, trader_id: int) -> dict:
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")
    db.session.delete(trader)
    db.session.commit()
    return {"deleted": True}


# ── Scheduling ────────────────────────────────────────────────────────────────

def set_trader_schedule(user_id: int, trader_id: int, interval: str, active: bool = True) -> dict:
    if interval not in VALID_INTERVALS:
        raise ValueError(f"Invalid interval. Must be one of: {', '.join(VALID_INTERVALS)}")

    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")

    trader.schedule_interval = interval
    trader.schedule_active = active and (interval != "manual")

    if trader.schedule_active:
        minutes = INTERVAL_MINUTES[interval]
        trader.next_run_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    else:
        trader.next_run_at = None

    db.session.commit()
    return trader.to_dict()


def get_due_scheduled_traders() -> list[TradingTrader]:
    """Return all traders whose scheduled run time has passed."""
    now = datetime.now(timezone.utc)
    return (
        TradingTrader.query
        .filter(
            TradingTrader.schedule_active == True,
            TradingTrader.schedule_interval != "manual",
            TradingTrader.next_run_at <= now,
        )
        .all()
    )


def advance_trader_schedule(trader: TradingTrader) -> None:
    """After a scheduled run, compute the next run time."""
    minutes = INTERVAL_MINUTES.get(trader.schedule_interval)
    if minutes:
        trader.next_run_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    db.session.commit()


# ── Transactions & Holdings ───────────────────────────────────────────────────

def get_transactions(user_id: int, trader_id: int, limit: int = 50) -> list[dict]:
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")
    txns = (
        TradingTransaction.query
        .filter_by(trader_id=trader_id)
        .order_by(TradingTransaction.executed_at.desc())
        .limit(limit)
        .all()
    )
    return [t.to_dict() for t in txns]


def get_portfolio_value_history(user_id: int, trader_id: int) -> list[dict]:
    """Compute cumulative portfolio value over time from transaction history."""
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")

    account = TradingAccount.query.get(trader.account_id)
    txns = (
        TradingTransaction.query
        .filter_by(trader_id=trader_id)
        .order_by(TradingTransaction.executed_at.asc())
        .all()
    )

    history = []
    running_cash = account.cash_balance
    running_holdings: dict[str, int] = {}

    for t in txns:
        if t.side == "buy":
            running_cash -= t.total_value
            running_holdings[t.symbol] = running_holdings.get(t.symbol, 0) + t.quantity
        else:
            running_cash += t.total_value
            running_holdings[t.symbol] = running_holdings.get(t.symbol, 0) - t.quantity

        history.append({
            "timestamp": t.executed_at.isoformat(),
            "action": f"{t.side} {t.quantity} {t.symbol}",
        })

    return history


# ── Private helpers ───────────────────────────────────────────────────────────

def _trader_holdings_with_prices(trader: TradingTrader) -> list[dict]:
    holdings = [h for h in trader.holdings if h.quantity > 0]
    if not holdings:
        return []
    symbols = [h.symbol for h in holdings]
    prices = market_service.get_prices(symbols)
    return [h.to_dict(current_price=prices.get(h.symbol)) for h in holdings]


def _account_holdings_value(account: TradingAccount) -> float:
    total = 0.0
    for trader in account.traders:
        holdings = [h for h in trader.holdings if h.quantity > 0]
        if holdings:
            prices = market_service.get_prices([h.symbol for h in holdings])
            for h in holdings:
                total += prices.get(h.symbol, 0.0) * h.quantity
    return round(total, 2)
