from flask import Flask
from flask_cors import CORS
from app.config import Config
from app.extensions import db, bcrypt


def create_app(config_class=Config):
    app = Flask(__name__)
    CORS(app)
    app.config.from_object(config_class)

    # ── Initialise extensions ──────────────────────────────────
    db.init_app(app)
    bcrypt.init_app(app)

    # ── Register blueprints ────────────────────────────────────
    from app.routes.auth import auth_bp
    from app.routes.accounts import accounts_bp
    from app.routes.expenses import expenses_bp
    from app.routes.budgets import budgets_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.leaderboard import leaderboard_bp
    from app.routes.analytics import analytics_bp
    from app.routes.calendar_route import calendar_bp
    from app.routes.challenges import challenges_bp
    from app.routes.friends import friends_bp
    from app.routes.trading import trading_bp
    from app.routes.wallet import wallet_bp
    from app.routes.subscriptions import subscriptions_bp
    from app.routes.categories import categories_bp
    from app.routes.savings_goals import savings_goals_bp
    from app.routes.health_score import health_score_bp
    from app.routes.carbon import carbon_bp
    from app.routes.challenge_250 import challenge_250_bp
    from app.routes.daily_savings import daily_savings_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(accounts_bp, url_prefix="/accounts")
    app.register_blueprint(expenses_bp, url_prefix="/expenses")
    app.register_blueprint(budgets_bp, url_prefix="/budgets")
    app.register_blueprint(dashboard_bp, url_prefix="/dashboard")
    app.register_blueprint(leaderboard_bp, url_prefix="/leaderboard")
    app.register_blueprint(analytics_bp, url_prefix="/analytics")
    app.register_blueprint(calendar_bp, url_prefix="/calendar")
    app.register_blueprint(challenges_bp, url_prefix="/challenges")
    app.register_blueprint(friends_bp, url_prefix="/friends")
    app.register_blueprint(trading_bp, url_prefix="/trading")
    app.register_blueprint(wallet_bp, url_prefix="/wallet")
    app.register_blueprint(subscriptions_bp, url_prefix="/subscriptions")
    app.register_blueprint(categories_bp, url_prefix="/categories")
    app.register_blueprint(savings_goals_bp, url_prefix="/goals")
    app.register_blueprint(health_score_bp, url_prefix="/health-score")
    app.register_blueprint(carbon_bp, url_prefix="/carbon")
    app.register_blueprint(challenge_250_bp, url_prefix="/challenge-250")
    app.register_blueprint(daily_savings_bp, url_prefix="/daily-savings")

    # ── Create tables ──────────────────────────────────────────
    with app.app_context():
        from app.models import (  # noqa: F401
            user, wallet, account, category, budget, expense, transaction,
            streak, challenge, challenge_participant,
            rewards_catalog, redemption, friendship,
            trading_account, trading_trader, trading_holding, trading_transaction,
            subscription, category_budget, savings_goal,
            challenge_250, daily_savings,
        )
        db.create_all()

    # ── Start background scheduler ─────────────────────────────
    _start_scheduler(app)

    return app


def _start_scheduler(app: Flask) -> None:
    """Start APScheduler background job to run scheduled traders."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BackgroundScheduler()

        def run_due_traders():
            """Poll DB for traders whose next_run_at has passed and execute them."""
            with app.app_context():
                try:
                    from app.services.trading_service import get_due_scheduled_traders, advance_trader_schedule
                    from app.services.trader_runner import run_trader
                    due = get_due_scheduled_traders()
                    for trader in due:
                        try:
                            run_trader(trader.id)
                            advance_trader_schedule(trader)
                        except Exception as e:
                            app.logger.error(f"Scheduled run failed for trader {trader.id}: {e}")
                except Exception as e:
                    app.logger.error(f"Scheduler poll error: {e}")

        scheduler.add_job(
            func=run_due_traders,
            trigger=IntervalTrigger(minutes=1),
            id="trading_scheduler",
            name="Run due scheduled traders",
            replace_existing=True,
        )
        scheduler.start()
        app.logger.info("Trading scheduler started (polling every 1 minute)")

    except ImportError:
        app.logger.warning(
            "APScheduler not installed — scheduled trading is disabled. "
            "Run: pip install apscheduler"
        )
    except Exception as e:
        app.logger.warning(f"Could not start scheduler: {e}")
