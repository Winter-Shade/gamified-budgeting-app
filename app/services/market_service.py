"""
Market Service — stock price fetching via yfinance.

yfinance requires no API key and uses Yahoo Finance data.
Prices are cached for 5 minutes to avoid hammering Yahoo Finance.
"""
import time
from typing import Any

_price_cache: dict[str, tuple[float, float]] = {}  # symbol → (price, timestamp)
CACHE_TTL = 300  # 5 minutes


def get_price(symbol: str) -> float:
    """Get current price for a single stock symbol. Returns 0.0 if not found."""
    symbol = symbol.upper().strip()
    cached = _price_cache.get(symbol)
    if cached and (time.time() - cached[1]) < CACHE_TTL:
        return cached[0]

    price = _fetch_price(symbol)
    _price_cache[symbol] = (price, time.time())
    return price


def get_prices(symbols: list[str]) -> dict[str, float]:
    """Get prices for multiple symbols. Returns dict of symbol → price."""
    if not symbols:
        return {}
    result = {}
    missing = []
    for sym in symbols:
        sym = sym.upper().strip()
        cached = _price_cache.get(sym)
        if cached and (time.time() - cached[1]) < CACHE_TTL:
            result[sym] = cached[0]
        else:
            missing.append(sym)

    if missing:
        fetched = _fetch_prices_bulk(missing)
        for sym, price in fetched.items():
            _price_cache[sym] = (price, time.time())
            result[sym] = price
        # Any missing ones get 0.0
        for sym in missing:
            if sym not in result:
                result[sym] = 0.0

    return result


def _fetch_price(symbol: str) -> float:
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1d")
        if hist.empty:
            return 0.0
        return round(float(hist["Close"].iloc[-1]), 2)
    except Exception:
        return 0.0


def _fetch_prices_bulk(symbols: list[str]) -> dict[str, float]:
    try:
        import yfinance as yf
        if len(symbols) == 1:
            price = _fetch_price(symbols[0])
            return {symbols[0]: price}

        data = yf.download(symbols, period="1d", progress=False, auto_adjust=True)
        if data.empty:
            return {}

        close = data["Close"]
        result = {}
        if len(symbols) == 1:
            sym = symbols[0]
            val = close.iloc[-1]
            result[sym] = round(float(val), 2) if val == val else 0.0
        else:
            for sym in symbols:
                try:
                    val = close[sym].iloc[-1]
                    result[sym] = round(float(val), 2) if val == val else 0.0
                except (KeyError, IndexError):
                    result[sym] = 0.0
        return result
    except Exception:
        return {}


def invalidate_cache(symbol: str | None = None):
    """Clear price cache. Pass None to clear all."""
    if symbol:
        _price_cache.pop(symbol.upper(), None)
    else:
        _price_cache.clear()
