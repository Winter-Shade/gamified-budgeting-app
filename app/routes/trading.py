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
  PUT    /trading/traders/<id>          — Update trader (name, strategy, model, identity, require_approval)
  DELETE /trading/traders/<id>          — Delete trader

  POST   /trading/traders/<id>/run      — Run trader once (synchronous)
  POST   /trading/traders/<id>/schedule — Set/update schedule
  DELETE /trading/traders/<id>/schedule — Deactivate schedule
  GET    /trading/traders/<id>/transactions — Transaction history
  GET    /trading/traders/<id>/portfolio-history — Portfolio value over time

  POST   /trading/transfer              — Transfer funds from user account to trading account
  POST   /trading/traders/<id>/import-csv — Import portfolio from CSV

  GET    /trading/traders/<id>/suggestions — List suggestions
  POST   /trading/suggestions/<id>/resolve — Approve or reject a suggestion
  POST   /trading/suggestions/bulk-resolve — Bulk approve/reject suggestions

  POST   /trading/traders/<id>/strategy-advisor — Get AI strategy advice

  GET    /trading/market/quote/<symbol> — Live stock price
  GET    /trading/user-accounts         — List user's bank accounts for fund transfer
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


# ── Fund Transfer ─────────────────────────────────────────────────────────────

@trading_bp.route("/transfer", methods=["POST"])
@token_required
def transfer_funds(user_id):
    """Transfer funds from a user bank account to a trading account."""
    data = request.get_json(silent=True) or {}
    source_account_id = data.get("source_account_id")
    trading_account_id = data.get("trading_account_id")
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400

    if not source_account_id or not trading_account_id:
        return jsonify({"error": "source_account_id and trading_account_id are required"}), 400

    try:
        result = trading_service.transfer_funds_to_account(
            user_id, int(source_account_id), int(trading_account_id), amount
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/user-accounts", methods=["GET"])
@token_required
def list_user_accounts(user_id):
    """List user's bank accounts (for fund transfer source selection)."""
    from app.models.account import Account
    accounts = Account.query.filter_by(user_id=user_id).all()
    return jsonify([
        {"id": a.id, "name": a.name, "balance": round(a.balance, 2), "type": a.type}
        for a in accounts
    ]), 200


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
            require_approval=bool(data.get("require_approval", False)),
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


# ── CSV Portfolio Import ──────────────────────────────────────────────────────

@trading_bp.route("/traders/<int:trader_id>/import-csv", methods=["POST"])
@token_required
def import_csv(user_id, trader_id):
    """Import a portfolio from CSV. Accepts JSON body with csv_content string."""
    data = request.get_json(silent=True) or {}
    csv_content = data.get("csv_content", "")
    if not csv_content.strip():
        return jsonify({"error": "csv_content is required"}), 400
    try:
        result = trading_service.import_portfolio_csv(user_id, trader_id, csv_content)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


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


# ── Suggestions ───────────────────────────────────────────────────────────────

@trading_bp.route("/traders/<int:trader_id>/suggestions", methods=["GET"])
@token_required
def get_suggestions(user_id, trader_id):
    status = request.args.get("status")
    try:
        return jsonify(trading_service.get_suggestions(user_id, trader_id, status=status)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@trading_bp.route("/suggestions/<int:suggestion_id>/resolve", methods=["POST"])
@token_required
def resolve_suggestion(user_id, suggestion_id):
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    if action not in ("approve", "reject"):
        return jsonify({"error": "action must be 'approve' or 'reject'"}), 400
    try:
        result = trading_service.resolve_suggestion(user_id, suggestion_id, action)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@trading_bp.route("/suggestions/bulk-resolve", methods=["POST"])
@token_required
def bulk_resolve(user_id):
    data = request.get_json(silent=True) or {}
    ids = data.get("suggestion_ids", [])
    action = data.get("action")
    if action not in ("approve", "reject"):
        return jsonify({"error": "action must be 'approve' or 'reject'"}), 400
    if not ids:
        return jsonify({"error": "suggestion_ids required"}), 400
    results = trading_service.bulk_resolve_suggestions(user_id, ids, action)
    return jsonify(results), 200


# ── Strategy Advisor ──────────────────────────────────────────────────────────

@trading_bp.route("/traders/<int:trader_id>/strategy-advisor", methods=["POST"])
@token_required
def strategy_advisor(user_id, trader_id):
    """Get AI-powered strategy analysis and recommendations."""
    try:
        analysis = trading_service.get_strategy_analysis(user_id, trader_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404

    data = request.get_json(silent=True) or {}
    user_question = data.get("question", "")

    from app.services.strategy_advisor import get_strategy_advice
    try:
        advice = get_strategy_advice(analysis, user_question)
        return jsonify(advice), 200
    except Exception as e:
        return jsonify({"error": f"Strategy advisor failed: {str(e)}"}), 500


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
