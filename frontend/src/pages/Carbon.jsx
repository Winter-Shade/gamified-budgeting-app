import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { getCarbonMonthly, getCarbonTrend } from '../api/api';
import { Leaf, TrendingDown, TreeDeciduous } from 'lucide-react';

const MONTH_NOW = new Date().toISOString().slice(0, 7);
const GREEN_COLORS = ['#10d9a0', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

function MonthPicker({ value, onChange }) {
  return (
    <input type="month" value={value} onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--surface-container-high)', border: '1px solid var(--outline)',
        borderRadius: 10, padding: '5px 12px', color: 'var(--on-surface)',
        fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
      }}
    />
  );
}

const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-container-high)', border: '1px solid var(--outline)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10d9a0' }}>{payload[0].value} kg CO₂</p>
    </div>
  );
};

const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-container-high)', border: '1px solid var(--outline)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10d9a0' }}>{payload[0].value} kg CO₂</p>
    </div>
  );
};

export default function Carbon() {
  const [month, setMonth] = useState(MONTH_NOW);
  const [monthly, setMonthly] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([getCarbonMonthly(month), getCarbonTrend(6)]);
      setMonthly(m);
      setTrend(t);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  const totalCO2 = monthly?.total_co2_kg ?? 0;
  const trees = monthly?.equivalent_trees ?? 0;
  const breakdown = monthly?.breakdown ?? [];

  // rating label
  let rating = 'Low Impact';
  let ratingColor = 'var(--tertiary)';
  if (totalCO2 > 200) { rating = 'High Impact'; ratingColor = 'var(--error)'; }
  else if (totalCO2 > 80) { rating = 'Moderate Impact'; ratingColor = 'var(--secondary)'; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Carbon Footprint</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>
            CO₂ emissions estimated from your spending
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="stat-card stat-card-tertiary">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(16,217,160,0.15)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Leaf size={16} color="var(--tertiary)" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>Total CO₂ This Month</span>
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: ratingColor }}>{totalCO2} kg</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 4 }}>{rating}</p>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(157,133,255,0.15)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TreeDeciduous size={16} color="var(--primary)" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>Trees Needed to Offset</span>
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }} className="gradient-text">{trees}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 4 }}>trees for 1 year</p>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(251,191,36,0.12)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={16} color="var(--secondary)" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>Top Emitting Category</span>
          </div>
          {breakdown.length > 0 ? (
            <>
              <p style={{ fontSize: '1rem', fontWeight: 800 }}>{breakdown[0].category}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 4 }}>{breakdown[0].co2_kg} kg CO₂</p>
            </>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginTop: 8 }}>No data</p>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem' }}>
        {/* Trend */}
        <div className="card" style={{ padding: '1.375rem' }}>
          <p className="section-title" style={{ marginBottom: '1rem' }}>6-Month CO₂ Trend</p>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10d9a0" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10d9a0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<AreaTip />} />
                <Area type="monotone" dataKey="co2_kg" stroke="#10d9a0" strokeWidth={2} fill="url(#greenGrad)" dot={{ r: 3, fill: '#10d9a0' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No trend data yet</p></div>
          )}
        </div>

        {/* Category breakdown bar */}
        <div className="card" style={{ padding: '1.375rem' }}>
          <p className="section-title" style={{ marginBottom: '1rem' }}>By Category</p>
          {breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={breakdown.slice(0, 6)} layout="vertical" barSize={14} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: 'var(--on-surface-variant)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'var(--on-surface-variant)', fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<BarTip />} />
                <Bar dataKey="co2_kg" radius={[0, 4, 4, 0]}>
                  {breakdown.slice(0, 6).map((_, i) => <Cell key={i} fill={GREEN_COLORS[i % GREEN_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>No spending data</p></div>
          )}
        </div>
      </div>

      {/* Breakdown table */}
      {breakdown.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem 0.75rem' }}>
            <p className="section-title">Emission Breakdown</p>
          </div>
          <div className="divider" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-container)' }}>
                  {['Category', 'Amount Spent', 'Factor (kg/₹100)', 'CO₂ (kg)'].map(h => (
                    <th key={h} style={{ padding: '0.625rem 1.25rem', textAlign: 'left', fontWeight: 700, fontSize: '0.7rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--outline)' }}>
                    <td style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textTransform: 'capitalize' }}>{row.category}</td>
                    <td style={{ padding: '0.75rem 1.25rem', color: 'var(--on-surface-variant)' }}>₹{Number(row.amount_spent).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1.25rem', color: 'var(--on-surface-variant)' }}>{row.emission_factor}</td>
                    <td style={{ padding: '0.75rem 1.25rem', fontWeight: 700, color: '#10d9a0' }}>{row.co2_kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', background: 'var(--surface-container)' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#10d9a0' }}>{totalCO2} kg CO₂</span>
          </div>
        </div>
      )}

      {/* Info card */}
      <div style={{ background: 'rgba(16,217,160,0.06)', border: '1px solid rgba(16,217,160,0.2)', borderRadius: 14, padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--tertiary)' }}>How is this calculated?</strong> We apply estimated CO₂ emission factors (kg per ₹100 spent) to each expense category based on average Indian consumption data. This is an approximation — actual emissions vary by vendor and product.
      </div>
    </div>
  );
}
