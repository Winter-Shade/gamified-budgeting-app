import React, { useEffect, useState } from 'react';
import { getExpenses, addExpense, updateExpense, deleteExpense, getAccounts, getCategories } from '../api/api';
import { Plus, Receipt, Pencil, Trash2, Filter, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FALLBACK_COLORS = ['var(--secondary)','var(--primary)','var(--tertiary)','#f472b6','#fb923c','var(--on-surface-variant)'];

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses,   setExpenses]   = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [editingId,  setEditingId]  = useState(null);
  const [editData,   setEditData]   = useState({});
  const [formData,   setFormData]   = useState({ account_id: '', category_id: '', amount: '', description: '', expense_at: new Date().toISOString().slice(0, 16) });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getCat = (id) => categories.find(c => c.id === id) || { name: 'Unknown', color: 'var(--on-surface-variant)', icon: null };
  const getAccountName = (id) => accounts.find(a => a.id === id)?.name || '';

  // Load accounts + categories independently on mount
  useEffect(() => {
    getAccounts()
      .then(a => {
        setAccounts(a);
        if (a.length > 0) setFormData(p => p.account_id ? p : { ...p, account_id: a[0].id.toString() });
      })
      .catch(console.error);

    getCategories()
      .then(cats => {
        setCategories(cats);
        if (cats.length > 0) setFormData(p => p.category_id ? p : { ...p, category_id: cats[0].id.toString() });
      })
      .catch(console.error);
  }, []);

  useEffect(() => { fetchExpenses(); }, [filterCategory]);

  const fetchExpenses = async () => {
    try {
      setExpenses(await getExpenses(filterCategory || undefined));
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fetchData = async () => {
    try {
      const [e, a, cats] = await Promise.all([
        getExpenses(filterCategory || undefined),
        getAccounts(),
        getCategories(),
      ]);
      setExpenses(e);
      setAccounts(a);
      setCategories(cats);
      if (a.length > 0)    setFormData(p => p.account_id   ? p : { ...p, account_id:   a[0].id.toString() });
      if (cats.length > 0) setFormData(p => p.category_id  ? p : { ...p, category_id:  cats[0].id.toString() });
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setError('');
    try {
      await addExpense(
        parseInt(formData.account_id),
        parseInt(formData.category_id),
        parseFloat(formData.amount),
        formData.description || null,
        formData.expense_at ? new Date(formData.expense_at).toISOString() : null
      );
      setFormData(p => ({ ...p, amount: '', description: '', expense_at: new Date().toISOString().slice(0, 16) }));
      fetchData();
    } catch (err) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try { await deleteExpense(id); fetchData(); } catch (e) { alert(e.message); }
  };

  const startEdit = (exp) => {
    setEditingId(exp.id);
    setEditData({ amount: exp.amount.toString(), category_id: exp.category_id.toString(), description: exp.description || '' });
  };

  const handleUpdate = async (id) => {
    try {
      await updateExpense(id, { amount: parseFloat(editData.amount), category_id: parseInt(editData.category_id), description: editData.description });
      setEditingId(null);
      fetchData();
    } catch (e) { alert(e.message); }
  };

  if (isLoading && accounts.length === 0 && categories.length === 0) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div className="flex-col gap-8">
        <div>
          <div className="flex-row items-center gap-3">
            <Receipt size={22} color="var(--primary)" strokeWidth={1.5} />
            <h1 className="text-xl">Expenses</h1>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Track and manage your spending</p>
        </div>

        {/* Add Form */}
        <div className="glass-card card-2xl">
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>Log New Expense</h2>
          {accounts.length === 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0.875rem 1rem', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:12 }}>
              <AlertCircle size={16} color="var(--secondary)" style={{ flexShrink:0 }} />
              <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', flex:1 }}>
                You need an account before logging expenses.
              </p>
              <button className="btn-primary" style={{ fontSize:'0.75rem', padding:'6px 14px', whiteSpace:'nowrap' }} onClick={() => navigate('/accounts')}>
                <Plus size={13} /> Add Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-row gap-4 flex-wrap" style={{ alignItems: 'flex-end' }}>
              <div className="flex-col gap-2" style={{ flex: 1, minWidth: '150px' }}>
                <label style={styles.label}>Account</label>
                <select className="input-field input-rect" value={formData.account_id}
                  onChange={e => setFormData(p => ({ ...p, account_id: e.target.value }))} required>
                  <option value="" disabled>Select account…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toFixed(0)})</option>)}
                </select>
              </div>

              <div className="flex-col gap-2" style={{ flex: 1, minWidth: '140px' }}>
                <label style={styles.label}>Category</label>
                <select className="input-field input-rect" value={formData.category_id}
                  onChange={e => setFormData(p => ({ ...p, category_id: e.target.value }))}>
                  <option value="" disabled>Select category…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-col gap-2" style={{ flex: 1, minWidth: '110px' }}>
                <label style={styles.label}>Amount (₹)</label>
                <input type="number" step="0.01" min="0.01" className="input-field input-rect"
                  placeholder="0.00" value={formData.amount}
                  onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} required />
              </div>

              <div className="flex-col gap-2" style={{ flex: 1, minWidth: '160px' }}>
                <label style={styles.label}>Date & Time</label>
                <input type="datetime-local" className="input-field input-rect"
                  value={formData.expense_at}
                  onChange={e => setFormData(p => ({ ...p, expense_at: e.target.value }))} />
              </div>

              <div className="flex-col gap-2" style={{ flex: 2, minWidth: '160px' }}>
                <label style={styles.label}>Description</label>
                <input type="text" className="input-field input-rect" placeholder="What's this for?"
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
              </div>

              <button type="submit" disabled={isSubmitting || !formData.category_id} className="btn-primary" style={{ padding:'8px 20px', height:'42px' }}>
                {isSubmitting ? <span className="spinner" style={{ width:14, height:14 }} /> : <><Plus size={14} /> Log</>}
              </button>
            </form>
          )}
          {error && <div style={{ color:'var(--error)', marginTop:'12px', fontSize:'0.875rem' }}>{error}</div>}
        </div>

        {/* Filter */}
        <div className="flex-row items-center gap-4">
          <Filter size={14} color="var(--on-surface-variant)" />
          <span style={styles.label}>Filter by category</span>
          <select className="input-field" style={{ width: '200px' }} value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
            ))}
          </select>
          {filterCategory && (
            <button onClick={() => setFilterCategory('')}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--on-surface-variant)', display:'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Expense list */}
        <div className="glass-card card-2xl-np">
          {expenses.length === 0 ? (
            <div style={{ padding:'50px', textAlign:'center', color:'var(--on-surface-variant)' }}>
              No expenses found.
            </div>
          ) : expenses.map((exp, i) => {
            const cat   = getCat(exp.category_id);
            const color = cat.color || FALLBACK_COLORS[exp.category_id % FALLBACK_COLORS.length];
            return (
              <React.Fragment key={exp.id}>
                {i > 0 && <div className="divider" />}
                <div className="ledger-row">
                  {editingId === exp.id ? (
                    <div className="flex-row gap-3 items-center w-full flex-wrap">
                      <select className="input-field input-rect" style={{ width:'160px' }}
                        value={editData.category_id}
                        onChange={e => setEditData(p => ({ ...p, category_id: e.target.value }))}>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                        ))}
                      </select>
                      <input type="number" step="0.01" className="input-field input-rect" style={{ width:'100px' }}
                        value={editData.amount}
                        onChange={e => setEditData(p => ({ ...p, amount: e.target.value }))} />
                      <input type="text" className="input-field input-rect" style={{ flex:1 }}
                        value={editData.description}
                        onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                        placeholder="Description" />
                      <button onClick={() => handleUpdate(exp.id)} className="btn-primary" style={{ padding:'6px 14px' }}>Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding:'6px 14px' }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-row items-center gap-4">
                        <div className="ledger-icon" style={{ background:`${color}18` }}>
                          {cat.icon
                            ? <span style={{ fontSize:'1rem' }}>{cat.icon}</span>
                            : <div style={{ width:10, height:10, borderRadius:'50%', background:color }} />
                          }
                        </div>
                        <div>
                          <p style={{ fontWeight:700, fontSize:'0.875rem' }}>{exp.description || cat.name}</p>
                          <p style={{ fontSize:'0.6875rem', color:'var(--on-surface-variant)' }}>
                            {cat.name} · {getAccountName(exp.account_id)} · {new Date(exp.expense_at || exp.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })} {new Date(exp.expense_at || exp.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex-row items-center gap-3">
                        <span style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--error)' }}>
                          -₹{exp.amount.toFixed(2)}
                        </span>
                        <button onClick={() => startEdit(exp)} style={styles.actBtn}><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(exp.id)} style={{ ...styles.actBtn, color:'var(--error)' }}><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const styles = {
  label:  { fontSize:'0.625rem', fontWeight:700, color:'var(--on-surface-variant)', textTransform:'uppercase', letterSpacing:'0.05em' },
  actBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--on-surface-variant)', padding:'6px', borderRadius:'6px', display:'flex', alignItems:'center', transition:'all 0.15s' },
};

export default Expenses;
