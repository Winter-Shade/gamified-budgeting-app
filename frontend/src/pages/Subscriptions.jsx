import React, { useEffect, useState, useCallback } from 'react';
import { getSubscriptions, createSubscription, updateSubscription, deleteSubscription } from '../api/api';
import { MonitorPlay, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';

const CYCLES = ['monthly', 'weekly', 'quarterly', 'yearly'];
const CYCLE_LABELS = { monthly: 'Monthly', weekly: 'Weekly', quarterly: 'Quarterly', yearly: 'Yearly' };

const CATEGORIES = ['streaming', 'software', 'fitness', 'music', 'news', 'cloud', 'gaming', 'food', 'education', 'other'];
const CAT_COLORS = {
  streaming: '#e50914', software: '#9D85FF', fitness: '#10d9a0', music: '#1db954',
  news: '#fbbf24', cloud: '#38bdf8', gaming: '#f97316', food: '#fb7185',
  education: '#a78bfa', other: '#8888aa',
};
const DEFAULT_COLORS = ['#9D85FF','#10d9a0','#fbbf24','#38bdf8','#f97316','#fb7185','#e50914','#1db954'];

function fmt(n) { return `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: '', amount: '', billing_cycle: 'monthly', next_billing_date: '', category: 'other', color: '', is_active: true };

function SubForm({ initial, onSave, onCancel, title }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const autoColor = form.category ? (CAT_COLORS[form.category] ?? DEFAULT_COLORS[0]) : DEFAULT_COLORS[0];
  const displayColor = form.color || autoColor;

  const handleSave = () => {
    if (!form.name.trim() || !form.amount) return;
    onSave({ ...form, color: form.color || autoColor, amount: parseFloat(form.amount) });
  };

  return (
    <>
      <h3 style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: '1.25rem' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div className="form-group">
          <label className="form-label">Service Name</label>
          <input className="input-field input-rect" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Netflix" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Amount (USD)</label>
            <input className="input-field input-rect" type="number" step="0.01" value={form.amount}
              onChange={e => set('amount', e.target.value)} placeholder="15.99" />
          </div>
          <div className="form-group">
            <label className="form-label">Billing Cycle</label>
            <select className="input-field input-rect" value={form.billing_cycle}
              onChange={e => set('billing_cycle', e.target.value)}>
              {CYCLES.map(c => <option key={c} value={c}>{CYCLE_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="input-field input-rect" value={form.category}
              onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Next Billing Date</label>
            <input className="input-field input-rect" type="date" value={form.next_billing_date}
              onChange={e => set('next_billing_date', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Color (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="color" value={displayColor}
              onChange={e => set('color', e.target.value)}
              style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--outline)', background: 'var(--surface-container)', cursor: 'pointer' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {DEFAULT_COLORS.map(col => (
                <button key={col} onClick={() => set('color', col)}
                  style={{ width: 20, height: 20, borderRadius: '50%', background: col, border: form.color === col ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => set('is_active', !form.is_active)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.is_active ? 'var(--tertiary)' : 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {form.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{form.is_active ? 'Active' : 'Paused'}</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  );
}

function SubCard({ sub, onEdit, onDelete, onToggle }) {
  const days = daysUntil(sub.next_billing_date);
  const color = sub.color || CAT_COLORS[sub.category] || '#9D85FF';
  const isUrgent = days !== null && days <= 3 && days >= 0;

  return (
    <div style={{
      background: 'var(--surface-container)',
      border: `1px solid ${sub.is_active ? 'var(--outline)' : 'rgba(255,255,255,0.04)'}`,
      borderLeft: `3px solid ${sub.is_active ? color : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 14,
      padding: '1rem 1.125rem',
      opacity: sub.is_active ? 1 : 0.55,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--on-surface)' }}>{sub.name}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', textTransform: 'capitalize' }}>{sub.category}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 800, fontSize: '1rem', color: sub.is_active ? 'var(--on-surface)' : 'var(--on-surface-variant)' }}>{fmt(sub.amount)}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{CYCLE_LABELS[sub.billing_cycle]}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          {sub.next_billing_date ? (
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: 999,
              background: isUrgent ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
              color: isUrgent ? 'var(--secondary)' : 'var(--on-surface-variant)',
              border: isUrgent ? '1px solid rgba(251,191,36,0.3)' : '1px solid transparent',
            }}>
              {days === 0 ? 'Due today' : days < 0 ? 'Overdue' : `Due in ${days}d`}
            </span>
          ) : (
            <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', opacity: 0.5 }}>No billing date</span>
          )}
          {sub.billing_cycle !== 'monthly' && (
            <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginLeft: 6 }}>
              ≈ {fmt(sub.monthly_equivalent)}/mo
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => onToggle(sub)}>
            {sub.is_active ? <ToggleRight size={14} color="var(--tertiary)" /> : <ToggleLeft size={14} />}
          </button>
          <button className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => onEdit(sub)}>
            <Pencil size={13} />
          </button>
          <button className="btn-danger" style={{ padding: '5px 8px' }} onClick={() => { if (confirm(`Delete "${sub.name}"?`)) onDelete(sub.id); }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Subscriptions() {
  const [subs, setSubs]       = useState([]);
  const [summary, setSummary] = useState({ total_monthly: 0, total_yearly: 0, active_count: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [editSub, setEditSub] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getSubscriptions();
      setSubs(data.subscriptions ?? []);
      setSummary(data.summary ?? {});
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    try { await createSubscription(form); setShowAdd(false); await load(); }
    catch (e) { alert(e.message); }
  };

  const handleUpdate = async (form) => {
    try { await updateSubscription(editSub.id, form); setEditSub(null); await load(); }
    catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    try { await deleteSubscription(id); await load(); }
    catch (e) { alert(e.message); }
  };

  const handleToggle = async (sub) => {
    try { await updateSubscription(sub.id, { is_active: !sub.is_active }); await load(); }
    catch (e) { alert(e.message); }
  };

  const active  = subs.filter(s => s.is_active);
  const paused  = subs.filter(s => !s.is_active);
  const upcoming = subs.filter(s => s.is_active && s.next_billing_date && daysUntil(s.next_billing_date) !== null && daysUntil(s.next_billing_date) <= 7 && daysUntil(s.next_billing_date) >= 0)
    .sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Subscriptions</h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>Track your recurring expenses</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ gap: 6 }}>
          <Plus size={14} /> Add Subscription
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Monthly Cost', value: fmt(summary.total_monthly), color: 'var(--primary)' },
          { label: 'Yearly Cost',  value: fmt(summary.total_yearly),  color: 'var(--secondary)' },
          { label: 'Active Plans', value: summary.active_count,       color: 'var(--tertiary)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface-container)', border: '1px solid var(--outline)', borderRadius: 14, padding: '1rem 1.25rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
            <p style={{ fontWeight: 800, fontSize: '1.375rem', color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming this week */}
      {upcoming.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: '0.625rem' }}>Due This Week</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {upcoming.map(s => {
              const days = daysUntil(s.next_billing_date);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.625rem 1rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || CAT_COLORS[s.category] || '#9D85FF', flexShrink: 0 }} />
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{s.name}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: 700 }}>
                    {days === 0 ? 'Today' : `In ${days}d`}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{fmt(s.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active subscriptions */}
      {subs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><MonitorPlay size={22} color="var(--on-surface-variant)" /></div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>No subscriptions yet</p>
            <p style={{ fontSize: '0.8125rem', marginBottom: 12 }}>Track your recurring expenses in one place</p>
            <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Subscription</button>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="section-title" style={{ marginBottom: '0.625rem' }}>Active ({active.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                {active.map(s => (
                  <SubCard key={s.id} sub={s} onEdit={setEditSub} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
          {paused.length > 0 && (
            <div>
              <p className="section-title" style={{ marginBottom: '0.625rem' }}>Paused ({paused.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                {paused.map(s => (
                  <SubCard key={s.id} sub={s} onEdit={setEditSub} onDelete={handleDelete} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <SubForm title="Add Subscription" onSave={handleCreate} onCancel={() => setShowAdd(false)} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editSub} onClose={() => setEditSub(null)}>
        {editSub && (
          <SubForm
            title="Edit Subscription"
            initial={{ name: editSub.name, amount: String(editSub.amount), billing_cycle: editSub.billing_cycle, next_billing_date: editSub.next_billing_date ?? '', category: editSub.category ?? 'other', color: editSub.color ?? '', is_active: editSub.is_active }}
            onSave={handleUpdate}
            onCancel={() => setEditSub(null)}
          />
        )}
      </Modal>
    </div>
  );
}
