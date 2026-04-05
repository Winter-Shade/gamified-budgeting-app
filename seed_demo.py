"""
Demo Seed Script for BudgetQuest — Expert Presentation Setup.

Creates 3 realistic user personas with 3 months of history showing:
  - Varied spending patterns across 8 categories
  - Monthly budgets + per-category budgets
  - Recurring subscriptions
  - Savings goals at various stages of progress
  - Challenge participation + completions
  - Friendships between all users
  - XP / Gold / Levels from streaks & challenge completions
  - Daily Savings Challenge progress
  - 1-250 Savings Challenge progress
  - Streaks (weekly & monthly)
  - Carbon footprint data (driven by expense categories)
  - Financial health score data (driven by budgets + expenses)

User Personas:
  1. Aarav Mehta   — disciplined saver, Level 7, high XP
  2. Priya Sharma  — moderate spender, Level 4, mid XP
  3. Rohan Gupta   — impulsive spender, Level 2, low XP

All passwords: password123
"""

import json
import random
from datetime import datetime, timezone, timedelta, date
from app import create_app
from app.extensions import db, bcrypt

# ── Models ──────────────────────────────────────────────────────────────────
from app.models.user import User
from app.models.wallet import Wallet
from app.models.account import Account
from app.models.category import Category
from app.models.category_budget import CategoryBudget
from app.models.budget import Budget
from app.models.expense import Expense
from app.models.streak import Streak
from app.models.challenge import Challenge
from app.models.challenge_participant import ChallengeParticipant
from app.models.transaction import Transaction
from app.models.friendship import Friendship
from app.models.subscription import Subscription
from app.models.savings_goal import SavingsGoal
from app.models.challenge_250 import Challenge250
from app.models.daily_savings import DailySavingsChallenge, DailySavingsLog

random.seed(42)  # Reproducible data

# ── Constants ───────────────────────────────────────────────────────────────
PASSWORD = "password123"

# Months: current month and two prior months
NOW = datetime.now(timezone.utc)
MONTHS = []
for i in range(2, -1, -1):  # 2 months ago, 1 month ago, current
    dt = NOW - timedelta(days=30 * i)
    MONTHS.append(f"{dt.year:04d}-{dt.month:02d}")

CATEGORY_DEFS = [
    ("Food",          "#FF6B6B", "utensils"),
    ("Transport",     "#4ECDC4", "car"),
    ("Shopping",      "#45B7D1", "shopping-bag"),
    ("Entertainment", "#96CEB4", "film"),
    ("Bills",         "#FFEAA7", "receipt"),
    ("Healthcare",    "#DDA0DD", "heart-pulse"),
    ("Education",     "#87CEEB", "book-open"),
    ("Other",         "#C0C0C0", "circle-dot"),
]


# ── User Personas ──────────────────────────────────────────────────────────

