"""
Equity Trader Agent — MCP-based multi-agent trading runner.

Architecture:
  Trader Agent (Gemini via openai-agents SDK)
    ├── [function tool] get_portfolio()       → Flask PostgreSQL (in-process)
    ├── [function tool] buy_shares(...)        → Flask PostgreSQL (in-process)
    ├── [function tool] sell_shares(...)       → Flask PostgreSQL (in-process)
    ├── [function tool] change_strategy(...)   → Flask PostgreSQL (in-process)
    ├── [agent tool]    Researcher             → sub-agent with MCP servers
    └── [MCP]           market_mcp_server.py   → Polygon API (subprocess)

Researcher Agent
    ├── [MCP] search_mcp_server.py  → Brave Search API (subprocess)
    ├── [MCP] mcp-server-fetch      → web page fetching  (subprocess via uvx)
    └── [MCP] market_mcp_server.py  → Polygon API (subprocess)
"""
import asyncio
import os
import sys
from contextlib import AsyncExitStack
from datetime import datetime, timezone

from dotenv import load_dotenv

# Load .env from project root
_here = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_here, "..", "..", ".."))
load_dotenv(os.path.join(_project_root, ".env"), override=True)

SPREAD = 0.001  # 0.1% bid-ask spread

# ── Agents SDK setup ──────────────────────────────────────────────────────────

from agents import Agent, Runner, trace, set_tracing_export_api_key, function_tool
from agents.extensions.models.litellm_model import LitellmModel
from agents.mcp import MCPServerStdio

# Configure tracing if OpenAI key present
_openai_key = os.getenv("OPENAI_API_KEY")
if _openai_key:
    set_tracing_export_api_key(_openai_key)

