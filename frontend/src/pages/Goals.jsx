import React, { useEffect, useState, useCallback } from 'react';
import { getGoals, createGoal, updateGoal, deleteGoal, contributeGoal } from '../api/api';
import { Target, Plus, Trash2, Pencil, CheckCircle2, TrendingUp, X } from 'lucide-react';

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const CATEGORY_ICONS = {
  travel: '✈️', emergency: '🛡️', gadget: '💻', car: '🚗',
  education: '📚', home: '🏠', wedding: '💍', health: '❤️', other: '🎯',
};

const EMPTY_FORM = { name: '', target_amount: '', current_amount: '', deadline: '', category: 'other' };

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [contributeModal, setContributeModal] = useState(null); // goal object
  const [contributeAmount, setContributeAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getGoals();
      setGoals(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditGoal(null); setError(''); setShowForm(true); };
  const openEdit = (g) => {
    setForm({
      name: g.name,
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      deadline: g.deadline || '',
      category: g.category || 'other',
    });
    setEditGoal(g);
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount || 0),
        deadline: form.deadline || null,
      };
      if (editGoal) {
        await updateGoal(editGoal.id, payload);
      } else {
        await createGoal(payload);
      }
      setShowForm(false);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return;
    await deleteGoal(id);
    load();
  };

  const handleContribute = async () => {
    const amt = parseFloat(contributeAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await contributeGoal(contributeModal.id, amt);
      setContributeModal(null);
      setContributeAmount('');
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const active = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Savings Goals</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>
            {active.length} active · {completed.length} completed
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd} style={{ gap: 6 }}>
          <Plus size={15} /> New Goal
        </button>
      </div>

      {/* Goals grid */}
      {goals.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Target size={40} style={{ margin: '0 auto 1rem', color: 'var(--on-surface-variant)', display: 'block' }} />
          <p style={{ fontWeight: 700, marginBottom: 6 }}>No goals yet</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: '1.25rem' }}>
            Set a savings goal and track your progress
          </p>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} /> Create your first goal</button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-variant)', marginBottom: '0.75rem', opacity: 0.6 }}>Active</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {active.map(g => <GoalCard key={g.id} goal={g} onEdit={openEdit} onDelete={handleDelete} onContribute={setContributeModal} />)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tertiary)', marginBottom: '0.75rem', opacity: 0.7 }}>Completed</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {completed.map(g => <GoalCard key={g.id} goal={g} onEdit={openEdit} onDelete={handleDelete} onContribute={setContributeModal} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editGoal ? 'Edit Goal' : 'New Savings Goal'}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {error && <p style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{error}</p>}
            <label className="form-label">Goal Name
              <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency Fund" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label className="form-label">Target Amount (₹)
                <input className="form-input" type="number" min="1" required value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="50000" />
              </label>
              <label className="form-label">Already Saved (₹)
                <input className="form-input" type="number" min="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} placeholder="0" />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label className="form-label">Deadline (optional)
                <input className="form-input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </label>
              <label className="form-label">Category
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editGoal ? 'Update Goal' : 'Create Goal'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Contribute Modal */}
      {contributeModal && (
        <Modal onClose={() => { setContributeModal(null); setContributeAmount(''); }} title={`Add to "${contributeModal.name}"`}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: '1rem' }}>
            Current: {fmt(contributeModal.current_amount)} / {fmt(contributeModal.target_amount)}
          </p>
          <label className="form-label">Amount to add (₹)
            <input className="form-input" type="number" min="1" autoFocus value={contributeAmount}
              onChange={e => setContributeAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleContribute()} />
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn-ghost" onClick={() => { setContributeModal(null); setContributeAmount(''); }}>Cancel</button>
            <button className="btn-primary" onClick={handleContribute} disabled={saving || !contributeAmount}>
              {saving ? 'Adding…' : 'Add Funds'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete, onContribute }) {
  const icon = CATEGORY_ICONS[goal.category] ?? '🎯';
  const barColor = goal.completed ? 'var(--tertiary)' : goal.progress_pct >= 80 ? '#9D85FF' : 'var(--primary)';

  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{goal.name}</p>
            {goal.deadline && (
              <p style={{ fontSize: '0.7rem', color: goal.days_left != null && goal.days_left < 14 ? 'var(--error)' : 'var(--on-surface-variant)' }}>
                {goal.days_left != null ? (goal.days_left <= 0 ? 'Deadline passed' : `${goal.days_left}d left`) : goal.deadline}
              </p>
            )}
          </div>
        </div>
        {goal.completed && <CheckCircle2 size={18} color="var(--tertiary)" />}
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{fmt(goal.current_amount)}</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: barColor }}>{goal.progress_pct}%</span>
        </div>
        <div className="progress-track" style={{ height: 6, borderRadius: 999 }}>
          <div className="progress-fill" style={{ width: `${Math.min(100, goal.progress_pct)}%`, background: barColor, borderRadius: 999 }} />
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 4 }}>
          {goal.completed ? 'Goal reached!' : `${fmt(goal.remaining_amount)} to go · target ${fmt(goal.target_amount)}`}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        {!goal.completed && (
          <button className="btn-primary" style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px', gap: 4 }} onClick={() => onContribute(goal)}>
            <TrendingUp size={12} /> Add Funds
          </button>
        )}
        <button className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => onEdit(goal)} title="Edit">
          <Pencil size={13} />
        </button>
        <button className="btn-ghost" style={{ padding: '6px 8px', color: 'var(--error)' }} onClick={() => onDelete(goal.id)} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: '1.5rem', margin: '1rem', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 800, fontSize: '1rem' }}>{title}</h3>
          <button className="btn-ghost" style={{ padding: 6 }} onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
