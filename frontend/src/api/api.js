const BASE_URL = '/api';

export async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('budgetquest_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'API request failed');
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────
export const login    = (email, password)           => fetchAPI('/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) });
export const register = (username, email, password) => fetchAPI('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });

// ── Dashboard & Wallet ────────────────────────────────────────────
export const getDashboard = () => fetchAPI('/dashboard');
export const getWallet    = () => fetchAPI('/wallet');

// ── Accounts ──────────────────────────────────────────────────────
export const getAccounts   = ()                    => fetchAPI('/accounts');
export const createAccount = (name, balance, type) => fetchAPI('/accounts', { method: 'POST', body: JSON.stringify({ name, balance, type }) });
export const depositAccount = (id, amount, source, description) => fetchAPI(`/accounts/${id}/deposit`, { method: 'POST', body: JSON.stringify({ amount, source, description }) });

// ── Budgets ───────────────────────────────────────────────────────
export const getBudgets   = ()             => fetchAPI('/budgets');
export const createBudget = (amount, month)=> fetchAPI('/budgets', { method: 'POST', body: JSON.stringify({ amount, month }) });

// ── Expenses ──────────────────────────────────────────────────────
export const getExpenses   = (category_id) => fetchAPI(`/expenses${category_id ? `?category_id=${category_id}` : ''}`);
export const addExpense    = (account_id, category_id, amount, description, expense_at) =>
  fetchAPI('/expenses', { method: 'POST', body: JSON.stringify({ account_id, category_id, amount, description, expense_at }) });
export const updateExpense = (id, data)    => fetchAPI(`/expenses/${id}`, { method: 'PUT',    body: JSON.stringify(data) });
export const deleteExpense = (id)          => fetchAPI(`/expenses/${id}`, { method: 'DELETE' });

// ── Analytics ─────────────────────────────────────────────────────
export const getAnalytics      = (month)   => fetchAPI(`/analytics${month ? `?month=${month}` : ''}`);
export const getMonthlySummary = (months=6)=> fetchAPI(`/analytics/monthly-summary?months=${months}`);

// ── Calendar ──────────────────────────────────────────────────────
export const getCalendarData = (month) => fetchAPI(`/calendar${month ? `?month=${month}` : ''}`);

// ── Challenges ────────────────────────────────────────────────────
export const getChallenges       = ()      => fetchAPI('/challenges');
export const getMyChallenges     = ()      => fetchAPI('/challenges/mine');
export const createChallenge     = (data)  => fetchAPI('/challenges',      { method: 'POST', body: JSON.stringify(data) });
export const joinChallenge       = (id)    => fetchAPI(`/challenges/${id}/join`, { method: 'POST' });
export const checkCompletions    = ()      => fetchAPI('/challenges/check-completions', { method: 'POST' });

// ── Friends & Leaderboard ─────────────────────────────────────────
export const getFriends    = ()         => fetchAPI('/friends');
export const addFriend     = (username) => fetchAPI('/friends', { method: 'POST', body: JSON.stringify({ username }) });
export const getLeaderboard= ()         => fetchAPI('/leaderboard');

// ── Trading — Accounts ────────────────────────────────────────────
export const getTradingAccounts    = ()                              => fetchAPI('/trading/accounts');
export const createTradingAccount  = (name, initial_balance)        => fetchAPI('/trading/accounts', { method: 'POST', body: JSON.stringify({ name, initial_balance }) });
export const updateTradingAccount  = (id, data)                     => fetchAPI(`/trading/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTradingAccount  = (id)                           => fetchAPI(`/trading/accounts/${id}`, { method: 'DELETE' });

// ── Trading — Traders ─────────────────────────────────────────────
export const getTraders    = (account_id) => fetchAPI(`/trading/traders${account_id ? `?account_id=${account_id}` : ''}`);
export const getTrader     = (id)         => fetchAPI(`/trading/traders/${id}`);
export const createTrader  = (data)       => fetchAPI('/trading/traders',    { method: 'POST',   body: JSON.stringify(data) });
export const updateTrader  = (id, data)   => fetchAPI(`/trading/traders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTrader  = (id)         => fetchAPI(`/trading/traders/${id}`, { method: 'DELETE' });
export const runTrader     = (id)         => fetchAPI(`/trading/traders/${id}/run`,      { method: 'POST' });
export const setSchedule   = (id, interval, active=true) => fetchAPI(`/trading/traders/${id}/schedule`, { method: 'POST', body: JSON.stringify({ interval, active }) });
export const removeSchedule= (id)         => fetchAPI(`/trading/traders/${id}/schedule`, { method: 'DELETE' });

// ── Trading — Data ────────────────────────────────────────────────
export const getTraderTransactions = (id, limit=50) => fetchAPI(`/trading/traders/${id}/transactions?limit=${limit}`);
export const getMarketQuote        = (symbol)       => fetchAPI(`/trading/market/quote/${symbol.toUpperCase()}`);

// ── Categories ────────────────────────────────────────────────────
export const getCategories        = (month)          => fetchAPI(`/categories${month ? `?month=${month}` : ''}`);
export const createCategory       = (data)           => fetchAPI('/categories', { method: 'POST', body: JSON.stringify(data) });
export const updateCategory       = (id, data)       => fetchAPI(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCategory       = (id)             => fetchAPI(`/categories/${id}`, { method: 'DELETE' });
export const setCategoryBudget    = (id, amount, month) => fetchAPI(`/categories/${id}/budget`, { method: 'POST', body: JSON.stringify({ amount, month }) });
export const deleteCategoryBudget = (id, month)      => fetchAPI(`/categories/${id}/budget?month=${month}`, { method: 'DELETE' });

// ── Subscriptions ─────────────────────────────────────────────────
export const getSubscriptions    = ()           => fetchAPI('/subscriptions');
export const createSubscription  = (data)       => fetchAPI('/subscriptions', { method: 'POST', body: JSON.stringify(data) });
export const updateSubscription  = (id, data)   => fetchAPI(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSubscription  = (id)         => fetchAPI(`/subscriptions/${id}`, { method: 'DELETE' });

// ── Savings Goals ─────────────────────────────────────────────────
export const getGoals       = ()               => fetchAPI('/goals');
export const createGoal     = (data)           => fetchAPI('/goals', { method: 'POST', body: JSON.stringify(data) });
export const updateGoal     = (id, data)       => fetchAPI(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteGoal     = (id)             => fetchAPI(`/goals/${id}`, { method: 'DELETE' });
export const contributeGoal = (id, amount)     => fetchAPI(`/goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) });

// ── Financial Health Score ────────────────────────────────────────
export const getHealthScore = () => fetchAPI('/health-score');

// ── Carbon Footprint ──────────────────────────────────────────────
export const getCarbonMonthly = (month)      => fetchAPI(`/carbon/monthly${month ? `?month=${month}` : ''}`);
export const getCarbonTrend   = (months = 6) => fetchAPI(`/carbon/trend?months=${months}`);

// ── 1-250 Savings Challenge ───────────────────────────────────────
export const getChallenge250   = ()                        => fetchAPI('/challenge-250');
export const startChallenge250 = (mode, account_id)        => fetchAPI('/challenge-250/start', { method: 'POST', body: JSON.stringify({ mode, account_id }) });
export const checkStep250      = (step)                    => fetchAPI('/challenge-250/check',  { method: 'POST', body: JSON.stringify({ step }) });
export const uncheckStep250    = (step)                    => fetchAPI('/challenge-250/uncheck', { method: 'POST', body: JSON.stringify({ step }) });
export const resetChallenge250 = ()                        => fetchAPI('/challenge-250/reset',  { method: 'POST' });

// ── Daily Savings Challenge ───────────────────────────────────────
export const getDailySavings      = ()           => fetchAPI('/daily-savings');
export const startDailySavings    = (daily_amount) => fetchAPI('/daily-savings/start',   { method: 'POST', body: JSON.stringify({ daily_amount }) });
export const dailySavingsCheckIn  = ()           => fetchAPI('/daily-savings/check-in',  { method: 'POST' });
export const dailySavingsGrace    = ()           => fetchAPI('/daily-savings/grace',      { method: 'POST' });
export const stopDailySavings     = ()           => fetchAPI('/daily-savings/stop',       { method: 'POST' });

// ── Eco Challenge Templates ───────────────────────────────────────
export const getEcoTemplates = () => fetchAPI('/challenges/eco-templates');

// ── Blockchain Savings ────────────────────────────────────────────
export const getBlockchainPlans     = ()                    => fetchAPI('/blockchain/plans');
export const createBlockchainPlan   = (data)                => fetchAPI('/blockchain/plans', { method: 'POST', body: JSON.stringify(data) });
export const getBlockchainDeposits  = (planId)              => fetchAPI(`/blockchain/plans/${planId}/deposits`);
export const recordBlockchainDeposit= (planId, data)        => fetchAPI(`/blockchain/plans/${planId}/deposits`, { method: 'POST', body: JSON.stringify(data) });
export const updateBlockchainStatus = (planId, status)      => fetchAPI(`/blockchain/plans/${planId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
export const updateBlockchainOnchain= (planId, data)        => fetchAPI(`/blockchain/plans/${planId}/onchain`, { method: 'PUT', body: JSON.stringify(data) });
export const getContractInfo        = ()                    => fetchAPI('/blockchain/contract-info');
