import React from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { Zap, Coins } from 'lucide-react';

const PAGE_TITLES = {
  '/dashboard':   'Dashboard',
  '/expenses':    'Expenses',
  '/accounts':    'Accounts',
  '/budgets':     'Budgets',
  '/analyse':     'Analytics',
  '/calendar':    'Calendar',
  '/challenges':  'Challenges',
  '/leaderboard': 'Leaderboard',
  '/friends':     'Friends',
  '/trading':     'Trading Lab',
  '/subscriptions':'Subscriptions',
  '/categories':   'Categories',
};

const PAGE_SUBTITLES = {
  '/dashboard':   'Your financial overview',
  '/expenses':    'Track and manage spending',
  '/accounts':    'Manage your accounts',
  '/budgets':     'Monthly budget planning',
  '/analyse':     'Spending insights & trends',
  '/calendar':    'Daily spending heatmap',
  '/challenges':  'Complete goals, earn rewards',
  '/leaderboard': 'Top savers this month',
  '/friends':     'Your financial squad',
  '/trading':     'AI-powered equity simulation',
  '/subscriptions':'Recurring expenses',
  '/categories':   'Custom categories & per-category budgets',
};

export default function TopNavBar() {
  const { wallet } = useWallet();
  const { pathname } = useLocation();

  const title    = PAGE_TITLES[pathname]    ?? 'BudgetQuest';
  const subtitle = PAGE_SUBTITLES[pathname] ?? '';

  return (
    <header style={{
      height: 60,
      flexShrink: 0,
      background: 'rgba(7,7,14,0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--outline)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.75rem',
      gap: '1rem',
    }}>
      {/* Page title */}
      <div>
        <h1 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-surface)', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 1 }}>{subtitle}</p>
        )}
      </div>

      {/* Right pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* XP pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '5px 11px',
          background: 'rgba(157,133,255,0.1)',
          border: '1px solid rgba(157,133,255,0.2)',
          borderRadius: 999,
          fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dim)',
        }}>
          <Zap size={12} fill="currentColor" />
          {wallet.xp} XP
        </div>

        {/* Gold pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '5px 11px',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 999,
          fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)',
        }}>
          <Coins size={12} />
          {wallet.gold}G
        </div>

        {/* Level badge */}
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #4f3bdb, #9D85FF)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 800, color: '#fff',
        }}>
          {wallet.level}
        </div>
      </div>
    </header>
  );
}
