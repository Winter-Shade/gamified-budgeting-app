# BudgetQuest — Gamified Budgeting & Sustainable Finance

A full-stack web application that turns personal finance into a game while promoting sustainable spending habits. Every action — logging an expense, hitting a savings goal, reducing carbon output — earns XP, Gold, and levels you up.

**Tech Stack:** Flask · React + Vite · PostgreSQL · SQLAlchemy · JWT Auth

---

## Features

### Core Finance
- **Expense Tracking** — Log expenses by category, account, and date
- **Accounts** — Bank, wallet, and cash accounts with real balance tracking
- **Budgets** — Monthly budgets with overspend detection
- **Analytics** — Category breakdown, daily trend, budget vs actual, spending velocity, monthly comparison
- **Calendar View** — Day-by-day spending heatmap
- **Subscriptions** — Track recurring bills

### Gamification
- **XP & Levels** — Earn XP for every expense logged; level up through 10 tiers
- **Gold** — Secondary currency earned by completing challenges
- **Leaderboard** — Compete with friends by XP
- **Challenges** — Streak, budget-limit, and no-spend challenges with XP rewards
- **Friends** — Add friends, compare progress

### Sustainable Finance (Phase 1)
- **Savings Goals** — Set named goals with target amounts, deadlines, and categories; contribute and track progress
- **Financial Health Score** — Composite 0–100 score from 5 weighted sub-dimensions:
  - Savings Rate (30%), Budget Adherence (25%), Goal Progress (20%), Spending Consistency (15%), Emergency Buffer (10%)
- **Carbon Footprint** — Estimates monthly CO₂ emissions from spending using per-category emission factors (kg CO₂ per ₹100); 6-month trend chart

### Gamification Enhancements (Phase 2)
- **1–250 Savings Challenge** — Interactive 250-cell grid; check off numbers in any order (number N = save ₹N); total = ₹31,375. Two modes:
  - *Manual*: self-track, just tick off numbers
  - *Auto Transfer*: each check deducts ₹N from a linked account automatically
- **Daily Savings Challenge** — Set a fixed daily amount; check in each day to grow a streak; one grace day allowed per challenge before streak breaks
- **Eco Challenges** — 6 preset sustainability-themed challenge templates (No Dining Out, Public Transport Only, Shopping Budget Cap, etc.) that auto-create and auto-join a challenge

### Beta
- **Equity Trading Simulator** — Paper trading with AI-driven automated traders (APScheduler, market data)

---

## Project Structure

```
MajorProject-Flask/
├── app/
│   ├── __init__.py              # App factory — registers all blueprints & creates tables
│   ├── config.py
│   ├── extensions.py            # SQLAlchemy, Bcrypt
│   ├── models/
│   │   ├── user.py              # User + auth
│   │   ├── account.py           # Bank/wallet/cash accounts
│   │   ├── expense.py           # Expense records
│   │   ├── budget.py            # Monthly budgets
│   │   ├── category.py          # Expense categories (system + custom)
│   │   ├── category_budget.py   # Per-category budget caps
│   │   ├── wallet.py            # XP, Gold, Level
│   │   ├── transaction.py       # XP/Gold transaction log
│   │   ├── streak.py            # Daily login streaks
│   │   ├── challenge.py         # Community challenges
│   │   ├── challenge_participant.py
│   │   ├── friendship.py
│   │   ├── rewards_catalog.py
│   │   ├── redemption.py
│   │   ├── subscription.py
│   │   ├── savings_goal.py      # Phase 1: Savings goals
│   │   ├── carbon_emission_factor.py  # Phase 1: CO₂ lookup table
│   │   ├── challenge_250.py     # Phase 2: 1-250 challenge state
│   │   └── daily_savings.py     # Phase 2: Daily savings challenge + logs
│   ├── routes/                  # Flask blueprints (one per domain)
│   └── services/                # Business logic layer
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx    # Overview: health score, goals, charts
│       │   ├── Goals.jsx        # Phase 1: Savings Goals
│       │   ├── Carbon.jsx       # Phase 1: Carbon Footprint
│       │   ├── Challenge250.jsx # Phase 2: 1-250 grid
│       │   ├── DailySavings.jsx # Phase 2: Daily streak challenge
│       │   ├── Challenges.jsx   # Community challenges + Eco tab
│       │   └── ...
│       ├── components/
│       │   ├── Sidebar.jsx      # Navigation
│       │   └── Layout.jsx
│       └── api/api.js           # Centralised API client
├── equity-trading-prototype/    # AI trading simulator (standalone)
├── seed.py                      # Database seeder
├── run.py                       # Entry point
└── requirements.txt
```

