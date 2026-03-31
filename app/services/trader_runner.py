"""
Trader Runner — executes AI-driven trade decisions.

Flow:
  1. Load trader + account + current holdings from DB
  2. Fetch live prices for held symbols (via market_service)
  3. Build a structured prompt with portfolio state + strategy
  4. Call Google Gemini API → get JSON trade decisions
  5. Execute each valid trade against the DB (update holdings, cash, log transactions)
  6. Update trader.last_run_at and run_count
"""
import json
import os
from datetime import datetime, timezone
from typing import Any

from app.extensions import db
from app.models.trading_trader import TradingTrader
from app.models.trading_account import TradingAccount
from app.models.trading_holding import TradingHolding
from app.models.trading_transaction import TradingTransaction
from app.services import market_service

SPREAD = 0.001  # 0.1% bid-ask spread simulation


def run_trader(trader_id: int) -> dict:
    """
    Execute one trading session for the given trader.
    Returns a summary of what happened.
    Raises ValueError if trader not found or Anthropic API key not set.
    """
    trader = TradingTrader.query.get(trader_id)
    if not trader:
        raise ValueError(f"Trader {trader_id} not found")

    account = TradingAccount.query.get(trader.account_id)
    if not account:
        raise ValueError("Associated trading account not found")

    # ── Build portfolio snapshot ──────────────────────────────────────────────
    holdings = {h.symbol: h.quantity for h in trader.holdings if h.quantity > 0}
    held_symbols = list(holdings.keys())
    prices = market_service.get_prices(held_symbols) if held_symbols else {}

    portfolio_lines = []
    total_holdings_value = 0.0
    for sym, qty in holdings.items():
        price = prices.get(sym, 0.0)
        val = price * qty
        total_holdings_value += val
        portfolio_lines.append(f"  {sym}: {qty} shares @ ${price:.2f} each = ${val:.2f}")

    portfolio_str = "\n".join(portfolio_lines) if portfolio_lines else "  (no holdings)"
    prices_str = "\n".join(f"  {sym}: ${p:.2f}" for sym, p in prices.items()) if prices else "  (no positions)"
    total_value = account.cash_balance + total_holdings_value

    # ── Call LLM ─────────────────────────────────────────────────────────────
    decisions = _call_llm(trader, account, holdings, prices, portfolio_str, prices_str, total_value)

    # ── Execute decisions ─────────────────────────────────────────────────────
    executed = []
    errors = []
    for decision in decisions:
        action = decision.get("action", "").lower()
        symbol = str(decision.get("symbol", "")).upper().strip()
        quantity = int(decision.get("quantity", 0))
        rationale = str(decision.get("rationale", ""))[:500]

        if action == "hold" or quantity <= 0 or not symbol:
            continue

        try:
            if action == "buy":
                price = market_service.get_price(symbol)
                if price <= 0:
                    errors.append(f"Unknown symbol: {symbol}")
                    continue
                buy_price = price * (1 + SPREAD)
                cost = buy_price * quantity
                if cost > account.cash_balance:
                    errors.append(f"Insufficient cash to buy {quantity} {symbol} (need ${cost:.2f}, have ${account.cash_balance:.2f})")
                    continue
                _record_buy(trader, account, symbol, quantity, buy_price, rationale)
                executed.append({"action": "buy", "symbol": symbol, "quantity": quantity, "price": buy_price, "rationale": rationale})

            elif action == "sell":
                holding = TradingHolding.query.filter_by(trader_id=trader_id, symbol=symbol).first()
                if not holding or holding.quantity < quantity:
                    errors.append(f"Cannot sell {quantity} {symbol}: only have {holding.quantity if holding else 0}")
                    continue
                price = market_service.get_price(symbol)
                if price <= 0:
                    errors.append(f"Unknown symbol: {symbol}")
                    continue
                sell_price = price * (1 - SPREAD)
                _record_sell(trader, account, holding, symbol, quantity, sell_price, rationale)
                executed.append({"action": "sell", "symbol": symbol, "quantity": quantity, "price": sell_price, "rationale": rationale})

        except Exception as e:
            errors.append(f"Error executing {action} {symbol}: {str(e)}")

    # ── Update trader metadata ────────────────────────────────────────────────
    trader.last_run_at = datetime.now(timezone.utc)
    trader.run_count += 1

    db.session.commit()

    return {
        "trader_id": trader_id,
        "trader_name": trader.name,
        "executed_trades": executed,
        "errors": errors,
        "cash_balance_after": round(account.cash_balance, 2),
        "run_at": trader.last_run_at.isoformat(),
    }


