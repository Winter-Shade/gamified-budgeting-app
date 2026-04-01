# BudgetQuest — Gamified Budgeting & Sustainable Finance

A full-stack web application that transforms personal finance management into an engaging, gamified experience while promoting sustainable spending habits. Built with Flask, React, PostgreSQL, and Solidity, BudgetQuest combines traditional budgeting tools with behavioral incentives — XP systems, savings challenges, carbon tracking, and blockchain-backed commitment savings — to help users build lasting financial discipline.

**Tech Stack:** Flask · React 19 + Vite · PostgreSQL · SQLAlchemy · JWT Auth · Solidity · Hardhat · ethers.js · Recharts · Lucide Icons

---

## Features

### Expense Management
- **Expense Tracking** — Log expenses with category, account, amount, description, and date. Filter by category, edit or delete entries in-place.
- **Multi-Account Support** — Create and manage multiple accounts (bank, wallet, cash) with real-time balance tracking. Deposit funds with source and description logging.
- **Custom Categories** — System-provided default categories plus user-defined custom categories. Per-category budget caps with monthly tracking.
- **Monthly Budgets** — Set a total monthly budget. Visual budget-vs-actual comparison with overspend detection alerts.
- **Subscriptions** — Track recurring bills and subscriptions with amount, frequency, and renewal dates.

### Analytics & Insights
- **Spending Analytics** — Category-wise breakdown (pie chart), daily spending trend (line chart), budget adherence (bar chart), spending velocity, and month-over-month comparison.
- **Calendar Heatmap** — Day-by-day view of spending intensity across the month. Click any date to see transactions.
- **Monthly Summary** — 6-month rolling trend of total spending with comparative analysis.

### Gamification Engine
- **XP & Leveling System** — Earn XP for every financial action (logging expenses, hitting goals, completing challenges). Progress through 10 tiers with increasing XP thresholds. XP progress bar visible in the sidebar.
- **Gold Currency** — Secondary reward currency earned by completing challenges. Redeemable from the rewards catalog.
- **Leaderboard** — Compete with friends ranked by XP. See global standings and friend-specific rankings.
- **Community Challenges** — Create or join challenges (streak-based, budget-limit, no-spend) with XP and Gold rewards. Track participation and completions.
- **Friends System** — Add friends by username, view their progress, and compare stats.

### Savings & Financial Health
- **Savings Goals** — Create named goals with target amounts, deadlines, and categories (travel, emergency, gadget, etc.). Contribute funds incrementally, track progress percentage and days remaining.
- **Financial Health Score** — A composite 0–100 score calculated from 5 weighted dimensions:
  - Savings Rate (30%) — Percentage of income being saved
  - Budget Adherence (25%) — How well spending stays within budget limits
  - Goal Progress (20%) — Progress across all active savings goals
  - Spending Consistency (15%) — Variance in daily spending patterns
  - Emergency Buffer (10%) — Ratio of liquid savings to monthly expenses
- **1–250 Savings Challenge** — An interactive 250-cell grid where checking off number N means saving ₹N. Total savings upon completion: ₹31,375. Two modes:
  - *Manual Mode* — Self-tracked; simply tick off numbers as you save
  - *Auto Transfer Mode* — Each check automatically deducts ₹N from a linked account
- **Daily Savings Challenge** — Commit to saving a fixed daily amount. Check in each day to build a streak. One grace day per challenge before the streak breaks.
- **Eco Challenges** — 6 preset sustainability-themed challenges (No Dining Out, Public Transport Only, Shopping Budget Cap, Zero Waste Week, Home Cooking, Energy Saver) that auto-create and auto-join.

### Carbon Footprint Tracking
- **Monthly CO₂ Estimation** — Estimates carbon emissions from spending using per-category emission factors (kg CO₂ per ₹100), calibrated against Indian average consumption data.
- **Carbon Budget** — Set a monthly carbon budget and track adherence.
- **6-Month Trend Chart** — Visualize carbon footprint trends over time to identify improvement areas.

### Blockchain Commitment Savings
A decentralized escrow system deployed on the Ethereum Sepolia testnet that helps users enforce savings discipline through smart contract-backed commitments.

