"""
Market Service — stock price fetching.

Priority:
  1. Polygon API (free EOD tier unless POLYGON_PLAN=paid/realtime)
  2. yfinance (no API key, Yahoo Finance data)

Prices cached in-memory for 5 minutes.
"""
import os
import time
from functools import lru_cache
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(override=True)

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
POLYGON_PLAN = os.getenv("POLYGON_PLAN", "")  # "" = free/EOD, "paid", "realtime"

_is_paid = POLYGON_PLAN in ("paid", "realtime")

_price_cache: dict[str, tuple[float, float]] = {}  # symbol → (price, timestamp)
CACHE_TTL = 300  # 5 minutes


# ── Public API ────────────────────────────────────────────────────────────────

def get_price(symbol: str) -> float:
    """Get current price for a single stock symbol. Returns 0.0 if not found."""
    symbol = symbol.upper().strip()
    cached = _price_cache.get(symbol)
    if cached and (time.time() - cached[1]) < CACHE_TTL:
        return cached[0]

    price = _fetch_single(symbol)
    _price_cache[symbol] = (price, time.time())
    return price


def get_prices(symbols: list[str]) -> dict[str, float]:
    """Get prices for multiple symbols. Returns dict of symbol → price."""
    if not symbols:
        return {}

    result: dict[str, float] = {}
    missing: list[str] = []

    for sym in symbols:
        sym = sym.upper().strip()
        cached = _price_cache.get(sym)
        if cached and (time.time() - cached[1]) < CACHE_TTL:
            result[sym] = cached[0]
        else:
            missing.append(sym)

    if missing:
        fetched = _fetch_bulk(missing)
        for sym, price in fetched.items():
            _price_cache[sym] = (price, time.time())
            result[sym] = price
        for sym in missing:
            if sym not in result:
                result[sym] = 0.0

    return result


def invalidate_cache(symbol: str | None = None) -> None:
    if symbol:
        _price_cache.pop(symbol.upper(), None)
    else:
        _price_cache.clear()


# ── Polygon ───────────────────────────────────────────────────────────────────

@lru_cache(maxsize=2)
def _polygon_eod_bulk_cached(date_str: str) -> dict:
    """Fetch all EOD prices for a given date, cached by date string."""
    from polygon import RESTClient
    try:
        client = RESTClient(POLYGON_API_KEY)
        probe = client.get_previous_close_agg("SPY")[0]
        last_close = datetime.fromtimestamp(probe.timestamp / 1000, tz=timezone.utc).date()
        results = client.get_grouped_daily_aggs(last_close, adjusted=True, include_otc=False)
        return {r.ticker: float(r.close) for r in results}
    except Exception:
        return {}


def _polygon_single_eod(symbol: str) -> float:
    from polygon import RESTClient
    try:
        client = RESTClient(POLYGON_API_KEY)
        results = client.get_previous_close_agg(symbol)
        if results:
            return float(results[0].close)
    except Exception:
        pass
    return 0.0


def _polygon_snapshot(symbol: str) -> float:
    from polygon import RESTClient
    try:
        client = RESTClient(POLYGON_API_KEY)
        result = client.get_snapshot_ticker("stocks", symbol)
        return float(result.min.close or result.prev_day.close)
    except Exception:
        return 0.0


def _fetch_via_polygon(symbol: str) -> float:
    if _is_paid:
        return _polygon_snapshot(symbol)
    today = datetime.now().strftime("%Y-%m-%d")
    bulk = _polygon_eod_bulk_cached(today)
    price = bulk.get(symbol, 0.0)
    if price > 0:
        return price
    return _polygon_single_eod(symbol)


# ── yfinance fallback ─────────────────────────────────────────────────────────

def _fetch_via_yfinance_single(symbol: str) -> float:
    try:
        import yfinance as yf
        t = yf.Ticker(symbol)
        hist = t.history(period="1d")
        if not hist.empty:
            return round(float(hist["Close"].iloc[-1]), 2)
    except Exception:
        pass
    return 0.0


def _fetch_via_yfinance_bulk(symbols: list[str]) -> dict[str, float]:
    try:
        import yfinance as yf
        if len(symbols) == 1:
            return {symbols[0]: _fetch_via_yfinance_single(symbols[0])}
        data = yf.download(symbols, period="1d", progress=False, auto_adjust=True)
        if data.empty:
            return {}
        close = data["Close"]
        result = {}
        for sym in symbols:
            try:
                val = close[sym].iloc[-1]
                result[sym] = round(float(val), 2) if val == val else 0.0
            except (KeyError, IndexError):
                result[sym] = 0.0
        return result
    except Exception:
        return {}


# ── Unified fetch ─────────────────────────────────────────────────────────────

def _fetch_single(symbol: str) -> float:
    if POLYGON_API_KEY:
        price = _fetch_via_polygon(symbol)
        if price > 0:
            return price
    return _fetch_via_yfinance_single(symbol)


def _fetch_bulk(symbols: list[str]) -> dict[str, float]:
    result: dict[str, float] = {}

    if POLYGON_API_KEY:
        if not _is_paid:
            today = datetime.now().strftime("%Y-%m-%d")
            bulk = _polygon_eod_bulk_cached(today)
            for sym in symbols:
                if sym in bulk:
                    result[sym] = bulk[sym]

        missing = [s for s in symbols if result.get(s, 0.0) == 0.0]
        for sym in missing:
            p = _fetch_via_polygon(sym)
            if p > 0:
                result[sym] = p

    still_missing = [s for s in symbols if result.get(s, 0.0) == 0.0]
    if still_missing:
        yf_prices = _fetch_via_yfinance_bulk(still_missing)
        result.update(yf_prices)

    return result