def _call_llm(
    trader: TradingTrader,
    account: TradingAccount,
    holdings: dict,
    prices: dict,
    portfolio_str: str,
    prices_str: str,
    total_value: float,
) -> list[dict]:
    """Call Google Gemini API and parse trade decisions."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable not set")

    from google import genai
    client = genai.Client(api_key=api_key)

    identity_line = f"\nYour trading persona: {trader.identity}" if trader.identity else ""

    prompt = f"""You are an AI stock trader named {trader.name}.{identity_line}

Your investment strategy: {trader.strategy}

Current portfolio status:
- Cash balance: ${account.cash_balance:,.2f}
- Total portfolio value: ${total_value:,.2f}

Current holdings:
{portfolio_str}

Current market prices for your holdings:
{prices_str}

Based on your strategy and portfolio state, decide what trades to make right now.

Respond ONLY with a valid JSON array. Each element must have:
- "action": "buy", "sell", or "hold"
- "symbol": ticker symbol (e.g. "AAPL", "TSLA", "SPY")
- "quantity": integer number of shares (0 for "hold")
- "rationale": brief reason (max 150 chars)

Rules:
- You cannot spend more than your available cash balance
- You cannot sell more shares than you hold
- Only use real, well-known stock ticker symbols
- If no trades are warranted, return an empty array: []
- Do not include markdown, explanations, or any text outside the JSON array

Example response: [{{"action": "buy", "symbol": "AAPL", "quantity": 10, "rationale": "Strong momentum, aligns with growth strategy"}}]"""

    response = client.models.generate_content(model=trader.model, contents=prompt)
    raw = response.text.strip()
    return _parse_decisions(raw)


def _parse_decisions(raw: str) -> list[dict]:
    """Parse LLM response into list of trade decisions. Returns [] on failure."""
    # Strip markdown code fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1]) if len(lines) > 2 else raw

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return parsed
    except json.JSONDecodeError:
        # Try extracting JSON array from the response
        import re
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return []


def _record_buy(
    trader: TradingTrader,
    account: TradingAccount,
    symbol: str,
    quantity: int,
    price: float,
    rationale: str,
) -> None:
    """Update holdings and cash for a buy. Does NOT commit."""
    total = price * quantity
    account.cash_balance -= total

    holding = TradingHolding.query.filter_by(trader_id=trader.id, symbol=symbol).first()
    if holding:
        # Update average cost
        old_total = holding.avg_cost * holding.quantity
        holding.quantity += quantity
        holding.avg_cost = (old_total + total) / holding.quantity
    else:
        holding = TradingHolding(
            trader_id=trader.id,
            symbol=symbol,
            quantity=quantity,
            avg_cost=price,
        )
        db.session.add(holding)

    txn = TradingTransaction(
        trader_id=trader.id,
        symbol=symbol,
        side="buy",
        quantity=quantity,
        price=price,
        total_value=total,
        rationale=rationale,
    )
    db.session.add(txn)


def _record_sell(
    trader: TradingTrader,
    account: TradingAccount,
    holding: TradingHolding,
    symbol: str,
    quantity: int,
    price: float,
    rationale: str,
) -> None:
    """Update holdings and cash for a sell. Does NOT commit."""
    total = price * quantity
    account.cash_balance += total

    holding.quantity -= quantity
    if holding.quantity == 0:
        db.session.delete(holding)

    txn = TradingTransaction(
        trader_id=trader.id,
        symbol=symbol,
        side="sell",
        quantity=quantity,
        price=price,
        total_value=total,
        rationale=rationale,
    )
    db.session.add(txn)
