import React, { useEffect, useState, useCallback } from 'react';
import { getBudgets, createBudget } from '../api/api';
import { Target, Plus, TrendingDown, ShieldCheck, AlertTriangle, X } from 'lucide-react';

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

function MonthLabel({ month }) {
  return new Date(month + '-02').toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function BudgetCard({ b }) {
  const pct     = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
  const isDanger  = pct >= 100;
  const isWarning = pct >= 80 && !isDanger;
  const barColor  = isDanger ? 'var(--error)' : isWarning ? 'var(--secondary)' : 'var(--primary)';
  const isCurrentMonth = b.month === new Date().toISOString().slice(0, 7);

  return (
    <div style={{
      background: 'var(--surface-container)',
      border: `1px solid ${isDanger ? 'rgba(248,113,113,0.3)' : isWarning ? 'rgba(251,191,36,0.3)' : 'var(--outline)'}`,
      borderRadius: 16, padding: '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '1rem',
    }}>
      {/* Month + status */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
            <p style={{ fontWeight:800, fontSize:'1rem' }}><MonthLabel month={b.month} /></p>
            {isCurrentMonth && <span className="badge badge-primary" style={{ fontSize:'0.6rem' }}>Current</span>}
          </div>
          <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)' }}>Monthly spending limit</p>
        </div>
        {isDanger && <AlertTriangle size={18} color="var(--error)" />}
        {isWarning && <AlertTriangle size={18} color="var(--secondary)" />}
        {!isDanger && !isWarning && <ShieldCheck size={18} color="var(--tertiary)" />}
      </div>

      {/* Amounts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
        {[
          { label: 'Budget', value: fmt(b.amount), color: 'var(--on-surface)' },
          { label: 'Spent',  value: fmt(b.spent),  color: isDanger ? 'var(--error)' : 'var(--secondary)' },
          { label: b.remaining >= 0 ? 'Left' : 'Over', value: fmt(Math.abs(b.remaining)), color: b.remaining >= 0 ? 'var(--tertiary)' : 'var(--error)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'var(--surface-container-high)', borderRadius:10, padding:'0.625rem 0.75rem' }}>
            <p style={{ fontSize:'0.6rem', color:'var(--on-surface-variant)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{label}</p>
            <p style={{ fontWeight:800, fontSize:'0.9375rem', color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)' }}>
            {isDanger ? 'Over budget' : isWarning ? 'Approaching limit' : 'On track'}
          </span>
          <span style={{ fontSize:'0.7rem', fontWeight:700, color: barColor }}>{Math.round(pct)}%</span>
        </div>
        <div className="progress-track" style={{ height:8, borderRadius:999 }}>
          <div className="progress-fill" style={{ width:`${pct}%`, background: barColor, borderRadius:999, transition:'width 0.5s ease' }} />
        </div>
      </div>
    </div>
  );
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', month: new Date().toISOString().slice(0, 7) });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setBudgets(await getBudgets()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await createBudget(parseFloat(form.amount), form.month);
      setShowForm(false);
      setForm({ amount: '', month: new Date().toISOString().slice(0, 7) });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentBudget = budgets.find(b => b.month === currentMonth);
  const pastBudgets = budgets.filter(b => b.month !== currentMonth);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Budgets</h2>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginTop:2 }}>Set monthly spending limits</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)} style={{ gap:6 }}>
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> {currentBudget ? 'Update Budget' : 'Set Budget'}</>}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background:'var(--surface-container)', border:'1px solid rgba(157,133,255,0.25)', borderRadius:16, padding:'1.25rem' }}>
          <p style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:'1rem' }}>
            {currentBudget ? `Update ${new Date(currentMonth + '-02').toLocaleString('en-IN', { month:'long', year:'numeric' })} budget` : 'Set a monthly budget'}
          </p>
          <form onSubmit={handleSubmit} style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div className="form-group" style={{ flex:1, minWidth:180 }}>
              <label className="form-label">Budget Amount (₹)</label>
              <input type="number" step="1" min="1" className="input-field input-rect" placeholder="e.g. 20000"
                value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ flex:1, minWidth:160 }}>
              <label className="form-label">Month</label>
              <input type="month" className="input-field input-rect"
                value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} required />
            </div>
            <button type="submit" className="btn-primary" style={{ height:42, padding:'0 1.5rem' }} disabled={saving}>
              {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : 'Save'}
            </button>
          </form>
          {error && <p style={{ color:'var(--error)', fontSize:'0.8125rem', marginTop:8 }}>{error}</p>}
        </div>
      )}

      {/* No budgets state */}
      {budgets.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Target size={22} color="var(--on-surface-variant)" /></div>
            <p style={{ fontWeight:600, marginBottom:4 }}>No budgets set yet</p>
            <p style={{ fontSize:'0.8125rem', marginBottom:12 }}>Set a monthly limit to keep your spending in check</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> Set Budget</button>
          </div>
        </div>
      )}

      {/* Current month */}
      {currentBudget && (
        <div>
          <p className="section-title" style={{ marginBottom:'0.75rem' }}>This Month</p>
          <BudgetCard b={currentBudget} />
        </div>
      )}

      {/* Past budgets */}
      {pastBudgets.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom:'0.75rem' }}>Past Months</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {pastBudgets.map(b => <BudgetCard key={b.id} b={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}