# Point LiteLLM at Gemini — GEMINI_API_KEY is what litellm reads for gemini/ models
os.environ.setdefault("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))

_MARKET_SERVER = os.path.join(_here, "market_mcp_server.py")
_SEARCH_SERVER = os.path.join(_here, "search_mcp_server.py")
_PYTHON = sys.executable  # same Python that's running Flask


def _get_model(model_name: str = "gemini-2.0-flash") -> LitellmModel:
    return LitellmModel(model=f"gemini/{model_name}")


# ── In-process account tools (write directly to Flask's PostgreSQL) ───────────

def _make_account_tools(trader_id: int, account_id: int, app):
    """
    Return a list of function_tool-decorated callables that operate
    on the Flask DB inside an explicit app context.
    """

    @function_tool
    def get_portfolio() -> str:
        """
        Get your current portfolio: cash balance, holdings with current prices, and total value.
        Call this first to understand your current position before making decisions.
        """
        with app.app_context():
            from app.models.trading_account import TradingAccount
            from app.models.trading_holding import TradingHolding
            from app.services import market_service

            account = TradingAccount.query.get(account_id)
            holdings = TradingHolding.query.filter_by(trader_id=trader_id).filter(TradingHolding.quantity > 0).all()

            lines = [f"Cash balance: ${account.cash_balance:,.2f}"]
            total_holdings_value = 0.0
            if holdings:
                symbols = [h.symbol for h in holdings]
                prices = market_service.get_prices(symbols)
                for h in holdings:
                    price = prices.get(h.symbol, 0.0)
                    market_val = price * h.quantity
                    total_holdings_value += market_val
                    pnl = (price - h.avg_cost) * h.quantity
                    lines.append(
                        f"{h.symbol}: {h.quantity} shares @ avg cost ${h.avg_cost:.2f} | "
                        f"current ${price:.2f} | value ${market_val:,.2f} | P&L ${pnl:+,.2f}"
                    )
            else:
                lines.append("Holdings: none")

            total_value = account.cash_balance + total_holdings_value
            pnl = total_value - account.initial_balance
            lines.append(f"\nTotal portfolio value: ${total_value:,.2f}")
            lines.append(f"Overall P&L: ${pnl:+,.2f} ({pnl/account.initial_balance*100:+.1f}%)")
            return "\n".join(lines)

    @function_tool
    def buy_shares(symbol: str, quantity: int, rationale: str) -> str:
        """
        Buy shares of a stock.

        Args:
            symbol: The stock ticker symbol to buy (e.g. AAPL, TSLA, SPY).
            quantity: Number of shares to purchase. Must be a positive integer.
            rationale: Brief explanation of why you are buying (max 200 chars).

        Returns:
            Confirmation of the trade or an error message.
        """
        if quantity <= 0:
            return f"Error: quantity must be positive, got {quantity}"

        with app.app_context():
            from app.models.trading_account import TradingAccount
            from app.models.trading_holding import TradingHolding
            from app.models.trading_transaction import TradingTransaction
            from app.extensions import db
            from app.services import market_service

            account = TradingAccount.query.get(account_id)
            price = market_service.get_price(symbol.upper())
            if price <= 0:
                return f"Error: could not get price for {symbol}. Try a different ticker."

            buy_price = round(price * (1 + SPREAD), 4)
            cost = round(buy_price * quantity, 2)

            if cost > account.cash_balance:
                max_qty = int(account.cash_balance / buy_price)
                return (
                    f"Error: insufficient cash. Need ${cost:,.2f} but have ${account.cash_balance:,.2f}. "
                    f"Maximum you can buy: {max_qty} shares."
                )

            account.cash_balance = round(account.cash_balance - cost, 2)

            holding = TradingHolding.query.filter_by(trader_id=trader_id, symbol=symbol.upper()).first()
            if holding:
                old_total = holding.avg_cost * holding.quantity
                holding.quantity += quantity
                holding.avg_cost = round((old_total + cost) / holding.quantity, 4)
            else:
                holding = TradingHolding(
                    trader_id=trader_id,
                    symbol=symbol.upper(),
                    quantity=quantity,
                    avg_cost=buy_price,
                )
                db.session.add(holding)

            txn = TradingTransaction(
                trader_id=trader_id,
                symbol=symbol.upper(),
                side="buy",
                quantity=quantity,
                price=buy_price,
                total_value=cost,
                rationale=rationale[:500],
            )
            db.session.add(txn)
            db.session.commit()

            return f"✓ Bought {quantity} shares of {symbol.upper()} @ ${buy_price:.2f} each (total ${cost:,.2f}). Cash remaining: ${account.cash_balance:,.2f}"

    @function_tool
    def sell_shares(symbol: str, quantity: int, rationale: str) -> str:
        """
        Sell shares of a stock you currently hold.

        Args:
            symbol: The stock ticker symbol to sell (e.g. AAPL).
            quantity: Number of shares to sell. Must be positive and ≤ shares held.
            rationale: Brief explanation of why you are selling (max 200 chars).

        Returns:
            Confirmation of the trade or an error message.
        """
        if quantity <= 0:
            return f"Error: quantity must be positive, got {quantity}"

        with app.app_context():
            from app.models.trading_account import TradingAccount
            from app.models.trading_holding import TradingHolding
            from app.models.trading_transaction import TradingTransaction
            from app.extensions import db
            from app.services import market_service

            account = TradingAccount.query.get(account_id)
            holding = TradingHolding.query.filter_by(trader_id=trader_id, symbol=symbol.upper()).first()

            if not holding or holding.quantity < quantity:
                held = holding.quantity if holding else 0
                return f"Error: cannot sell {quantity} shares of {symbol} — you only hold {held}."

            price = market_service.get_price(symbol.upper())
            if price <= 0:
                return f"Error: could not get price for {symbol}."

            sell_price = round(price * (1 - SPREAD), 4)
            proceeds = round(sell_price * quantity, 2)

            account.cash_balance = round(account.cash_balance + proceeds, 2)
            holding.quantity -= quantity
            if holding.quantity == 0:
                db.session.delete(holding)

            txn = TradingTransaction(
                trader_id=trader_id,
                symbol=symbol.upper(),
                side="sell",
                quantity=quantity,
                price=sell_price,
                total_value=proceeds,
                rationale=rationale[:500],
            )
            db.session.add(txn)
            db.session.commit()

            return f"✓ Sold {quantity} shares of {symbol.upper()} @ ${sell_price:.2f} each (proceeds ${proceeds:,.2f}). Cash balance: ${account.cash_balance:,.2f}"

    @function_tool
    def change_strategy(new_strategy: str) -> str:
        """
        Update your investment strategy. Use this if market conditions have changed
        and you want to evolve your approach.

        Args:
            new_strategy: The new strategy description (plain text).

        Returns:
            Confirmation that the strategy was updated.
        """
        with app.app_context():
            from app.models.trading_trader import TradingTrader
            from app.extensions import db

            trader = TradingTrader.query.get(trader_id)
            trader.strategy = new_strategy.strip()
            db.session.commit()
            return "✓ Strategy updated successfully."

    return [get_portfolio, buy_shares, sell_shares, change_strategy]


# ── MCP server config helpers ─────────────────────────────────────────────────

def _mcp_env() -> dict:
    """Pass relevant env vars to MCP subprocess servers."""
    return {
        k: v for k, v in os.environ.items()
        if k in (
            "POLYGON_API_KEY", "POLYGON_PLAN",
            "BRAVE_API_KEY", "SERPER_API_KEY",
            "GOOGLE_API_KEY", "GEMINI_API_KEY",
            "HOME", "PATH", "PYTHONPATH",
        ) and v
    }


# ── Main agent runner ─────────────────────────────────────────────────────────

async def run_trader_agent(trader_id: int, app, do_trade: bool = True) -> dict:
    """
    Run one session of the trader agent:
      - do_trade=True  → look for new opportunities and execute trades
      - do_trade=False → rebalance existing portfolio

    Must be called with an active Flask app context available via `app`.
    """
    from app.models.trading_trader import TradingTrader
    from app.models.trading_account import TradingAccount
    from app.extensions import db

    with app.app_context():
        trader = TradingTrader.query.get(trader_id)
        if not trader:
            raise ValueError(f"Trader {trader_id} not found")
        account = TradingAccount.query.get(trader.account_id)

        # Snapshot for logging (plain data, not ORM objects)
        trader_name = trader.name
        trader_identity = trader.identity
        trader_strategy = trader.strategy
        trader_model = trader.model
        account_id = trader.account_id
        initial_balance = account.initial_balance

    # Build in-process account tools
    account_tools = _make_account_tools(trader_id, account_id, app)

    model = _get_model(trader_model)

    mcp_env = _mcp_env()

    from app.services.equity.prompts import (
        researcher_instructions,
        trader_instructions,
        trade_message,
        rebalance_message,
    )

    errors = []
    result_summary = ""

    try:
        async with AsyncExitStack() as stack:
            # Launch MCP subprocess servers
            market_mcp = await stack.enter_async_context(
                MCPServerStdio(
                    {"command": _PYTHON, "args": [_MARKET_SERVER], "env": mcp_env},
                    client_session_timeout_seconds=120,
                )
            )
            search_mcp = await stack.enter_async_context(
                MCPServerStdio(
                    {"command": _PYTHON, "args": [_SEARCH_SERVER], "env": mcp_env},
                    client_session_timeout_seconds=120,
                )
            )
            fetch_mcp = await stack.enter_async_context(
                MCPServerStdio(
                    {"command": "uvx", "args": ["mcp-server-fetch"], "env": {"PATH": os.environ.get("PATH", "")}},
                    client_session_timeout_seconds=60,
                )
            )

            # Researcher sub-agent (has search + fetch + market data)
            researcher = Agent(
                name="Researcher",
                instructions=researcher_instructions(),
                model=model,
                mcp_servers=[search_mcp, fetch_mcp, market_mcp],
            )
            researcher_tool = researcher.as_tool(
                tool_name="Researcher",
                tool_description=(
                    "Research financial news, market conditions, and investment opportunities online. "
                    "Describe what you want researched and this tool will return a comprehensive summary."
                ),
            )

            # Build portfolio summary synchronously before agent starts
            with app.app_context():
                from app.models.trading_account import TradingAccount
                from app.models.trading_holding import TradingHolding
                from app.services import market_service

                account = TradingAccount.query.get(account_id)
                holdings = TradingHolding.query.filter_by(trader_id=trader_id).filter(TradingHolding.quantity > 0).all()
                held_symbols = [h.symbol for h in holdings]
                prices = market_service.get_prices(held_symbols) if held_symbols else {}

                portfolio_lines = [f"Cash: ${account.cash_balance:,.2f}"]
                total_held_value = 0.0
                for h in holdings:
                    p = prices.get(h.symbol, 0.0)
                    val = p * h.quantity
                    total_held_value += val
                    portfolio_lines.append(f"  {h.symbol}: {h.quantity} shares @ ${p:.2f} = ${val:,.2f}")
                total_value = account.cash_balance + total_held_value
                pnl = total_value - initial_balance
                portfolio_lines.append(f"Total value: ${total_value:,.2f} | P&L: ${pnl:+,.2f}")
                portfolio_summary = "\n".join(portfolio_lines)

            # Trader agent
            trader_agent = Agent(
                name=trader_name,
                instructions=trader_instructions(trader_name, trader_identity, trader_strategy),
                model=model,
                tools=[*account_tools, researcher_tool],
                mcp_servers=[market_mcp],
            )

            # Build the session message
            if do_trade:
                message = trade_message(trader_name, portfolio_summary)
                session_label = f"{trader_name}-trade"
            else:
                message = rebalance_message(trader_name, portfolio_summary)
                session_label = f"{trader_name}-rebalance"

            # Run with tracing
            with trace(session_label):
                run_result = await Runner.run(trader_agent, message, max_turns=30)
                result_summary = run_result.final_output or ""

    except Exception as e:
        errors.append(str(e))
        print(f"[trader_agent] Error running {trader_name}: {e}", file=sys.stderr)

    # Update trader metadata in DB
    with app.app_context():
        from app.models.trading_trader import TradingTrader
        from app.extensions import db
        trader = TradingTrader.query.get(trader_id)
        if trader:
            trader.last_run_at = datetime.now(timezone.utc)
            trader.run_count = (trader.run_count or 0) + 1
            db.session.commit()

    return {
        "trader_id": trader_id,
        "trader_name": trader_name,
        "session": "trade" if do_trade else "rebalance",
        "summary": result_summary,
        "errors": errors,
        "run_at": datetime.now(timezone.utc).isoformat(),
    }
