import React, { useEffect, useState, useCallback } from 'react';
import { getAccounts, createAccount, depositAccount } from '../api/api';
import { Wallet, Landmark, Banknote, Plus, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';

const INCOME_SOURCES = [
  { value: 'salary',    label: 'Salary / Wages' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'business',  label: 'Business' },
  { value: 'gift',      label: 'Gift / Received' },
  { value: 'refund',    label: 'Refund' },
  { value: 'other',     label: 'Other' },
];

function getIcon(type, size = 22) {
  if (type === 'bank')   return <Landmark size={size} color="var(--primary)" />;
  if (type === 'wallet') return <Wallet   size={size} color="var(--secondary)" />;
  return                        <Banknote size={size} color="var(--tertiary)" />;
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', cursor:'pointer', color:'var(--on-surface-variant)' }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function Accounts() {
  const [accounts, setAccounts]       = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [incomeTarget, setIncomeTarget] = useState(null); // account to deposit into

  const [addForm, setAddForm]   = useState({ name: '', balance: '', type: 'bank' });
  const [addError, setAddError] = useState('');

  const [incForm, setIncForm]   = useState({ amount: '', source: 'salary', description: '' });
  const [incError, setIncError] = useState('');

  const load = useCallback(async () => {
    try {
      setAccounts(await getAccounts());
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddAccount = async (e) => {
    e.preventDefault(); setAddError('');
    try {
      await createAccount(addForm.name, parseFloat(addForm.balance), addForm.type);
      setAddForm({ name: '', balance: '', type: 'bank' });
      setShowAdd(false);
      await load();
    } catch (err) { setAddError(err.message || 'Failed to create account'); }
  };

  const handleDeposit = async (e) => {
    e.preventDefault(); setIncError('');
    try {
      await depositAccount(incomeTarget.id, parseFloat(incForm.amount), incForm.source, incForm.description || null);
      setIncForm({ amount: '', source: 'salary', description: '' });
      setIncomeTarget(null);
      await load();
    } catch (err) { setIncError(err.message || 'Failed to log income'); }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Accounts</h2>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginTop:2 }}>
            Total balance: <strong style={{ color:'var(--on-surface)' }}>₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}</strong>
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ gap:6 }}>
          <Plus size={14} /> Add Account
        </button>
      </div>

      {/* Account Cards */}
      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Wallet size={22} color="var(--on-surface-variant)" /></div>
            <p style={{ fontWeight:600, marginBottom:4 }}>No accounts yet</p>
            <p style={{ fontSize:'0.8125rem', marginBottom:12 }}>Add an account to start tracking your balance</p>
            <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Account</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              background:'var(--surface-container)',
              border:'1px solid var(--outline)',
              borderRadius:16,
              padding:'1.25rem',
              display:'flex', flexDirection:'column', gap:'1rem',
            }}>
              {/* Top row */}
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:42, height:42, background:'var(--surface-container-high)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {getIcon(acc.type)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:700, fontSize:'0.9375rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.name}</p>
                  <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', textTransform:'capitalize' }}>{acc.type}</p>
                </div>
              </div>

              {/* Balance */}
              <div>
                <p style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:4 }}>Balance</p>
                <p style={{ fontSize:'1.625rem', fontWeight:800, letterSpacing:'-0.02em', color:'var(--on-surface)' }}>
                  ₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:8 }}>
                <button
                  className="btn-ghost"
                  style={{ flex:1, gap:6, fontSize:'0.75rem', padding:'7px', color:'var(--tertiary)', border:'1px solid rgba(16,217,160,0.2)', background:'rgba(16,217,160,0.05)' }}
                  onClick={() => { setIncomeTarget(acc); setIncForm({ amount:'', source:'salary', description:'' }); setIncError(''); }}
                >
                  <ArrowDownLeft size={13} /> Log Income
                </button>
                <button
                  className="btn-ghost"
                  style={{ flex:1, gap:6, fontSize:'0.75rem', padding:'7px' }}
                  disabled
                  title="Log an expense from the Expenses page"
                >
                  <ArrowUpRight size={13} /> Expense ↗
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:'1.25rem' }}>Add Account</h3>
        <form onSubmit={handleAddAccount} style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Account Name</label>
            <input className="input-field input-rect" placeholder="e.g. HDFC Savings"
              value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name:e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="input-field input-rect" value={addForm.type}
              onChange={e => setAddForm(p => ({ ...p, type:e.target.value }))}>
              <option value="bank">Bank Account</option>
              <option value="wallet">Digital Wallet</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Initial Balance (₹)</label>
            <input type="number" step="0.01" min="0" className="input-field input-rect" placeholder="0.00"
              value={addForm.balance} onChange={e => setAddForm(p => ({ ...p, balance:e.target.value }))} required />
          </div>
          {addError && <p style={{ color:'var(--error)', fontSize:'0.8125rem' }}>{addError}</p>}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button type="button" className="btn-secondary" style={{ flex:1 }} onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex:2 }}>Create Account</button>
          </div>
        </form>
      </Modal>

      {/* Log Income Modal */}
      <Modal open={!!incomeTarget} onClose={() => setIncomeTarget(null)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:4 }}>Log Income</h3>
        <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginBottom:'1.25rem' }}>
          Crediting: <strong style={{ color:'var(--on-surface)' }}>{incomeTarget?.name}</strong>
        </p>
        <form onSubmit={handleDeposit} style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" step="0.01" min="0.01" className="input-field input-rect" placeholder="0.00"
              value={incForm.amount} onChange={e => setIncForm(p => ({ ...p, amount:e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select className="input-field input-rect" value={incForm.source}
              onChange={e => setIncForm(p => ({ ...p, source:e.target.value }))}>
              {INCOME_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input className="input-field input-rect" placeholder="e.g. March salary"
              value={incForm.description} onChange={e => setIncForm(p => ({ ...p, description:e.target.value }))} />
          </div>
          {incError && <p style={{ color:'var(--error)', fontSize:'0.8125rem' }}>{incError}</p>}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button type="button" className="btn-secondary" style={{ flex:1 }} onClick={() => setIncomeTarget(null)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex:2, background:'linear-gradient(135deg,#0d7a5a,#10d9a0)', borderColor:'rgba(16,217,160,0.3)' }}>
              <ArrowDownLeft size={14} /> Credit Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
