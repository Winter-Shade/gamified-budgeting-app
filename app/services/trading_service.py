"""
Trading Service — CRUD for TradingAccount and TradingTrader.
Scheduling logic for recurring trader runs.
Fund transfers, CSV portfolio import, suggestion management.
"""
import csv
import io
from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.models.trading_account import TradingAccount
from app.models.trading_trader import TradingTrader, VALID_INTERVALS, VALID_MODELS
from app.models.trading_holding import TradingHolding
from app.models.trading_transaction import TradingTransaction
from app.models.trading_suggestion import TradingSuggestion
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
            TradingSuggestion.query.filter_by(trader_id=trader.id).delete()
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


# ── Fund Transfer ─────────────────────────────────────────────────────────────

def transfer_funds(user_id: int, account_id: int, amount: float) -> dict:
    """Transfer funds from a user's bank account to a trading account."""
    from app.models.account import Account

    if amount <= 0:
        raise ValueError("Transfer amount must be positive")

    source = Account.query.filter_by(id=account_id, user_id=user_id).first()
    if not source:
        raise ValueError("Source account not found")
    if source.balance < amount:
        raise ValueError(f"Insufficient funds. Available: ${source.balance:.2f}")

    trading_acc = TradingAccount.query.filter_by(user_id=user_id).first()
    if not trading_acc:
        raise ValueError("No trading account found. Create one first.")

    source.balance = round(source.balance - amount, 2)
    trading_acc.cash_balance = round(trading_acc.cash_balance + amount, 2)
    trading_acc.initial_balance = round(trading_acc.initial_balance + amount, 2)
    trading_acc.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return {
        "transferred": amount,
        "source_balance": source.balance,
        "trading_cash_balance": trading_acc.cash_balance,
    }


def transfer_funds_to_account(user_id: int, source_account_id: int, trading_account_id: int, amount: float) -> dict:
    """Transfer funds from a user's bank account to a specific trading account."""
    from app.models.account import Account

    if amount <= 0:
        raise ValueError("Transfer amount must be positive")

    source = Account.query.filter_by(id=source_account_id, user_id=user_id).first()
    if not source:
        raise ValueError("Source account not found")
    if source.balance < amount:
        raise ValueError(f"Insufficient funds. Available: ${source.balance:.2f}")

    trading_acc = TradingAccount.query.filter_by(id=trading_account_id, user_id=user_id).first()
    if not trading_acc:
        raise ValueError("Trading account not found")

    source.balance = round(source.balance - amount, 2)
    trading_acc.cash_balance = round(trading_acc.cash_balance + amount, 2)
    trading_acc.initial_balance = round(trading_acc.initial_balance + amount, 2)
    trading_acc.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return {
        "transferred": amount,
        "source_account": source.name,
        "source_balance": source.balance,
        "trading_account": trading_acc.name,
        "trading_cash_balance": trading_acc.cash_balance,
    }


# ── CSV Portfolio Import ─────────────────────────────────────────────────────

def import_portfolio_csv(user_id: int, trader_id: int, csv_content: str) -> dict:
    """
    Parse CSV with columns: symbol,quantity
    Validate symbols, fetch prices, create initial holdings.
    """
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")

    account = TradingAccount.query.get(trader.account_id)

    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    rows = []
    for row in reader:
        symbol = row.get("symbol", "").strip().upper()
        qty_str = row.get("quantity", "").strip()
        if not symbol or not qty_str:
            continue
        try:
            quantity = int(qty_str)
        except ValueError:
            raise ValueError(f"Invalid quantity for {symbol}: {qty_str}")
        if quantity <= 0:
            raise ValueError(f"Quantity must be positive for {symbol}")
        rows.append({"symbol": symbol, "quantity": quantity})

    if not rows:
        raise ValueError("No valid rows found in CSV. Expected columns: symbol,quantity")

    # Fetch prices for all symbols
    symbols = [r["symbol"] for r in rows]
    prices = market_service.get_prices(symbols)

    errors = []
    total_cost = 0.0
    validated = []
    for r in rows:
        price = prices.get(r["symbol"], 0.0)
        if price <= 0:
            errors.append(f"Could not fetch price for {r['symbol']}")
            continue
        cost = price * r["quantity"]
        total_cost += cost
        validated.append({**r, "price": price, "cost": cost})

    if errors:
        raise ValueError("; ".join(errors))

    if total_cost > account.cash_balance:
        raise ValueError(
            f"Insufficient funds. Portfolio costs ${total_cost:,.2f} but account has ${account.cash_balance:,.2f}"
        )

    # Create holdings and transactions
    for v in validated:
        holding = TradingHolding.query.filter_by(trader_id=trader_id, symbol=v["symbol"]).first()
        if holding:
            old_total = holding.avg_cost * holding.quantity
            holding.quantity += v["quantity"]
            holding.avg_cost = round((old_total + v["cost"]) / holding.quantity, 4)
        else:
            holding = TradingHolding(
                trader_id=trader_id,
                symbol=v["symbol"],
                quantity=v["quantity"],
                avg_cost=v["price"],
            )
            db.session.add(holding)

        txn = TradingTransaction(
            trader_id=trader_id,
            symbol=v["symbol"],
            side="buy",
            quantity=v["quantity"],
            price=v["price"],
            total_value=v["cost"],
            rationale="CSV portfolio import",
        )
        db.session.add(txn)

    account.cash_balance = round(account.cash_balance - total_cost, 2)
    account.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return {
        "imported": len(validated),
        "total_cost": round(total_cost, 2),
        "holdings": [{"symbol": v["symbol"], "quantity": v["quantity"], "price": v["price"]} for v in validated],
    }