USERS = [
    {
        "username": "aarav_mehta",
        "email": "aarav@budgetquest.com",
        "accounts": [
            ("HDFC Savings",  80000.0,  "bank"),
            ("Paytm Wallet",  5000.0,   "wallet"),
            ("Cash",          2000.0,   "cash"),
        ],
        # Monthly total budget
        "monthly_budgets": [25000, 25000, 25000],
        # Per-category budgets (per month)
        "category_budgets": {
            "Food":          6000,
            "Transport":     3000,
            "Shopping":      4000,
            "Entertainment": 2000,
            "Bills":         5000,
            "Healthcare":    2000,
            "Education":     2000,
            "Other":         1000,
        },
        # Expense patterns per month: (category, min, max, count_range)
        "expense_patterns": [
            ("Food",          80,  600,   (12, 18)),
            ("Transport",     50,  400,   (8, 12)),
            ("Shopping",      200, 2000,  (2, 4)),
            ("Entertainment", 100, 800,   (3, 5)),
            ("Bills",         500, 2500,  (2, 4)),
            ("Healthcare",    200, 1000,  (1, 2)),
            ("Education",     300, 1500,  (1, 3)),
            ("Other",         50,  500,   (1, 3)),
        ],
        "subscriptions": [
            ("Netflix",    649,   "monthly", "streaming",  "#E50914"),
            ("Spotify",    119,   "monthly", "music",      "#1DB954"),
            ("YouTube Premium",  149, "monthly", "streaming", "#FF0000"),
            ("Amazon Prime", 1499, "yearly",  "shopping",  "#FF9900"),
            ("Gym Membership", 1500, "monthly", "fitness", "#00B4D8"),
        ],
        "savings_goals": [
            ("Emergency Fund",  200000, 145000, "emergency",  date.today() + timedelta(days=180)),
            ("MacBook Pro",      150000, 98000,  "gadget",     date.today() + timedelta(days=120)),
            ("Goa Trip",         30000,  27500,  "travel",     date.today() + timedelta(days=45)),
        ],
        "xp": 2300,
        "gold": 185,
        "level": 7,
        "weekly_streak": 8,
        "monthly_streak": 3,
        "challenge_250_steps": list(range(1, 76)),  # steps 1-75 done
        "daily_savings_amount": 200,
        "daily_savings_streak": 22,
    },
    {
        "username": "priya_sharma",
        "email": "priya@budgetquest.com",
        "accounts": [
            ("SBI Savings",   45000.0,  "bank"),
            ("PhonePe",       3000.0,   "wallet"),
            ("Cash",          1500.0,   "cash"),
        ],
        "monthly_budgets": [20000, 20000, 18000],
        "category_budgets": {
            "Food":          5000,
            "Transport":     2500,
            "Shopping":      3500,
            "Entertainment": 2000,
            "Bills":         4000,
            "Healthcare":    1000,
            "Education":     1000,
            "Other":         1000,
        },
        "expense_patterns": [
            ("Food",          100, 700,   (10, 16)),
            ("Transport",     60,  500,   (6, 10)),
            ("Shopping",      300, 3000,  (3, 6)),
            ("Entertainment", 150, 1200,  (2, 5)),
            ("Bills",         400, 2000,  (2, 3)),
            ("Healthcare",    100, 800,   (0, 2)),
            ("Education",     200, 1000,  (0, 2)),
            ("Other",         50,  400,   (1, 3)),
        ],
        "subscriptions": [
            ("Hotstar",     299,   "monthly", "streaming",  "#1F2937"),
            ("Swiggy One",  149,   "monthly", "food",       "#FC8019"),
            ("iCloud 50GB", 75,    "monthly", "software",   "#A2AAAD"),
        ],
        "savings_goals": [
            ("New Phone",    50000,  32000,  "gadget",    date.today() + timedelta(days=90)),
            ("Vacation Fund", 80000, 25000,  "travel",    date.today() + timedelta(days=200)),
        ],
        "xp": 580,
        "gold": 42,
        "level": 4,
        "weekly_streak": 4,
        "monthly_streak": 1,
        "challenge_250_steps": list(range(1, 32)),  # steps 1-31 done
        "daily_savings_amount": 100,
        "daily_savings_streak": 9,
    },
    {
        "username": "rohan_gupta",
        "email": "rohan@budgetquest.com",
        "accounts": [
            ("ICICI Savings", 22000.0,  "bank"),
            ("Google Pay",    2000.0,   "wallet"),
            ("Cash",          800.0,    "cash"),
        ],
        "monthly_budgets": [15000, 15000, 15000],
        "category_budgets": {
            "Food":          4000,
            "Transport":     2000,
            "Shopping":      3000,
            "Entertainment": 2500,
            "Bills":         2000,
            "Healthcare":    500,
            "Education":     500,
            "Other":         500,
        },
        "expense_patterns": [
            ("Food",          120, 900,   (14, 22)),
            ("Transport",     80,  600,   (8, 14)),
            ("Shopping",      500, 5000,  (4, 8)),
            ("Entertainment", 200, 2000,  (5, 8)),
            ("Bills",         300, 1500,  (2, 3)),
            ("Healthcare",    50,  300,   (0, 1)),
            ("Education",     100, 500,   (0, 1)),
            ("Other",         100, 800,   (2, 5)),
        ],
        "subscriptions": [
            ("Netflix",     649,   "monthly", "streaming",  "#E50914"),
            ("Xbox Game Pass", 699, "monthly", "gaming",    "#107C10"),
            ("Zomato Pro",  200,   "monthly", "food",       "#E23744"),
            ("Spotify",     119,   "monthly", "music",      "#1DB954"),
            ("Adobe CC",    1675,  "monthly", "software",   "#FF0000"),
        ],
        "savings_goals": [
            ("Gaming PC",   120000, 18000,  "gadget",    date.today() + timedelta(days=300)),
        ],
        "xp": 180,
        "gold": 12,
        "level": 2,
        "weekly_streak": 1,
        "monthly_streak": 0,
        "challenge_250_steps": list(range(1, 11)),  # steps 1-10 done
        "daily_savings_amount": 50,
        "daily_savings_streak": 3,
    },
]

