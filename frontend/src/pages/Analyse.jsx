import React, { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { getAnalytics, getMonthlySummary } from '../api/api';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const COLORS = ['#9D85FF','#fbbf24','#10d9a0','#f472b6','#fb923c','#60a5fa','#a78bfa','#34d399'];

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function MonthPicker({ value, onChange }) {
  return (
    <input
      type="month" value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background:'var(--surface-container-high)', border:'1px solid var(--outline)',
        borderRadius:10, padding:'5px 12px', color:'var(--on-surface)',
        fontSize:'0.8125rem', fontWeight:600, fontFamily:'inherit', cursor:'pointer', outline:'none',
      }}
    />
  );
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--surface-container-high)', border:'1px solid var(--outline)', borderRadius:10, padding:'8px 12px' }}>
      <p style={{ fontWeight:700, fontSize:'0.875rem', color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p style={{ fontSize:'0.8125rem', color:'var(--on-surface)' }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--surface-container-high)', border:'1px solid var(--outline)', borderRadius:10, padding:'8px 12px' }}>
      <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)', marginBottom:2 }}>{label}</p>
      <p style={{ fontSize:'0.875rem', fontWeight:700, color:'var(--primary)' }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

function TrendBadge({ pct }) {
  if (pct == null) return <span style={{ color:'var(--on-surface-variant)' }}>—</span>;
  const better = pct <= 0;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, color: better ? 'var(--tertiary)' : 'var(--error)', fontWeight:700, fontSize:'0.875rem' }}>
      {better ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
      {better ? '' : '+'}{pct}%
    </div>
  );
}