# ── Trading Traders ───────────────────────────────────────────────────────────

def create_trader(
    user_id: int,
    account_id: int,
    name: str,
    strategy: str,
    identity: str | None = None,
    model: str = "gemini-2.0-flash",
    require_approval: bool = False,
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
        require_approval=require_approval,
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
        d["pending_suggestions"] = TradingSuggestion.query.filter_by(
            trader_id=t.id, status="pending"
        ).count()
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
    if "require_approval" in kwargs:
        trader.require_approval = bool(kwargs["require_approval"])

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

    if not txns:
        return []

    # Reconstruct portfolio value at each transaction point
    history = []
    cash = account.initial_balance
    holdings: dict[str, dict] = {}  # symbol -> {quantity, avg_cost}

    # Add starting point
    history.append({
        "timestamp": txns[0].executed_at.isoformat(),
        "value": round(cash, 2),
        "cash": round(cash, 2),
        "holdings_value": 0,
        "action": "start",
    })

    for t in txns:
        if t.side == "buy":
            cash -= t.total_value
            if t.symbol in holdings:
                h = holdings[t.symbol]
                old_total = h["avg_cost"] * h["quantity"]
                h["quantity"] += t.quantity
                h["avg_cost"] = (old_total + t.total_value) / h["quantity"]
            else:
                holdings[t.symbol] = {"quantity": t.quantity, "avg_cost": t.price}
        else:
            cash += t.total_value
            if t.symbol in holdings:
                holdings[t.symbol]["quantity"] -= t.quantity
                if holdings[t.symbol]["quantity"] <= 0:
                    del holdings[t.symbol]

        # Calculate holdings value at transaction price (best approximation)
        holdings_value = sum(
            h["quantity"] * h["avg_cost"] for h in holdings.values()
        )
        total_value = cash + holdings_value

        history.append({
            "timestamp": t.executed_at.isoformat(),
            "value": round(total_value, 2),
            "cash": round(cash, 2),
            "holdings_value": round(holdings_value, 2),
            "action": f"{t.side} {t.quantity} {t.symbol}",
        })

    # Add current value using live prices
    current_symbols = [s for s, h in holdings.items() if h["quantity"] > 0]
    if current_symbols:
        prices = market_service.get_prices(current_symbols)
        live_holdings_value = sum(
            holdings[s]["quantity"] * prices.get(s, holdings[s]["avg_cost"])
            for s in current_symbols
        )
    else:
        live_holdings_value = 0.0

    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "value": round(cash + live_holdings_value, 2),
        "cash": round(cash, 2),
        "holdings_value": round(live_holdings_value, 2),
        "action": "current",
    })

    return history


# ── Suggestions ───────────────────────────────────────────────────────────────

def create_suggestion(
    trader_id: int,
    action: str,
    symbol: str,
    quantity: int,
    price: float,
    reasoning: str | None = None,
    sources: list | None = None,
    confidence: str | None = None,
    risk_level: str | None = None,
) -> dict:
    suggestion = TradingSuggestion(
        trader_id=trader_id,
        action=action,
        symbol=symbol.upper(),
        quantity=quantity,
        price=price,
        reasoning=reasoning,
        sources=sources,
        confidence=confidence,
        risk_level=risk_level,
        status="pending",
    )
    db.session.add(suggestion)
    db.session.commit()
    return suggestion.to_dict()


def get_suggestions(user_id: int, trader_id: int, status: str | None = None) -> list[dict]:
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")
    query = TradingSuggestion.query.filter_by(trader_id=trader_id)
    if status:
        query = query.filter_by(status=status)
    suggestions = query.order_by(TradingSuggestion.created_at.desc()).all()
    return [s.to_dict() for s in suggestions]


