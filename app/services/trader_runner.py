"""
Trader Runner — bridge between Flask (sync) and the async MCP-based trader agent.

Flow:
  Flask route / APScheduler → run_trader(trader_id)
    → asyncio.run(run_trader_agent(...))   # full multi-agent loop
    → returns summary dict
"""
import asyncio


def run_trader(trader_id: int) -> dict:
    """
    Execute one trading session for the given trader.
    Alternates between trade (find new opportunities) and rebalance sessions
    based on the trader's run_count (even = trade, odd = rebalance).

    Returns a summary dict with keys: trader_id, trader_name, session, summary, errors, run_at.
    """
    from flask import current_app
    from app.models.trading_trader import TradingTrader

    app = current_app._get_current_object()

    with app.app_context():
        trader = TradingTrader.query.get(trader_id)
        if not trader:
            raise ValueError(f"Trader {trader_id} not found")
        # Even run_count → trade session; odd → rebalance session
        do_trade = (trader.run_count % 2) == 0

    from app.services.equity.trader_agent import run_trader_agent

    try:
        result = asyncio.run(run_trader_agent(trader_id, app, do_trade=do_trade))
    except RuntimeError as e:
        # asyncio.run() fails if there's already a running event loop
        if "cannot run nested" in str(e).lower():
            try:
                import nest_asyncio
                nest_asyncio.apply()
            except ImportError:
                pass
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(run_trader_agent(trader_id, app, do_trade=do_trade))
        else:
            raise

    return result
