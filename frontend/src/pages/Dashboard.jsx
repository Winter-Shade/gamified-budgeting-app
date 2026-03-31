import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getDashboard, getAnalytics, getMyChallenges, getAccounts } from '../api/api';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingDown, ShieldCheck, Zap, Coins,
  ArrowRight, Flame, Target, Ban, CheckCircle2, Circle, Plus,
} from 'lucide-react';

const CHALLENGE_ICONS = { streak: Flame, budget_limit: Target, no_spend: Ban };

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--surface-container-high)', border:'1px solid var(--outline)', borderRadius:10, padding:'8px 12px' }}>
      <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)', marginBottom:2 }}>{label}</p>
      <p style={{ fontSize:'0.875rem', fontWeight:700, color:'var(--primary)' }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const navigate = useNavigate();

  const [dash, setDash]           = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, a, c, accs] = await Promise.all([getDashboard(), getAnalytics(), getMyChallenges(), getAccounts()]);
      setDash(d);
      setAnalytics(a);
      setChallenges(c.filter(ch => ch.my_status === 'active').slice(0, 3));
      setAccounts(accs);
      refreshWallet();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [refreshWallet]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner" style={{ width:36, height:36 }} />
    </div>
  );

  const totalBalance  = dash?.total_balance ?? 0;
  const totalSpent    = dash?.total_spent   ?? 0;
  const budgetAmount  = dash?.budget_amount  ?? 0;
  const remaining     = dash?.remaining_budget ?? null;
  const accountCount  = accounts.length;

  const setupSteps = [
    { label: 'Add an account', done: accountCount > 0, to: '/accounts', hint: 'Set your starting balance' },
    { label: 'Set a monthly budget', done: budgetAmount > 0, to: '/budgets', hint: 'Plan how much to spend' },
    { label: 'Log your first expense', done: (dash?.recent_transactions?.length ?? 0) > 0, to: '/expenses', hint: 'Start tracking your spending' },
  ];
  const allDone = setupSteps.every(s => s.done);
  const spentPct     = budgetAmount > 0 ? Math.min(100, (totalSpent / budgetAmount) * 100) : 0;
  const weeklyData   = (dash?.weekly_summary ?? []).map(d => ({
    ...d, label: new Date(d.date).toLocaleDateString('en', { weekday:'short' }),
  }));
  const recent       = dash?.recent_transactions ?? [];
  const velocity     = analytics?.spending_velocity;
  const comparison   = analytics?.monthly_comparison;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem', animation:'fadeIn 0.3s ease' }}>
      {/* Greeting */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginBottom:2 }}>
            {greeting()}, <span style={{ color:'var(--primary-dim)', fontWeight:700 }}>{user?.username || 'Hero'}</span> 👋
          </p>
          <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Your Financial Overview</h2>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
          </p>
          {velocity?.on_track != null && (
            <p style={{ fontSize:'0.75rem', marginTop:2, fontWeight:600 }}>
              <span style={{ color: velocity.on_track ? 'var(--tertiary)' : 'var(--error)' }}>
                {velocity.on_track ? '✓ On track' : '⚠ Over pace'}
              </span>
              <span style={{ color:'var(--on-surface-variant)', marginLeft:4 }}>
                · ~{fmt(velocity.projected_total)} projected
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Onboarding checklist — shown until all steps are done */}
      {!allDone && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(79,59,219,0.18), rgba(157,133,255,0.08))',
          border: '1px solid rgba(157,133,255,0.25)',
          borderRadius: 16,
          padding: '1.25rem 1.5rem',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--primary-dim)', marginBottom: 2 }}>
                Let's get you set up
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                Complete these steps to start tracking your finances
              </p>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-dim)', fontWeight: 700 }}>
              {setupSteps.filter(s => s.done).length}/{setupSteps.length} done
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {setupSteps.map((step, i) => (
              <button key={i} onClick={() => navigate(step.to)}
                disabled={step.done}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '0.875rem 1rem',
                  background: step.done ? 'rgba(16,217,160,0.07)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${step.done ? 'rgba(16,217,160,0.2)' : 'rgba(157,133,255,0.15)'}`,
                  borderRadius: 12,
                  cursor: step.done ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                {step.done
                  ? <CheckCircle2 size={18} color="var(--tertiary)" style={{ flexShrink: 0, marginTop: 1 }} />
                  : <Circle size={18} color="var(--primary-dim)" style={{ flexShrink: 0, marginTop: 1 }} />
                }
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: step.done ? 'var(--tertiary)' : 'var(--on-surface)', marginBottom: 2 }}>
                    {step.done ? <s style={{ opacity: 0.6 }}>{step.label}</s> : step.label}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{step.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem' }}>
        {/* Total Balance */}
        <div className="hero-card" onClick={accountCount === 0 ? () => navigate('/accounts') : undefined}
          style={{ cursor: accountCount === 0 ? 'pointer' : 'default' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:32, height:32, background:'rgba(255,255,255,0.15)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Wallet size={16} color="#fff" />
            </div>
            <span style={{ fontSize:'0.75rem', fontWeight:600, opacity:0.85 }}>Total Balance</span>
          </div>
          {accountCount === 0 ? (
            <>
              <p style={{ fontSize:'1rem', fontWeight:700, lineHeight:1.3, opacity:0.9 }}>No accounts yet</p>
              <p style={{ fontSize:'0.7rem', opacity:0.7, marginTop:6, display:'flex', alignItems:'center', gap:4 }}>
                <Plus size={11} /> Add your first account
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1.1 }}>{fmt(totalBalance)}</p>
              <p style={{ fontSize:'0.7rem', opacity:0.7, marginTop:6 }}>{accountCount} account{accountCount !== 1 ? 's' : ''}</p>
            </>
          )}
        </div>

        {/* Spent This Month */}
        <div className="stat-card stat-card-secondary">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:32, height:32, background:'rgba(245,158,11,0.15)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <TrendingDown size={16} color="var(--secondary)" />
            </div>
            <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--on-surface-variant)' }}>Spent This Month</span>
          </div>
          <p style={{ fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.03em', color:'var(--secondary)' }}>{fmt(totalSpent)}</p>
          {budgetAmount > 0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)' }}>{fmt(totalSpent)} / {fmt(budgetAmount)}</span>
                <span style={{ fontSize:'0.65rem', fontWeight:700, color: spentPct > 90 ? 'var(--error)' : 'var(--secondary)' }}>{Math.round(spentPct)}%</span>
              </div>
              <div className="progress-track" style={{ height:4 }}>
                <div className="progress-fill" style={{ width:`${spentPct}%`, background: spentPct>90?'var(--error)':'var(--secondary)' }} />
              </div>
            </div>
          )}
        </div>

        {/* Budget Left */}
        <div className={`stat-card ${remaining != null && remaining < 0 ? 'stat-card-error' : 'stat-card-tertiary'}`}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:32, height:32, background:'rgba(16,217,160,0.15)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ShieldCheck size={16} color="var(--tertiary)" />
            </div>
            <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--on-surface-variant)' }}>Budget Left</span>
          </div>
          {remaining != null ? (
            <>
              <p style={{ fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.03em', color: remaining >= 0 ? 'var(--tertiary)' : 'var(--error)' }}>
                {remaining >= 0 ? fmt(remaining) : `-${fmt(-remaining)}`}
              </p>
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginTop:6 }}>
                {remaining >= 0 ? 'remaining this month' : 'over budget'}
              </p>
            </>
          ) : (
            <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', marginTop:8 }}>No budget set</p>
          )}
        </div>

        {/* XP / Level */}
        <div className="stat-card">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:32, height:32, background:'rgba(157,133,255,0.15)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Zap size={16} color="var(--primary)" />
            </div>
            <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--on-surface-variant)' }}>Adventure</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
            <p style={{ fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.03em' }} className="gradient-text">Lvl {wallet.level}</p>
            <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>{wallet.xp} XP</span>
          </div>
          <div>
            <div className="progress-track" style={{ height:4 }}>
              <div className="progress-fill progress-primary" style={{ width:`${wallet.level_progress_pct ?? 0}%` }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontSize:'0.6rem', color:'var(--on-surface-variant)' }}>{wallet.current_level_min_xp} XP</span>
              {wallet.next_level_xp && <span style={{ fontSize:'0.6rem', color:'var(--on-surface-variant)' }}>{wallet.next_level_xp} XP</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:'1rem' }}>
        {/* Weekly Cash Flow */}
        <div className="card" style={{ padding:'1.375rem' }}>
          <div className="section-header">
            <span className="section-title">Weekly Cash Flow</span>
            <span style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)' }}>Last 7 days</span>
          </div>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barSize={24} margin={{ top:4, right:0, left:0, bottom:0 }}>
                <XAxis dataKey="label" tick={{ fill:'var(--on-surface-variant)', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(157,133,255,0.06)', radius:6 }} />
                <Bar dataKey="amount" fill="url(#barGrad)" radius={[6,6,2,2]} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9D85FF" />
                    <stop offset="100%" stopColor="#4f3bdb" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding:'2rem 0' }}>
              <p>No spending this week yet</p>
            </div>
          )}
        </div>

        {/* Month Comparison + Gold */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="card" style={{ padding:'1rem', display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ width:42, height:42, background:'rgba(251,191,36,0.12)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Coins size={20} color="var(--secondary)" />
            </div>
            <div>
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:2 }}>Gold Earned</p>
              <p style={{ fontSize:'1.375rem', fontWeight:800 }} className="gradient-text-gold">{wallet.gold}G</p>
            </div>
            {comparison?.vs_previous_month_pct != null && (
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <p style={{ fontSize:'0.6rem', color:'var(--on-surface-variant)' }}>vs last month</p>
                <p style={{ fontSize:'0.875rem', fontWeight:700, color: comparison.vs_previous_month_pct <= 0 ? 'var(--tertiary)' : 'var(--error)' }}>
                  {comparison.vs_previous_month_pct > 0 ? '▲' : '▼'} {Math.abs(comparison.vs_previous_month_pct)}%
                </p>
              </div>
            )}
          </div>

          {comparison && (
            <div className="card" style={{ padding:'1rem', flex:1 }}>
              <p className="section-title" style={{ marginBottom:'0.75rem' }}>Month Comparison</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>This month</span>
                  <span style={{ fontWeight:700, fontSize:'0.875rem' }}>{fmt(comparison.this_month)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>Last month</span>
                  <span style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>{fmt(comparison.previous_month)}</span>
                </div>
                {comparison.vs_previous_month_pct != null && (
                  <div style={{ padding:'5px 10px', background: comparison.vs_previous_month_pct <= 0 ? 'rgba(16,217,160,0.08)' : 'rgba(248,113,113,0.08)', borderRadius:8, textAlign:'center' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, color: comparison.vs_previous_month_pct <= 0 ? 'var(--tertiary)' : 'var(--error)' }}>
                      {comparison.vs_previous_month_pct > 0 ? '▲' : '▼'} {Math.abs(comparison.vs_previous_month_pct)}% vs last month
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:'1rem' }}>
        {/* Recent Transactions */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.25rem 0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span className="section-title">Recent Transactions</span>
            <button className="btn-ghost" style={{ fontSize:'0.75rem', padding:'4px 8px', gap:4 }} onClick={() => navigate('/expenses')}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="divider" />
          {recent.length === 0 ? (
            <div className="empty-state"><p>No transactions yet</p></div>
          ) : (
            recent.map((t, i) => (
              <React.Fragment key={t.id}>
                <div className="ledger-row">
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <div className="ledger-icon">
                      <span style={{ fontSize:'1rem' }}>{['🍔','🚌','🛍','🎭','⚡','📦'][i % 6]}</span>
                    </div>
                    <div>
                      <p style={{ fontWeight:600, fontSize:'0.8125rem' }}>{t.description || 'Expense'}</p>
                      <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)' }}>{fmtDate(t.created_at)}</p>
                    </div>
                  </div>
                  <span style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--error)' }}>-{fmt(t.amount)}</span>
                </div>
                {i < recent.length - 1 && <div className="divider" />}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Active Challenges */}
        <div className="card" style={{ padding:'1rem' }}>
          <div className="section-header">
            <span className="section-title">Active Challenges</span>
            <button className="btn-ghost" style={{ fontSize:'0.75rem', padding:'4px 8px' }} onClick={() => navigate('/challenges')}>
              <ArrowRight size={12} />
            </button>
          </div>
          {challenges.length === 0 ? (
            <div className="empty-state" style={{ padding:'1.5rem 0' }}>
              <Zap size={24} style={{ margin:'0 auto 8px', display:'block', color:'var(--on-surface-variant)' }} />
              <p style={{ fontSize:'0.8125rem' }}>No active challenges</p>
              <button className="btn-primary" style={{ marginTop:10, fontSize:'0.75rem' }} onClick={() => navigate('/challenges')}>
                Browse Challenges
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem', marginTop:'0.5rem' }}>
              {challenges.map(ch => {
                const Icon = CHALLENGE_ICONS[ch.type] ?? Zap;
                return (
                  <div key={ch.id} style={{ padding:'0.75rem', background:'var(--surface-container-high)', borderRadius:12, border:'1px solid var(--outline)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <Icon size={14} color="var(--primary)" />
                      <span style={{ fontWeight:700, fontSize:'0.8125rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.title}</span>
                    </div>
                    <div className="progress-track" style={{ height:4 }}>
                      <div className="progress-fill progress-primary" style={{ width:`${Math.min(100, ch.progress_pct ?? 0)}%` }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                      <span style={{ fontSize:'0.6rem', color:'var(--on-surface-variant)' }}>{Math.round(ch.progress_pct ?? 0)}% done</span>
                      <span style={{ fontSize:'0.6rem', color:'var(--secondary)', fontWeight:700 }}>⚡ {ch.reward_xp} XP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