# Expense descriptions per category
EXPENSE_DESCRIPTIONS = {
    "Food": [
        "Zomato order", "Swiggy dinner", "Grocery at BigBasket", "Street food",
        "Office lunch", "Chai & snacks", "Weekend brunch", "Fruits & veggies",
        "Rice & dal supplies", "Domino's pizza", "Cafe coffee", "Bakery items",
        "Milk & dairy", "Restaurant dinner", "Home cooking supplies",
    ],
    "Transport": [
        "Uber ride", "Ola auto", "Metro recharge", "Petrol", "Bus ticket",
        "Rapido bike", "Parking charges", "EV charging", "Train ticket",
        "Toll charges", "Cab to airport", "Auto to market",
    ],
    "Shopping": [
        "Amazon purchase", "Myntra clothing", "Flipkart order",
        "Decathlon sports gear", "Shoes", "Home decor item",
        "Kitchen appliance", "Electronics accessory", "Gift for friend",
        "Stationery", "Book purchase",
    ],
    "Entertainment": [
        "Movie tickets", "Concert booking", "OTT subscription", "Gaming purchase",
        "Amusement park", "Bowling night", "Book purchase", "Magazine sub",
        "Spotify playlist event", "Comedy show tickets",
    ],
    "Bills": [
        "Electricity bill", "Water bill", "Internet bill", "Phone recharge",
        "Gas bill", "Society maintenance", "Insurance premium",
        "Credit card payment", "Rent payment",
    ],
    "Healthcare": [
        "Doctor consultation", "Pharmacy", "Lab tests", "Health checkup",
        "Dental visit", "Eye checkup", "Physiotherapy", "Vitamins & supplements",
    ],
    "Education": [
        "Online course", "Book purchase", "Udemy course", "Coaching fees",
        "Certification exam", "Study materials", "Workshop fee",
    ],
    "Other": [
        "Miscellaneous", "Charity donation", "Temple offering", "Laundry",
        "Courier charges", "Pet supplies", "Home repair", "Key duplicate",
    ],
}


def seed():
    app = create_app()

    with app.app_context():
        print("🌱 Starting comprehensive demo seed...\n")

        # ── 1. Seed global categories ──────────────────────────
        print("📂 Creating categories...")
        cat_map = {}  # name → Category obj
        for name, color, icon in CATEGORY_DEFS:
            cat = Category.query.filter_by(name=name, user_id=None).first()
            if not cat:
                cat = Category(name=name, color=color, icon=icon)
                db.session.add(cat)
                db.session.flush()
            else:
                # Update color/icon if missing
                if not cat.color:
                    cat.color = color
                if not cat.icon:
                    cat.icon = icon
            cat_map[name] = cat
        db.session.commit()
        print(f"   ✅ {len(cat_map)} categories ready")

        # ── 2. Create users + all their data ──────────────────
        user_objects = []
        for u_data in USERS:
            user = _create_user_and_data(u_data, cat_map)
            user_objects.append(user)

        # ── 3. Create friendships (all-to-all) ────────────────
        print("\n👥 Creating friendships...")
        for i, u1 in enumerate(user_objects):
            for j, u2 in enumerate(user_objects):
                if i < j:
                    existing = Friendship.query.filter_by(
                        user_id=u1.id, friend_id=u2.id
                    ).first()
                    if not existing:
                        f1 = Friendship(user_id=u1.id, friend_id=u2.id, status="accepted")
                        f2 = Friendship(user_id=u2.id, friend_id=u1.id, status="accepted")
                        db.session.add_all([f1, f2])
        db.session.commit()
        print("   ✅ All users are friends with each other")

        # ── 4. Create shared challenges ──────────────────────
        print("\n🏆 Creating challenges...")
        _create_challenges(user_objects)
        db.session.commit()

        print("\n" + "=" * 60)
        print("🎉 DEMO SEED COMPLETE!")
        print("=" * 60)
        print(f"\n📋 Login credentials (all passwords: {PASSWORD}):")
        for u in USERS:
            print(f"   • {u['username']:20s} — {u['email']}")
        print(f"\n📅 Data spans: {MONTHS[0]} → {MONTHS[-1]}")
        print(f"📊 Categories: {', '.join(cat_map.keys())}")
        print()


