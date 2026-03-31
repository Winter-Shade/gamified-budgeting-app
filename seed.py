"""
Seed script for BudgetQuest — Gamified Budgeting System.

Creates:
  - 1 user (hero / hero@budgetquest.com / password123)
  - 3 accounts (Savings ₹100, Main Wallet ₹250, Cash ₹50)
  - 1 budget (₹200 for current month)
  - 3 categories (Food, Transport, Shopping) + 3 more
  - 3 sample challenges
  - Streak records
  - Sample expenses with varied dates
"""

from datetime import datetime, timezone, timedelta, date
from app import create_app
from app.extensions import db, bcrypt
from app.models.user import User
from app.models.wallet import Wallet
from app.models.account import Account
from app.models.category import Category
from app.models.budget import Budget
from app.models.expense import Expense
from app.models.streak import Streak
from app.models.challenge import Challenge
from app.models.challenge_participant import ChallengeParticipant


def seed():
    app = create_app()

    with app.app_context():
        print("🌱 Seeding database...")

        # ── Categories ─────────────────────────────────────────
        category_names = ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Other"]
        for name in category_names:
            if not Category.query.filter_by(name=name).first():
                db.session.add(Category(name=name))
        db.session.commit()
        print(f"  ✅ {len(category_names)} categories seeded")

        # ── User ───────────────────────────────────────────────
        if User.query.filter_by(email="hero@budgetquest.com").first():
            print("  ⚠️  Seed user already exists. Skipping.")
            return

        password_hash = bcrypt.generate_password_hash("password123").decode("utf-8")
        user = User(username="hero", email="hero@budgetquest.com", password_hash=password_hash)
        db.session.add(user)
        db.session.flush()

        # ── Wallet ─────────────────────────────────────────────
        wallet = Wallet(user_id=user.id)
        db.session.add(wallet)

        # ── Accounts ───────────────────────────────────────────
        accounts = [
            Account(user_id=user.id, name="Savings Account", balance=100.0, type="bank"),
            Account(user_id=user.id, name="Main Wallet", balance=250.0, type="wallet"),
            Account(user_id=user.id, name="Cash", balance=50.0, type="cash"),
        ]
        db.session.add_all(accounts)

        # ── Budget ─────────────────────────────────────────────
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        budget = Budget(user_id=user.id, amount=200.0, month=current_month)
        db.session.add(budget)

        db.session.flush()  # Get account IDs

        # ── Sample Expenses (varied dates for analytics/calendar) ──
        now = datetime.now(timezone.utc)
        food_cat = Category.query.filter_by(name="Food").first()
        transport_cat = Category.query.filter_by(name="Transport").first()
        shopping_cat = Category.query.filter_by(name="Shopping").first()

        sample_expenses = [
            Expense(user_id=user.id, account_id=accounts[1].id, category_id=food_cat.id,
                    amount=25.0, description="Lunch", created_at=now - timedelta(days=1)),
            Expense(user_id=user.id, account_id=accounts[1].id, category_id=food_cat.id,
                    amount=15.0, description="Coffee", created_at=now - timedelta(days=2)),
            Expense(user_id=user.id, account_id=accounts[0].id, category_id=transport_cat.id,
                    amount=30.0, description="Uber ride", created_at=now - timedelta(days=2)),
            Expense(user_id=user.id, account_id=accounts[2].id, category_id=shopping_cat.id,
                    amount=50.0, description="New headphones", created_at=now - timedelta(days=3)),
            Expense(user_id=user.id, account_id=accounts[1].id, category_id=food_cat.id,
                    amount=20.0, description="Dinner", created_at=now - timedelta(days=5)),
        ]
        # Adjust account balances for seeded expenses
        accounts[1].balance -= (25.0 + 15.0 + 20.0)  # 250 - 60 = 190
        accounts[0].balance -= 30.0                     # 100 - 30 = 70
        accounts[2].balance -= 50.0                     # 50 - 50 = 0
        db.session.add_all(sample_expenses)

        # ── Streaks ────────────────────────────────────────────
        streaks = [
            Streak(user_id=user.id, type="weekly", current_streak=2, longest_streak=3,
                   last_updated=now),
            Streak(user_id=user.id, type="monthly", current_streak=0, longest_streak=1,
                   last_updated=now - timedelta(days=30)),
        ]
        db.session.add_all(streaks)

        # ── Challenges ─────────────────────────────────────────
        today = date.today()
        challenges = [
            Challenge(
                title="No-Spend Weekend",
                description="Spend nothing for a full weekend (Sat-Sun).",
                type="no_spend",
                target_value=0,
                start_date=today,
                end_date=today + timedelta(days=7),
                reward_xp=10,
                created_by=user.id,
            ),
            Challenge(
                title="Budget Master",
                description="Stay under ₹150 total spending for 5 days.",
                type="budget_limit",
                target_value=150,
                start_date=today,
                end_date=today + timedelta(days=14),
                reward_xp=20,
                created_by=user.id,
            ),
            Challenge(
                title="Weekly Warrior",
                description="Log expenses every day for a week to prove discipline!",
                type="streak",
                target_value=7,
                start_date=today,
                end_date=today + timedelta(days=30),
                reward_xp=15,
                created_by=user.id,
            ),
        ]
        db.session.add_all(challenges)
        db.session.flush()

        # Auto-join hero to first challenge
        participant = ChallengeParticipant(
            challenge_id=challenges[0].id,
            user_id=user.id,
            progress_value=0,
            status="active",
        )
        db.session.add(participant)

        db.session.commit()
        print(f"  ✅ User 'hero' created (id={user.id})")
        print(f"  ✅ 3 accounts created (₹70 + ₹190 + ₹0 after expenses)")
        print(f"  ✅ Budget ₹200 for {current_month}")
        print(f"  ✅ 5 sample expenses seeded")
        print(f"  ✅ 2 streaks seeded")
        print(f"  ✅ 3 challenges seeded")
        print("🎉 Seed complete!")


if __name__ == "__main__":
    seed()
