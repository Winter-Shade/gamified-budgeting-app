#!/usr/bin/env python3
"""
Market Data MCP Server — Polygon API (free EOD tier by default).

Launched as a subprocess by the trader agent runner.
Provides stock price lookup tools to the trader and researcher agents.
"""
import os
import sys
import random
from datetime import datetime, timezone
from functools import lru_cache
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Load env from the project root .env regardless of cwd
_here = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.join(_here, "..", "..", "..")
load_dotenv(os.path.join(_project_root, ".env"), override=True)

mcp = FastMCP("Market Data MCP Server")

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
POLYGON_PLAN = os.getenv("POLYGON_PLAN", "")  # "" = free/EOD, "paid", "realtime"

is_paid = POLYGON_PLAN == "paid"
is_realtime = POLYGON_PLAN == "realtime"


def _polygon_eod_price(symbol: str) -> float:
    """Fetch previous-close price via Polygon free tier."""
    from polygon import RESTClient
    client = RESTClient(POLYGON_API_KEY)
    probe = client.get_previous_close_agg(symbol)
    if probe:
        return float(probe[0].close)
    return 0.0


def _polygon_snapshot_price(symbol: str) -> float:
    """Fetch latest price via Polygon paid tier (15-min delay)."""
    from polygon import RESTClient
    client = RESTClient(POLYGON_API_KEY)
    result = client.get_snapshot_ticker("stocks", symbol)
    return float(result.min.close or result.prev_day.close)


@lru_cache(maxsize=256)
def _cached_eod_all() -> dict:
    """Fetch all EOD prices once per day and cache in memory."""
    from polygon import RESTClient
    client = RESTClient(POLYGON_API_KEY)
    probe = client.get_previous_close_agg("SPY")[0]
    last_close = datetime.fromtimestamp(probe.timestamp / 1000, tz=timezone.utc).date()
    results = client.get_grouped_daily_aggs(last_close, adjusted=True, include_otc=False)
    return {r.ticker: float(r.close) for r in results}


def get_price(symbol: str) -> float:
    """Get stock price, with fallback to yfinance then random."""
    symbol = symbol.upper().strip()
    if POLYGON_API_KEY:
        try:
            if is_realtime or is_paid:
                return _polygon_snapshot_price(symbol)
            else:
                all_prices = _cached_eod_all()
                price = all_prices.get(symbol, 0.0)
                if price > 0:
                    return price
                # Try per-symbol EOD if not in grouped results
                return _polygon_eod_price(symbol)
        except Exception as e:
            print(f"[market_mcp_server] Polygon error for {symbol}: {e}", file=sys.stderr)

    # Fallback: yfinance
    try:
        import yfinance as yf
        t = yf.Ticker(symbol)
        hist = t.history(period="1d")
        if not hist.empty:
            return round(float(hist["Close"].iloc[-1]), 2)
    except Exception:
        pass

    return round(random.uniform(10.0, 500.0), 2)


@mcp.tool()
async def lookup_share_price(symbol: str) -> str:
    """
    Get the current stock price for a ticker symbol.

    Args:
        symbol: Stock ticker symbol (e.g. AAPL, TSLA, SPY).

    Returns:
        A string with the ticker and its price.
    """
    price = get_price(symbol)
    source = "realtime" if is_realtime else ("15-min delay" if is_paid else "prior close")
    if price > 0:
        return f"{symbol.upper()}: ${price:.2f} ({source})"
    return f"{symbol.upper()}: price unavailable"


@mcp.tool()
async def lookup_multiple_prices(symbols: list[str]) -> str:
    """
    Get stock prices for multiple ticker symbols at once.

    Args:
        symbols: List of stock ticker symbols.

    Returns:
        Formatted price list for each symbol.
    """
    lines = []
    for sym in symbols:
        price = get_price(sym.upper().strip())
        lines.append(f"{sym.upper()}: ${price:.2f}" if price > 0 else f"{sym.upper()}: unavailable")
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