def _create_user_and_data(u_data: dict, cat_map: dict):
    """Create a single user with all their associated data."""

    username = u_data["username"]

    # Skip if user already exists
    existing = User.query.filter_by(email=u_data["email"]).first()
    if existing:
        print(f"\n⚠️  User '{username}' already exists (id={existing.id}). Skipping.")
        return existing

    print(f"\n{'─' * 50}")
    print(f"👤 Creating user: {username}")
    print(f"{'─' * 50}")

    # ── User ──────────────────────────────────────────────
    pw_hash = bcrypt.generate_password_hash(PASSWORD).decode("utf-8")
    user = User(
        username=username,
        email=u_data["email"],
        password_hash=pw_hash,
        created_at=NOW - timedelta(days=95),  # account created ~3 months ago
    )
    db.session.add(user)
    db.session.flush()

    # ── Wallet (XP, Gold, Level) ──────────────────────────
    wallet = Wallet(
        user_id=user.id,
        xp=u_data["xp"],
        gold=u_data["gold"],
        level=u_data["level"],
    )
    db.session.add(wallet)

    # ── Accounts ──────────────────────────────────────────
    accounts = []
    for name, balance, acct_type in u_data["accounts"]:
        acc = Account(user_id=user.id, name=name, balance=balance, type=acct_type)
        db.session.add(acc)
        accounts.append(acc)
    db.session.flush()
    print(f"   ✅ {len(accounts)} accounts created")

    # ── Budgets (monthly overall) ────────────────────────
    for month_str, amount in zip(MONTHS, u_data["monthly_budgets"]):
        budget = Budget(user_id=user.id, amount=amount, month=month_str)
        db.session.add(budget)
    print(f"   ✅ {len(MONTHS)} monthly budgets set")

    # ── Category Budgets ──────────────────────────────────
    cat_budget_count = 0
    for cat_name, amount in u_data["category_budgets"].items():
        cat = cat_map.get(cat_name)
        if not cat:
            continue
        for month_str in MONTHS:
            cb = CategoryBudget(
                user_id=user.id,
                category_id=cat.id,
                month=month_str,
                amount=amount,
            )
            db.session.add(cb)
            cat_budget_count += 1
    print(f"   ✅ {cat_budget_count} category budgets set")

    # ── Expenses (3 months of realistic data) ─────────────
    total_expenses = 0
    total_spent = 0.0
    for month_idx, month_str in enumerate(MONTHS):
        year, mon = map(int, month_str.split("-"))
        # Distribute expenses throughout the month
        if month_idx == len(MONTHS) - 1:
            # Current month: only up to today
            days_in_month = NOW.day
        else:
            # Past months: full month
            if mon == 12:
                next_month_start = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                next_month_start = datetime(year, mon + 1, 1, tzinfo=timezone.utc)
            month_start = datetime(year, mon, 1, tzinfo=timezone.utc)
            days_in_month = (next_month_start - month_start).days

        for cat_name, min_amt, max_amt, count_range in u_data["expense_patterns"]:
            cat = cat_map.get(cat_name)
            if not cat:
                continue
            num_expenses = random.randint(*count_range)
            descriptions = EXPENSE_DESCRIPTIONS.get(cat_name, ["Expense"])

            for _ in range(num_expenses):
                day = random.randint(1, max(1, days_in_month))
                hour = random.randint(6, 23)
                minute = random.randint(0, 59)
                expense_dt = datetime(year, mon, day, hour, minute, 0, tzinfo=timezone.utc)
                amount = round(random.uniform(min_amt, max_amt), 2)

                # Pick a random account to pay from
                acct = random.choice(accounts)
                desc = random.choice(descriptions)

                expense = Expense(
                    user_id=user.id,
                    account_id=acct.id,
                    category_id=cat.id,
                    amount=amount,
                    description=desc,
                    created_at=expense_dt,
                    expense_at=expense_dt,
                )
                db.session.add(expense)
                total_expenses += 1
                total_spent += amount

                # Deduct from account balance
                acct.balance = round(acct.balance - amount, 2)

    print(f"   ✅ {total_expenses} expenses created (₹{total_spent:,.0f} total)")

    # ── Subscriptions ─────────────────────────────────────
    for sub_name, amount, cycle, category, color in u_data["subscriptions"]:
        sub = Subscription(
            user_id=user.id,
            name=sub_name,
            amount=amount,
            billing_cycle=cycle,
            category=category,
            color=color,
            is_active=True,
            next_billing_date=date.today() + timedelta(days=random.randint(1, 28)),
            created_at=NOW - timedelta(days=random.randint(30, 90)),
        )
        db.session.add(sub)
    print(f"   ✅ {len(u_data['subscriptions'])} subscriptions added")

    # ── Savings Goals ─────────────────────────────────────
    for name, target, current, category, deadline in u_data["savings_goals"]:
        goal = SavingsGoal(
            user_id=user.id,
            name=name,
            target_amount=target,
            current_amount=current,
            deadline=deadline,
            category=category,
            created_at=NOW - timedelta(days=random.randint(30, 80)),
        )
        db.session.add(goal)
    print(f"   ✅ {len(u_data['savings_goals'])} savings goals created")

    # ── Streaks ───────────────────────────────────────────
    s_weekly = Streak(
        user_id=user.id,
        type="weekly",
        current_streak=u_data["weekly_streak"],
        longest_streak=max(u_data["weekly_streak"], u_data["weekly_streak"] + 2),
        last_updated=NOW - timedelta(hours=random.randint(1, 48)),
    )
    s_monthly = Streak(
        user_id=user.id,
        type="monthly",
        current_streak=u_data["monthly_streak"],
        longest_streak=max(u_data["monthly_streak"], u_data["monthly_streak"] + 1),
        last_updated=NOW - timedelta(days=random.randint(1, 15)),
    )
    db.session.add_all([s_weekly, s_monthly])
    print(f"   ✅ Streaks: weekly={u_data['weekly_streak']}, monthly={u_data['monthly_streak']}")

    # ── XP Transactions (reward history) ──────────────────
    _create_xp_transactions(user.id, u_data["xp"])
    print(f"   ✅ Wallet: Level {u_data['level']}, {u_data['xp']} XP, {u_data['gold']} Gold")

    # ── 1-250 Savings Challenge ───────────────────────────
    steps = u_data["challenge_250_steps"]
    c250 = Challenge250(
        user_id=user.id,
        mode="manual",
        _checked_steps=json.dumps(sorted(steps)),
        created_at=NOW - timedelta(days=60),
    )
    db.session.add(c250)
    total_saved_250 = sum(steps)
    print(f"   ✅ 1-250 Challenge: {len(steps)} steps done (₹{total_saved_250:,} saved)")

    # ── Daily Savings Challenge ───────────────────────────
    streak_days = u_data["daily_savings_streak"]
    daily_amount = u_data["daily_savings_amount"]
    daily_challenge = DailySavingsChallenge(
        user_id=user.id,
        daily_amount=daily_amount,
        current_streak=streak_days,
        best_streak=streak_days + random.randint(0, 5),
        grace_used=False,
        last_log_date=date.today() - timedelta(days=1),
        is_active=True,
        started_at=NOW - timedelta(days=streak_days + 3),
    )
    db.session.add(daily_challenge)
    db.session.flush()

    # Add daily savings logs
    for day_offset in range(streak_days, 0, -1):
        log = DailySavingsLog(
            challenge_id=daily_challenge.id,
            user_id=user.id,
            log_date=date.today() - timedelta(days=day_offset),
            status="checked",
        )
        db.session.add(log)
    print(f"   ✅ Daily Savings: ₹{daily_amount}/day, {streak_days}-day streak")

    db.session.commit()
    return user