export default function Analyse() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [data, setData]     = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([getAnalytics(month), getMonthlySummary(6)]);
      setData(a); setMonthly(m);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const pieData   = (data?.category_breakdown ?? []).map((c,i) => ({ ...c, fill: COLORS[i % COLORS.length] }));
  const trendData = data?.daily_trend ?? [];
  const cmp       = data?.monthly_comparison;
  const velocity  = data?.spending_velocity;
  const bva       = data?.budget_vs_actual;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Spending Analytics</h2>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginTop:2 }}>
            Insights for {new Date(month+'-01').toLocaleDateString('en-IN', { month:'long', year:'numeric' })}
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div className="spinner" style={{ width:32, height:32 }} />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem' }}>
            <div className="stat-card">
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:6 }}>Total Spent</p>
              <p style={{ fontSize:'1.375rem', fontWeight:800 }} className="gradient-text">{fmt(data?.total_spent_month)}</p>
              {data?.top_category && <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginTop:4 }}>Top: {data.top_category.name}</p>}
            </div>
            <div className="stat-card stat-card-secondary">
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:6 }}>Weekly Avg</p>
              <p style={{ fontSize:'1.375rem', fontWeight:800, color:'var(--secondary)' }}>{fmt(data?.weekly_avg)}</p>
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginTop:4 }}>per week</p>
            </div>
            <div className={`stat-card ${bva?.status === 'over' ? 'stat-card-error' : bva?.status === 'warning' ? 'stat-card-secondary' : 'stat-card-tertiary'}`}>
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:6 }}>Budget Usage</p>
              {bva ? (
                <>
                  <p style={{ fontSize:'1.375rem', fontWeight:800, color: bva.status==='over' ? 'var(--error)' : bva.status==='warning' ? 'var(--secondary)' : 'var(--tertiary)' }}>
                    {bva.percentage}%
                  </p>
                  <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginTop:4 }}>{fmt(bva.spent)} / {fmt(bva.budget)}</p>
                </>
              ) : <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>No budget</p>}
            </div>
            <div className="stat-card">
              <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:6 }}>Projected Total</p>
              {velocity ? (
                <>
                  <p style={{ fontSize:'1.375rem', fontWeight:800 }}>{fmt(velocity.projected_total)}</p>
                  <p style={{ fontSize:'0.7rem', marginTop:4, color: velocity.on_track ? 'var(--tertiary)' : 'var(--error)', fontWeight:600 }}>
                    {velocity.on_track == null ? '—' : velocity.on_track ? '✓ On track' : '⚠ Over pace'}
                  </p>
                </>
              ) : <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>—</p>}
            </div>
          </div>

          {/* Charts Row 1: Pie + Trend */}
          <div style={{ display:'grid', gridTemplateColumns:'5fr 7fr', gap:'1rem' }}>
            {/* Category Pie */}
            <div className="card" style={{ padding:'1.375rem' }}>
              <p className="section-title" style={{ marginBottom:'1rem' }}>By Category</p>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', marginTop:'0.5rem' }}>
                    {pieData.slice(0,5).map((c,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:c.fill, flexShrink:0 }} />
                          <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>{c.name}</span>
                        </div>
                        <span style={{ fontSize:'0.75rem', fontWeight:700 }}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div className="empty-state"><p>No spending data</p></div>}
            </div>

            {/* Daily Trend */}
            <div className="card" style={{ padding:'1.375rem' }}>
              <p className="section-title" style={{ marginBottom:'1rem' }}>Daily Spending (Last 30 days)</p>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ top:4, right:4, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9D85FF" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#9D85FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tickFormatter={d => new Date(d).getDate()}
                      tick={{ fill:'var(--on-surface-variant)', fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<BarTooltip />} />
                    <Area type="monotone" dataKey="amount" stroke="#9D85FF" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="empty-state"><p>No daily data</p></div>}
            </div>
          </div>

          {/* Charts Row 2: Monthly Comparison + 6-month history */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 5fr', gap:'1rem' }}>
            {/* Month vs Month */}
            {cmp && (
              <div className="card" style={{ padding:'1.375rem' }}>
                <p className="section-title" style={{ marginBottom:'1rem' }}>Month Comparison</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <div>
                    <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:4 }}>This month</p>
                    <p style={{ fontSize:'1.25rem', fontWeight:800 }}>{fmt(cmp.this_month)}</p>
                  </div>
                  <div className="divider" />
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:2 }}>vs last month</p>
                      <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>{fmt(cmp.previous_month)}</p>
                    </div>
                    <TrendBadge pct={cmp.vs_previous_month_pct} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:2 }}>vs last year</p>
                      <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>{fmt(cmp.same_month_last_year)}</p>
                    </div>
                    <TrendBadge pct={cmp.vs_last_year_pct} />
                  </div>
                  {bva && (
                    <>
                      <div className="divider" />
                      <div>
                        <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:6 }}>Budget status</p>
                        <div className="progress-track">
                          <div className="progress-fill" style={{
                            width:`${Math.min(100, bva.percentage)}%`,
                            background: bva.status==='over' ? 'var(--error)' : bva.status==='warning' ? 'var(--secondary)' : 'var(--tertiary)',
                          }} />
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                          <span style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)' }}>{bva.percentage}% used</span>
                          <span style={{ fontSize:'0.65rem', fontWeight:700, color: bva.status==='over'?'var(--error)':bva.status==='warning'?'var(--secondary)':'var(--tertiary)' }}>
                            {bva.status === 'over' ? 'Over budget' : bva.status === 'warning' ? 'Caution' : 'Healthy'}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 6-Month Bar Chart */}
            <div className="card" style={{ padding:'1.375rem' }}>
              <p className="section-title" style={{ marginBottom:'1rem' }}>6-Month Spending History</p>
              {monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthly} barSize={32} margin={{ top:4, right:4, left:0, bottom:0 }}>
                    <XAxis dataKey="month" tickFormatter={m => {
                      const [y,mo] = m.split('-');
                      return new Date(y,mo-1).toLocaleDateString('en',{month:'short'});
                    }} tick={{ fill:'var(--on-surface-variant)', fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill:'rgba(157,133,255,0.06)' }} />
                    <Bar dataKey="total" fill="url(#bar6Grad)" radius={[6,6,2,2]} />
                    <defs>
                      <linearGradient id="bar6Grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9D85FF" />
                        <stop offset="100%" stopColor="#4f3bdb" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="empty-state"><p>No historical data</p></div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
