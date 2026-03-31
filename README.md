# BudgetQuest — Gamified Budgeting System (Phase 1 MVP)

A production-ready Flask backend for a gamified budgeting system. Every expense triggers a financial update, a reward computation (XP/Gold), and a transaction log — turning budgeting into a game.

## Tech Stack

- **Python 3.10+** / **Flask 3.x**
- **PostgreSQL** / **SQLAlchemy ORM**
- **JWT** authentication (PyJWT)
- Clean architecture: `routes/ → services/ → models/`

---

## Project Structure

```
├── app/
│   ├── __init__.py          # App factory
│   ├── config.py            # Configuration
│   ├── extensions.py        # SQLAlchemy, Bcrypt
│   ├── models/              # 7 SQLAlchemy models
│   ├── routes/              # 6 Flask blueprints
│   └── services/            # 8 service modules
├── seed.py                  # Database seeder
├── run.py                   # Entry point
└── requirements.txt
```

---

## Setup & Run

### 1. Prerequisites

- Python 3.10+
- PostgreSQL running locally

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE budgetquest;"
```

### 3. Install dependencies

```bash
cd MajorProject-Flask
pip install -r requirements.txt
```

### 4. (Optional) Configure environment

Create a `.env` file or export variables:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/budgetquest"
export SECRET_KEY="your-secret-key"
```

> Defaults work out of the box for local development.

### 5. Run the server

```bash
python run.py
```

Tables are created automatically on first startup.

### 6. Seed the database

```bash
python seed.py
```

Creates: 1 user (`hero`/`password123`), 3 accounts (₹100, ₹250, ₹50), 1 budget (₹200), 6 categories.

---

## API Reference & curl Examples

### Auth

**Register**
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

**Login**
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hero@budgetquest.com","password":"password123"}'
```

> Save the returned `token` for authenticated requests below.

```bash
export TOKEN="<paste-token-here>"
```

---

### Accounts

**Create Account**
```bash
curl -X POST http://localhost:5000/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Emergency Fund","balance":500,"type":"bank"}'
```

**List Accounts**
```bash
curl http://localhost:5000/accounts \
  -H "Authorization: Bearer $TOKEN"
```

---

### Expenses

**Add Expense** *(triggers reward engine)*
```bash
curl -X POST http://localhost:5000/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"account_id":1,"category_id":1,"amount":30}'
```

Response includes:
- expense details
- updated account balance
- rewards earned (XP, Gold, Level)

**List Expenses**
```bash
curl http://localhost:5000/expenses \
  -H "Authorization: Bearer $TOKEN"
```

---

### Budgets

**Create Budget**
```bash
curl -X POST http://localhost:5000/budgets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount":200,"month":"2026-03"}'
```

**List Budgets** *(includes computed spent/remaining)*
```bash
curl http://localhost:5000/budgets \
  -H "Authorization: Bearer $TOKEN"
```

---

### Dashboard

**Get Dashboard**
```bash
curl http://localhost:5000/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "total_balance": 370.0,
  "total_spent": 30.0,
  "remaining_budget": 170.0,
  "xp": 3,
  "level": 1,
  "gold": 1
}
```

---

### Leaderboard

**Get Leaderboard** *(public — no auth required)*
```bash
curl http://localhost:5000/leaderboard
curl "http://localhost:5000/leaderboard?limit=5"
```

---

## Core Logic: Expense → Reward Pipeline

```
POST /expenses
  │
  ├── 1. Validate input (account ownership, sufficient balance)
  ├── 2. Deduct amount from account
  ├── 3. Insert expense record
  ├── 4. Compute reward: xp = min(5, floor(amount × 0.1)), gold = 1
  ├── 5. Create transaction log (EXPENSE_REWARD)
  ├── 6. Update wallet (xp, gold, level = xp ÷ 100 + 1)
  └── 7. COMMIT (atomic — rollback on any failure)
```

---

## Constraints Enforced

| Constraint | Implementation |
|---|---|
| No negative account balance | Validated before deduction in `expense_service` |
| User data isolation | `@token_required` decorator injects `user_id`; all queries filter by it |
| DB atomicity | Expense + reward + wallet update wrapped in single DB transaction |
| One budget per month | Unique constraint on `(user_id, month)` |
| Account type validation | SQL CHECK constraint: `bank`, `wallet`, `cash` |
| Transaction type validation | SQL CHECK constraint: `EXPENSE_REWARD`, `BUDGET_REWARD` |