def _create_xp_transactions(user_id: int, total_xp: int):
    """Create a believable history of XP-earning transactions."""
    remaining = total_xp
    txn_types = [
        ("STREAK_REWARD",      5,   "Weekly streak reward"),
        ("STREAK_REWARD",      15,  "Monthly streak reward"),
        ("BUDGET_DISCIPLINE",  3,   "Budget discipline bonus"),
        ("CHALLENGE_COMPLETE", 10,  "Challenge completed"),
        ("CHALLENGE_COMPLETE", 15,  "Challenge completed"),
        ("CHALLENGE_COMPLETE", 20,  "Challenge completed"),
    ]

    days_back = 90
    while remaining > 0:
        txn_type, xp_amount, desc = random.choice(txn_types)
        xp_amount = min(xp_amount, remaining)
        dt = NOW - timedelta(
            days=random.randint(1, days_back),
            hours=random.randint(0, 23),
        )
        txn = Transaction(
            user_id=user_id,
            type=txn_type,
            xp_change=xp_amount,
            gold_change=random.randint(0, 2),
            description=desc,
            created_at=dt,
        )
        db.session.add(txn)
        remaining -= xp_amount


def _create_challenges(user_objects: list):
    """Create a varied set of challenges with some completed, some active."""
    today = date.today()

    challenge_defs = [
        # Past challenges (completed)
        {
            "title": "No-Spend Weekend",
            "description": "Spend absolutely nothing for a full weekend (Saturday & Sunday). Test your willpower!",
            "type": "no_spend",
            "target_value": 0,
            "start_date": today - timedelta(days=60),
            "end_date": today - timedelta(days=53),
            "reward_xp": 10,
        },
        {
            "title": "Budget Master",
            "description": "Stay under ₹500 total spending for 5 consecutive days. Discipline wins!",
            "type": "budget_limit",
            "target_value": 500,
            "start_date": today - timedelta(days=45),
            "end_date": today - timedelta(days=31),
            "reward_xp": 20,
        },
        {
            "title": "Weekly Warrior",
            "description": "Log every single expense for 7 days straight. Awareness is the first step!",
            "type": "streak",
            "target_value": 7,
            "start_date": today - timedelta(days=30),
            "end_date": today - timedelta(days=16),
            "reward_xp": 15,
        },
        # Active challenges (current)
        {
            "title": "Frugal Fortnight",
            "description": "Keep total spending under ₹8,000 for 14 days. Plan your meals and commute!",
            "type": "budget_limit",
            "target_value": 8000,
            "start_date": today - timedelta(days=5),
            "end_date": today + timedelta(days=9),
            "reward_xp": 25,
        },
        {
            "title": "Zero Junk Food Week",
            "description": "Avoid ordering food delivery for an entire week. Cook at home and save!",
            "type": "no_spend",
            "target_value": 0,
            "start_date": today - timedelta(days=2),
            "end_date": today + timedelta(days=5),
            "reward_xp": 12,
        },
        {
            "title": "30-Day Tracker",
            "description": "Log expenses every single day for 30 days. Build the habit that transforms finances!",
            "type": "streak",
            "target_value": 30,
            "start_date": today - timedelta(days=10),
            "end_date": today + timedelta(days=20),
            "reward_xp": 30,
        },
        # Future challenge
        {
            "title": "Eco Saver Sprint",
            "description": "Reduce transport spending by 30% compared to last month. Go green, save green!",
            "type": "budget_limit",
            "target_value": 2000,
            "start_date": today + timedelta(days=3),
            "end_date": today + timedelta(days=17),
            "reward_xp": 20,
        },
    ]

    # Challenge status per user:
    # Aarav: completed first 3, active in current 3
    # Priya: completed first 2, active in current 3
    # Rohan: completed 1, active in 2

    user_participation = {
        0: {  # Aarav
            0: ("completed", 1.0),
            1: ("completed", 1.0),
            2: ("completed", 1.0),
            3: ("active", 0.6),
            4: ("active", 0.4),
            5: ("active", 0.35),
        },
        1: {  # Priya
            0: ("completed", 1.0),
            1: ("completed", 1.0),
            2: ("active", 0.8),          # didn't finish in time
            3: ("active", 0.5),
            4: ("active", 0.3),
            5: ("active", 0.2),
        },
        2: {  # Rohan
            0: ("completed", 1.0),
            1: ("failed", 0.4),          # didn't make it
            3: ("active", 0.25),
            5: ("active", 0.1),
        },
    }

    for c_idx, c_def in enumerate(challenge_defs):
        challenge = Challenge(
            title=c_def["title"],
            description=c_def["description"],
            type=c_def["type"],
            target_value=c_def["target_value"],
            start_date=c_def["start_date"],
            end_date=c_def["end_date"],
            reward_xp=c_def["reward_xp"],
            created_by=user_objects[0].id,
        )
        db.session.add(challenge)
        db.session.flush()

        # Add participants
        for u_idx, user in enumerate(user_objects):
            if c_idx in user_participation.get(u_idx, {}):
                status, progress_pct = user_participation[u_idx][c_idx]
                target = c_def["target_value"] if c_def["target_value"] > 0 else 1
                progress = round(target * progress_pct, 1)

                participant = ChallengeParticipant(
                    challenge_id=challenge.id,
                    user_id=user.id,
                    progress_value=progress,
                    status=status,
                    joined_at=datetime.combine(
                        c_def["start_date"],
                        datetime.min.time(),
                    ).replace(tzinfo=timezone.utc) + timedelta(hours=random.randint(1, 48)),
                )
                db.session.add(participant)

    print(f"   ✅ {len(challenge_defs)} challenges created with varied participation")


if __name__ == "__main__":
    seed()
