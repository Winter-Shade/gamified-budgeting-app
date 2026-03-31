import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import {
  LayoutDashboard, Receipt, CreditCard, PiggyBank,
  BarChart2, CalendarDays, Zap, Trophy, Users,
  TrendingUp, LogOut, Wallet, MonitorPlay, Tag,
} from 'lucide-react';

const NAV = [
  {
    group: 'Main',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/expenses',  icon: Receipt,         label: 'Expenses'  },
      { to: '/accounts',  icon: CreditCard,      label: 'Accounts'  },
      { to: '/budgets',   icon: PiggyBank,       label: 'Budgets'   },
    ],
  },
  {
    group: 'Insights',
    items: [
      { to: '/analyse',  icon: BarChart2,    label: 'Analyse'  },
      { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
    ],
  },
  {
    group: 'Community',
    items: [
      { to: '/challenges',  icon: Zap,   label: 'Challenges'  },
      { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
      { to: '/friends',     icon: Users,  label: 'Friends'     },
    ],
  },
  {
    group: 'Finance',
    items: [
      { to: '/categories',   icon: Tag,         label: 'Categories'   },
      { to: '/subscriptions', icon: MonitorPlay, label: 'Subscriptions' },
    ],
  },
  {
    group: 'Beta',
    items: [
      { to: '/trading', icon: TrendingUp, label: 'Trading', beta: true },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = (user?.username || 'H').slice(0, 2).toUpperCase();
  const lvlPct   = wallet.level_progress_pct ?? 0;

  return (
    <aside style={{
      width: 228,
      flexShrink: 0,
      background: 'var(--surface-container-low)',
      borderRight: '1px solid var(--outline)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '1.125rem 1.125rem 0.625rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <div style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #4f3bdb, #9D85FF)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Wallet size={17} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-0.02em', color: 'var(--on-surface)' }}>
          BudgetQuest
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.375rem 0.625rem' }}>
        {NAV.map(({ group, items }) => (
          <div key={group} style={{ marginBottom: '0.125rem' }}>
            <p style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--on-surface-variant)',
              padding: '0.625rem 0.625rem 0.25rem', opacity: 0.55,
            }}>
              {group}
            </p>
            {items.map(({ to, icon: Icon, label, beta }) => (
              <NavLink
                key={to} to={to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 0.625rem',
                  borderRadius: 10,
                  marginBottom: 1,
                  textDecoration: 'none',
                  fontSize: '0.8125rem', fontWeight: 600,
                  color: isActive ? 'var(--primary-dim)' : 'var(--on-surface-variant)',
                  background: isActive ? 'rgba(157,133,255,0.1)' : 'transparent',
                  transition: 'all 0.15s',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {beta && (
                      <span style={{
                        fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.06em',
                        padding: '2px 5px', borderRadius: 999,
                        background: 'rgba(16,217,160,0.15)', color: 'var(--tertiary)',
                        border: '1px solid rgba(16,217,160,0.25)',
                      }}>BETA</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Panel */}
      <div style={{ padding: '0.625rem', borderTop: '1px solid var(--outline)' }}>
        <div style={{
          background: 'var(--surface-container)',
          border: '1px solid var(--outline)',
          borderRadius: 14,
          padding: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #4f3bdb, #9D85FF)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.username || 'Hero'}
              </p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>
                Level {wallet.level} · {wallet.xp} XP
              </p>
            </div>
            <button onClick={handleLogout} title="Log out" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--on-surface-variant)', display: 'flex', padding: 4, borderRadius: 6,
              transition: 'color 0.15s',
            }}>
              <LogOut size={14} />
            </button>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--on-surface-variant)' }}>XP to next level</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--primary)', fontWeight: 700 }}>{Math.round(lvlPct)}%</span>
            </div>
            <div className="progress-track" style={{ height: 4, borderRadius: 999 }}>
              <div className="progress-fill progress-primary" style={{ width: `${lvlPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