def resolve_suggestion(user_id: int, suggestion_id: int, action: str) -> dict:
    """Approve or reject a suggestion. If approved, execute the trade."""
    suggestion = TradingSuggestion.query.get(suggestion_id)
    if not suggestion:
        raise ValueError("Suggestion not found")

    trader = TradingTrader.query.filter_by(id=suggestion.trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")

    if suggestion.status != "pending":
        raise ValueError(f"Suggestion already {suggestion.status}")

    if action == "reject":
        suggestion.status = "rejected"
        suggestion.resolved_at = datetime.now(timezone.utc)
        db.session.commit()
        return suggestion.to_dict()

    if action == "approve":
        account = TradingAccount.query.get(trader.account_id)
        current_price = market_service.get_price(suggestion.symbol)
        if current_price <= 0:
            raise ValueError(f"Could not fetch current price for {suggestion.symbol}")

        if suggestion.action == "buy":
            spread = 0.001
            buy_price = round(current_price * (1 + spread), 4)
            cost = round(buy_price * suggestion.quantity, 2)
            if cost > account.cash_balance:
                raise ValueError(f"Insufficient cash. Need ${cost:,.2f}, have ${account.cash_balance:,.2f}")

            account.cash_balance = round(account.cash_balance - cost, 2)
            holding = TradingHolding.query.filter_by(
                trader_id=trader.id, symbol=suggestion.symbol
            ).first()
            if holding:
                old_total = holding.avg_cost * holding.quantity
                holding.quantity += suggestion.quantity
                holding.avg_cost = round((old_total + cost) / holding.quantity, 4)
            else:
                holding = TradingHolding(
                    trader_id=trader.id,
                    symbol=suggestion.symbol,
                    quantity=suggestion.quantity,
                    avg_cost=buy_price,
                )
                db.session.add(holding)

            txn = TradingTransaction(
                trader_id=trader.id,
                symbol=suggestion.symbol,
                side="buy",
                quantity=suggestion.quantity,
                price=buy_price,
                total_value=cost,
                rationale=f"[Approved suggestion] {suggestion.reasoning or ''}",
            )
            db.session.add(txn)

        elif suggestion.action == "sell":
            holding = TradingHolding.query.filter_by(
                trader_id=trader.id, symbol=suggestion.symbol
            ).first()
            if not holding or holding.quantity < suggestion.quantity:
                held = holding.quantity if holding else 0
                raise ValueError(f"Cannot sell {suggestion.quantity} shares of {suggestion.symbol} — only hold {held}")

            spread = 0.001
            sell_price = round(current_price * (1 - spread), 4)
            proceeds = round(sell_price * suggestion.quantity, 2)

            account.cash_balance = round(account.cash_balance + proceeds, 2)
            holding.quantity -= suggestion.quantity
            if holding.quantity == 0:
                db.session.delete(holding)

            txn = TradingTransaction(
                trader_id=trader.id,
                symbol=suggestion.symbol,
                side="sell",
                quantity=suggestion.quantity,
                price=sell_price,
                total_value=proceeds,
                rationale=f"[Approved suggestion] {suggestion.reasoning or ''}",
            )
            db.session.add(txn)

        suggestion.status = "approved"
        suggestion.resolved_at = datetime.now(timezone.utc)
        account.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return suggestion.to_dict()

    raise ValueError("Action must be 'approve' or 'reject'")


def bulk_resolve_suggestions(user_id: int, suggestion_ids: list[int], action: str) -> list[dict]:
    """Approve or reject multiple suggestions."""
    results = []
    for sid in suggestion_ids:
        try:
            result = resolve_suggestion(user_id, sid, action)
            results.append(result)
        except ValueError as e:
            results.append({"id": sid, "error": str(e)})
    return results


# ── Strategy Advisor ──────────────────────────────────────────────────────────

def get_strategy_analysis(user_id: int, trader_id: int) -> dict:
    """Gather data needed for AI strategy analysis."""
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        raise ValueError("Trader not found")

    account = TradingAccount.query.get(trader.account_id)
    holdings = _trader_holdings_with_prices(trader)
    portfolio_value = sum(h.get("market_value", 0) for h in holdings)
    total_value = account.cash_balance + portfolio_value
    pnl = total_value - account.initial_balance

    # Get recent transactions
    txns = (
        TradingTransaction.query
        .filter_by(trader_id=trader_id)
        .order_by(TradingTransaction.executed_at.desc())
        .limit(20)
        .all()
    )

    return {
        "trader_name": trader.name,
        "strategy": trader.strategy,
        "identity": trader.identity,
        "cash_balance": account.cash_balance,
        "portfolio_value": portfolio_value,
        "total_value": total_value,
        "pnl": pnl,
        "pnl_pct": round(pnl / account.initial_balance * 100, 2) if account.initial_balance else 0,
        "holdings": holdings,
        "recent_transactions": [t.to_dict() for t in txns],
        "run_count": trader.run_count,
    }


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