- **Smart Contract Escrow** — Users deposit ETH into a `CommitmentSavings` Solidity contract with a configurable maturity period. Funds are locked on-chain until maturity.
- **Configurable Terms** — Choose deposit amount, interval (daily/weekly/bi-weekly/monthly), maturity period (in days), and early withdrawal penalty (5%–50%).
- **Terms & Conditions** — Users must explicitly accept immutable on-chain terms before creating a plan. Penalty rates and maturity periods cannot be changed after creation.
- **Early Withdrawal Penalty** — Withdrawing before maturity incurs a penalty (in basis points) that is deducted and sent to the contract's fee collector. After maturity, full withdrawal with zero penalty.
- **MetaMask Integration** — Connect wallet, auto-switch to Sepolia network, sign transactions for plan creation, deposits, and withdrawals directly from the browser.
- **Deposit History** — Every deposit is recorded with its transaction hash. Click to view on Sepolia Etherscan.
- **Contract:** Deployed at [`0x6F88c4a81807501Bba3E0dD66b01E53FB497FB57`](https://sepolia.etherscan.io/address/0x6F88c4a81807501Bba3E0dD66b01E53FB497FB57) on Sepolia testnet.

### Equity Trading Simulator (Beta)
- **Paper Trading** — Simulated stock trading with virtual accounts and real-time market data via Polygon API.
- **AI-Driven Traders** — Configure automated trading agents with custom strategies. Agents execute trades on a schedule using APScheduler.
- **MCP-Based Multi-Agent System** — Market data and search powered by Model Context Protocol servers. Trader agent uses LiteLLM for AI-driven decision making.
- **Portfolio Tracking** — View holdings, transaction history, P&L per trader, and account performance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React 19 + Vite                          │
│   Pages · Components · Context (Auth, Wallet) · ethers.js       │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST API (JWT Bearer)
┌──────────────────────────▼──────────────────────────────────────┐
│                     Flask Application                            │
│   Blueprints (Routes) → Services (Business Logic) → Models       │
│   20 Blueprints · JWT Auth Middleware · APScheduler               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │      PostgreSQL          │
              │  25+ tables, SQLAlchemy  │
              └─────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   Blockchain Layer                                │
│   Solidity (CommitmentSavings.sol) · Hardhat · Sepolia Testnet   │
│   ethers.js ←→ MetaMask ←→ Smart Contract                       │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **Layered architecture** — Routes handle HTTP/validation, services contain all business logic, models define schema. No business logic in routes.
- **Atomic transactions** — Expense creation, XP reward, and wallet update happen in a single DB transaction with rollback on failure.
- **Emission factors** — Static kg CO₂ per ₹100 per category, approximated from Indian average consumption data.
- **Health Score** — Computed on-the-fly from live DB data; no caching needed at current scale.
- **Challenge 250** — Checked steps stored as a JSON column to avoid a 250-row join table per user.
- **Blockchain escrow** — Penalty and maturity are immutable on-chain. Backend stores metadata for fast querying; on-chain state is the source of truth.

---

## Project Structure

```
BudgetQuest/
├── app/
│   ├── __init__.py                 # App factory, blueprint registration, table creation
│   ├── config.py                   # Environment-based configuration
│   ├── extensions.py               # SQLAlchemy, Bcrypt initialization
│   ├── models/                     # 25+ SQLAlchemy models
│   │   ├── user.py                 # User authentication & profile
│   │   ├── account.py              # Bank/wallet/cash accounts
│   │   ├── expense.py              # Expense records
│   │   ├── wallet.py               # XP, Gold, Level tracking
│   │   ├── savings_goal.py         # Savings goals with progress
│   │   ├── blockchain_savings.py   # Blockchain plans & deposits
│   │   ├── challenge_250.py        # 1-250 challenge state (JSON column)
│   │   ├── daily_savings.py        # Daily savings streaks
│   │   └── ...                     # Budget, category, challenge, trading models
│   ├── routes/                     # 20 Flask blueprints
│   │   ├── auth.py                 # Register, login (JWT)
│   │   ├── expenses.py             # CRUD + category filtering
│   │   ├── analytics.py            # Aggregated spending analytics
│   │   ├── blockchain.py           # Blockchain savings plan management
│   │   └── ...
│   └── services/                   # Business logic layer
│       ├── expense_service.py      # Expense CRUD + XP rewards
│       ├── analytics_service.py    # Spending computations
│       ├── blockchain_service.py   # Plan/deposit management
│       └── ...
├── blockchain/
│   ├── contracts/
│   │   └── CommitmentSavings.sol   # Escrow contract (Solidity 0.8.27)
│   ├── test/
│   │   └── CommitmentSavings.test.js  # 20 test cases (Hardhat + Chai)
│   ├── scripts/
│   │   └── deploy.js               # Sepolia deployment script
│   └── hardhat.config.js
├── frontend/
│   └── src/
│       ├── pages/                   # 18 page components
│       │   ├── Dashboard.jsx        # Health score, goals, charts overview
│       │   ├── Expenses.jsx         # Expense CRUD with category filter
│       │   ├── BlockchainSavings.jsx # MetaMask + escrow UI
│       │   ├── Challenge250.jsx     # Interactive 250-cell grid
│       │   └── ...
│       ├── components/
│       │   ├── Sidebar.jsx          # Navigation with 6 groups
│       │   └── Layout.jsx           # Protected layout wrapper
│       ├── context/
│       │   ├── AuthContext.jsx       # JWT auth state
│       │   └── WalletContext.jsx     # XP/level state
│       └── api/api.js               # 60+ centralized API functions
├── seed.py                          # Database seeder (demo user + data)
├── run.py                           # Flask entry point
├── requirements.txt
└── .env.sample                      # Environment variable template
```

---

## Setup & Run

### Prerequisites
- Python 3.10+
- PostgreSQL (running locally)
- Node.js 18+
- MetaMask browser extension (for blockchain features)

### 1. Clone & Configure

```bash
git clone https://github.com/Winter-Shade/gamified-budgeting-app.git
cd gamified-budgeting-app
cp .env.sample .env
# Edit .env with your API keys and database URL
```

### 2. Database

```bash
psql -U postgres -c "CREATE DATABASE budgetquest;"
```

### 3. Backend

```bash
pip install -r requirements.txt
python run.py
```

The server starts on `http://localhost:5000`. All tables are created automatically on first run.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

The React app runs on `http://localhost:5173` and proxies `/api/*` to Flask.

### 5. Blockchain (Optional)

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat test                                    # Run 20 contract tests
npx hardhat run scripts/deploy.js --network sepolia # Deploy to Sepolia
```

Requires `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in `.env`.

### 6. Seed Data (Optional)

```bash
python seed.py
```

Creates a demo user (`hero` / `password123`), 3 accounts, 1 budget, and default categories.

---

## API Reference

All protected endpoints require `Authorization: Bearer <token>`.

| Domain | Endpoints |
|--------|-----------|
| **Auth** | `POST /auth/register`, `POST /auth/login` |
| **Accounts** | `GET/POST /accounts`, `POST /accounts/:id/deposit` |
| **Expenses** | `GET/POST /expenses`, `PUT/DELETE /expenses/:id` |
| **Budgets** | `GET/POST /budgets` |
| **Categories** | `GET/POST /categories`, `PUT/DELETE /categories/:id`, `POST /categories/:id/budget` |
| **Dashboard** | `GET /dashboard` |
| **Analytics** | `GET /analytics`, `GET /analytics/monthly-summary` |
| **Calendar** | `GET /calendar` |
| **Health Score** | `GET /health-score` |
| **Savings Goals** | `GET/POST /goals`, `PUT/DELETE /goals/:id`, `POST /goals/:id/contribute` |
| **Carbon** | `GET /carbon/monthly`, `GET /carbon/trend` |
| **1-250 Challenge** | `GET /challenge-250`, `POST /challenge-250/start\|check\|uncheck\|reset` |
| **Daily Savings** | `GET /daily-savings`, `POST /daily-savings/start\|check-in\|grace\|stop` |
| **Challenges** | `GET/POST /challenges`, `POST /challenges/:id/join`, `GET /challenges/eco-templates` |
| **Blockchain** | `GET/POST /blockchain/plans`, `GET/POST /blockchain/plans/:id/deposits`, `PUT /blockchain/plans/:id/status`, `GET /blockchain/contract-info` |
| **Leaderboard** | `GET /leaderboard` |
| **Friends** | `GET/POST /friends` |
| **Subscriptions** | `CRUD /subscriptions` |
| **Trading** | `CRUD /trading/accounts`, `CRUD /trading/traders`, `GET /trading/market/quote/:symbol` |
| **Wallet** | `GET /wallet` |

---

## Smart Contract

**CommitmentSavings.sol** — Deployed on Ethereum Sepolia Testnet

| Function | Description |
|----------|-------------|
| `createPlan(depositAmount, intervalDays, maturityDays, penaltyBps)` | Create a new commitment savings plan with immutable terms |
| `deposit(planId)` | Deposit ETH into an active plan (payable) |
| `withdraw(planId)` | Withdraw funds — full after maturity, penalty-deducted before |
| `getPlanBalance(planId)` | View current locked balance |
| `calculatePenalty(planId)` | Preview penalty amount if withdrawn now |
| `isMatured(planId)` | Check if plan has passed its maturity date |
| `getUserPlans(address)` | Get all plan IDs for a wallet address |

**Test Coverage:** 20 tests covering plan creation, deposits, matured withdrawal, early withdrawal with penalty, access control, and edge cases.

---

## Environment Variables

See `.env.sample` for the full template. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Flask session/JWT secret |
| `GOOGLE_API_KEY` | Gemini API for AI features |
| `POLYGON_API_KEY` | Real-time stock market data |
| `BRAVE_API_KEY` | Web search for trading agents |
| `SEPOLIA_RPC_URL` | Ethereum Sepolia RPC endpoint (Infura/Alchemy) |
| `DEPLOYER_PRIVATE_KEY` | Wallet private key for contract deployment |

---

## License

MIT
