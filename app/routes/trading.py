"""
Trading Blueprint — endpoints for the equity trading beta feature.

Routes:
  POST   /trading/accounts              — Create trading account
  GET    /trading/accounts              — List trading accounts
  PUT    /trading/accounts/<id>         — Update account (balance, reset)
  DELETE /trading/accounts/<id>         — Delete account

  POST   /trading/traders               — Create trader
  GET    /trading/traders               — List traders (optionally filtered by account)
  GET    /trading/traders/<id>          — Get single trader with holdings + portfolio value
  PUT    /trading/traders/<id>          — Update trader (name, strategy, model, identity)
  DELETE /trading/traders/<id>          — Delete trader

  POST   /trading/traders/<id>/run      — Run trader once (synchronous)
  POST   /trading/traders/<id>/schedule — Set/update schedule
  DELETE /trading/traders/<id>/schedule — Deactivate schedule
  GET    /trading/traders/<id>/transactions — Transaction history
  GET    /trading/traders/<id>/portfolio-history — Portfolio value over time

  GET    /trading/market/quote/<symbol> — Live stock price
"""
from flask import Blueprint, request, jsonify
from app.routes import token_required
from app.services import trading_service
from app.services.trader_runner import run_trader
from app.services.market_service import get_price

trading_bp = Blueprint("trading", __name__)


# ── Accounts ──────────────────────────────────────────────────────────────────

@trading_bp.route("/accounts", methods=["POST"])
@token_required
def create_account(user_id):
    data = request.get_json(silent=True) or {}
    name = data.get("name", "My Trading Account")
    try:
        initial_balance = float(data.get("initial_balance", 10000))
    except (TypeError, ValueError):
        return jsonify({"error": "initial_balance must be a number"}), 400
    try:
        result = trading_service.create_trading_account(user_id, name, initial_balance)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/accounts", methods=["GET"])
@token_required
def list_accounts(user_id):
    return jsonify(trading_service.get_trading_accounts(user_id)), 200


@trading_bp.route("/accounts/<int:account_id>", methods=["PUT"])
@token_required
def update_account(user_id, account_id):
    data = request.get_json(silent=True) or {}
    try:
        result = trading_service.update_trading_account(user_id, account_id, **data)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/accounts/<int:account_id>", methods=["DELETE"])
@token_required
def delete_account(user_id, account_id):
    try:
        return jsonify(trading_service.delete_trading_account(user_id, account_id)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ── Traders ───────────────────────────────────────────────────────────────────

@trading_bp.route("/traders", methods=["POST"])
@token_required
def create_trader(user_id):
    data = request.get_json(silent=True) or {}
    required = ["account_id", "name", "strategy"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        result = trading_service.create_trader(
            user_id=user_id,
            account_id=int(data["account_id"]),
            name=str(data["name"]),
            strategy=str(data["strategy"]),
            identity=data.get("identity"),
            model=data.get("model", "gemini-2.0-flash"),
        )
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/traders", methods=["GET"])
@token_required
def list_traders(user_id):
    account_id = request.args.get("account_id", type=int)
    return jsonify(trading_service.get_traders(user_id, account_id=account_id)), 200


@trading_bp.route("/traders/<int:trader_id>", methods=["GET"])
@token_required
def get_trader(user_id, trader_id):
    try:
        return jsonify(trading_service.get_trader(user_id, trader_id)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@trading_bp.route("/traders/<int:trader_id>", methods=["PUT"])
@token_required
def update_trader(user_id, trader_id):
    data = request.get_json(silent=True) or {}
    try:
        result = trading_service.update_trader(user_id, trader_id, **data)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/traders/<int:trader_id>", methods=["DELETE"])
@token_required
def delete_trader(user_id, trader_id):
    try:
        return jsonify(trading_service.delete_trader(user_id, trader_id)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ── Run & Schedule ────────────────────────────────────────────────────────────

@trading_bp.route("/traders/<int:trader_id>/run", methods=["POST"])
@token_required
def run_trader_once(user_id, trader_id):
    """Run the trader immediately once. Synchronous — waits for LLM response."""
    from app.models.trading_trader import TradingTrader
    trader = TradingTrader.query.filter_by(id=trader_id, user_id=user_id).first()
    if not trader:
        return jsonify({"error": "Trader not found"}), 404
    try:
        result = run_trader(trader_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Trader run failed: {str(e)}"}), 500


@trading_bp.route("/traders/<int:trader_id>/schedule", methods=["POST"])
@token_required
def set_schedule(user_id, trader_id):
    """
    POST /trading/traders/<id>/schedule
    Body: {"interval": "hourly", "active": true}
    Intervals: manual | hourly | every_6h | every_12h | daily | weekly
    """
    data = request.get_json(silent=True) or {}
    interval = data.get("interval", "manual")
    active = bool(data.get("active", True))
    try:
        result = trading_service.set_trader_schedule(user_id, trader_id, interval, active)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/traders/<int:trader_id>/schedule", methods=["DELETE"])
@token_required
def remove_schedule(user_id, trader_id):
    try:
        result = trading_service.set_trader_schedule(user_id, trader_id, "manual", False)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# ── Transactions & Portfolio ──────────────────────────────────────────────────

@trading_bp.route("/traders/<int:trader_id>/transactions", methods=["GET"])
@token_required
def get_transactions(user_id, trader_id):
    limit = request.args.get("limit", 50, type=int)
    try:
        return jsonify(trading_service.get_transactions(user_id, trader_id, limit=limit)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@trading_bp.route("/traders/<int:trader_id>/portfolio-history", methods=["GET"])
@token_required
def portfolio_history(user_id, trader_id):
    try:
        return jsonify(trading_service.get_portfolio_value_history(user_id, trader_id)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ── Market Data ───────────────────────────────────────────────────────────────

@trading_bp.route("/market/quote/<symbol>", methods=["GET"])
@token_required
def market_quote(user_id, symbol):
    """GET /trading/market/quote/AAPL — Get live stock price."""
    symbol = symbol.upper().strip()
    price = get_price(symbol)
    if price == 0.0:
        return jsonify({"error": f"Could not fetch price for {symbol}"}), 404
    return jsonify({"symbol": symbol, "price": price}), 200