---

## Setup & Run

### Prerequisites
- Python 3.10+
- PostgreSQL running locally
- Node.js 18+

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE budgetquest;"
```

### 2. Backend

```bash
# Install Python dependencies (uses Homebrew Python on Mac)
pip install -r requirements.txt

# Start the Flask server
PYTHONPATH=/path/to/MajorProject-Flask python3.10 run.py
```

The server starts on `http://localhost:5000`. All tables are created automatically on first run.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The React app runs on `http://localhost:5173` and proxies `/api/*` to Flask.

### 4. Seed (optional)

```bash
python seed.py
```

Creates: 1 user (`hero` / `password123`), 3 accounts, 1 budget, default categories.

---

## API Overview

All protected routes require `Authorization: Bearer <token>`.

| Domain | Endpoints |
|--------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login` |
| Accounts | `GET/POST /accounts`, `POST /accounts/:id/deposit` |
| Expenses | `GET/POST /expenses`, `PUT/DELETE /expenses/:id` |
| Budgets | `GET/POST /budgets` |
| Dashboard | `GET /dashboard` |
| Analytics | `GET /analytics`, `GET /analytics/monthly-summary` |
| Challenges | `GET/POST /challenges`, `POST /challenges/:id/join`, `GET /challenges/eco-templates` |
| Leaderboard | `GET /leaderboard` |
| **Savings Goals** | `GET/POST /goals`, `PUT/DELETE /goals/:id`, `POST /goals/:id/contribute` |
| **Health Score** | `GET /health-score` |
| **Carbon** | `GET /carbon/monthly`, `GET /carbon/trend` |
| **1-250 Challenge** | `GET /challenge-250`, `POST /challenge-250/start\|check\|uncheck\|reset` |
| **Daily Savings** | `GET /daily-savings`, `POST /daily-savings/start\|check-in\|grace\|stop` |
| Categories | `GET/POST /categories`, `POST /categories/:id/budget` |
| Subscriptions | `CRUD /subscriptions` |
| Trading (Beta) | `CRUD /trading/accounts`, `/trading/traders`, `/trading/market` |

---

## Architecture

```
Request
  │
  ▼
Route (Blueprint)          ← validates input, extracts user_id from JWT
  │
  ▼
Service                    ← all business logic lives here
  │
  ▼
Model / SQLAlchemy         ← DB queries, relationships
  │
  ▼
PostgreSQL
```

Key design decisions:
- **Single DB transaction** for expense → reward → wallet update (atomic, rollback on failure)
- **Emission factors** are static kg CO₂/₹100 per category — approximated from Indian average consumption data
- **Health Score** computed on-the-fly from live DB data; no caching needed at this scale
- **Challenge 250** stores checked steps as a JSON column — avoids a 250-row join table per user
- **Daily Savings** grace day is per-challenge, not per-day — prevents gaming

---

## Roadmap

| Phase | Status | Features |
|-------|--------|---------|
| Phase 1 | ✅ Done | Savings Goals, Health Score, Carbon Footprint |
| Phase 2 | ✅ Done | 1-250 Challenge, Daily Savings, Eco Challenges |
| Phase 3 | Planned | Gemini AI spending insights, budget recommendations, financial chatbot |
| Phase 4 | Planned | Blockchain escrow (Sepolia testnet) for 1-250 challenge |
| Phase 5 | Planned | PDF/CSV export, budget alerts, recurring income |
