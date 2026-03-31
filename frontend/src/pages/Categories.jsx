import React, { useEffect, useState, useCallback } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory, setCategoryBudget, deleteCategoryBudget } from '../api/api';
import { Plus, Trash2, Target, X, Pencil, Check } from 'lucide-react';

const PRESET_COLORS = ['#9D85FF','#10d9a0','#fbbf24','#38bdf8','#f97316','#fb7185','#e50914','#1db954','#a78bfa','#34d399'];
const PRESET_ICONS  = ['🍔','🚌','🛍','🎭','⚡','🏠','🏥','📚','✈️','🎮','💪','🐾','🎵','☕','💡'];

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

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

function BudgetInline({ cat, month, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(cat.budget != null ? String(cat.budget) : '');

  const save = async () => {
    if (!val || isNaN(parseFloat(val))) return;
    await onSave(cat.id, parseFloat(val), month);
    setEditing(false);
  };

  const remove = async () => {
    await onRemove(cat.id, month);
    setVal('');
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setVal(cat.budget != null ? String(cat.budget) : ''); setEditing(true); }}
        style={{
          background: cat.budget != null ? 'rgba(16,217,160,0.1)' : 'rgba(255,255,255,0.04)',
          border: cat.budget != null ? '1px solid rgba(16,217,160,0.2)' : '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 8, padding: '4px 10px',
          fontSize: '0.75rem', fontWeight: 600,
          color: cat.budget != null ? 'var(--tertiary)' : 'var(--on-surface-variant)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <Target size={11} />
        {cat.budget != null ? fmt(cat.budget) : 'Set budget'}
      </button>
    );
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <input
        autoFocus
        type="number" min="0" step="1"
        value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ width:90, background:'var(--surface-container-high)', border:'1px solid var(--primary)', borderRadius:6, padding:'4px 8px', color:'var(--on-surface)', fontSize:'0.75rem', fontFamily:'inherit' }}
        placeholder="Amount"
      />
      <button onClick={save} style={{ background:'rgba(16,217,160,0.15)', border:'none', borderRadius:6, padding:'5px', cursor:'pointer', color:'var(--tertiary)', display:'flex' }}>
        <Check size={12} />
      </button>
      {cat.budget != null && (
        <button onClick={remove} style={{ background:'rgba(248,113,113,0.1)', border:'none', borderRadius:6, padding:'5px', cursor:'pointer', color:'var(--error)', display:'flex' }}>
          <X size={12} />
        </button>
      )}
      <button onClick={() => setEditing(false)} style={{ background:'none', border:'none', padding:'5px', cursor:'pointer', color:'var(--on-surface-variant)', display:'flex' }}>
        <X size={12} />
      </button>
    </div>
  );
}

export default function Categories() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [cats, setCats]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth]   = useState(currentMonth);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]     = useState({ name: '', color: PRESET_COLORS[0], icon: '' });
  const [formErr, setFormErr] = useState('');
  const [editCat, setEditCat] = useState(null); // category being edited
  const [editForm, setEditForm] = useState({ name: '', color: '', icon: '' });
  const [editErr, setEditErr] = useState('');

  const load = useCallback(async () => {
    try { setCats(await getCategories(month)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return setFormErr('Name is required');
    setFormErr('');
    try {
      await createCategory({ name: form.name.trim(), color: form.color, icon: form.icon || null });
      setForm({ name: '', color: PRESET_COLORS[0], icon: '' });
      setShowAdd(false);
      await load();
    } catch (e) { setFormErr(e.message); }
  };

  const openEdit = (cat) => {
    setEditCat(cat);
    setEditForm({ name: cat.name, color: cat.color || PRESET_COLORS[0], icon: cat.icon || '' });
    setEditErr('');
  };

  const handleEdit = async () => {
    if (!editForm.name.trim()) return setEditErr('Name is required');
    setEditErr('');
    try {
      await updateCategory(editCat.id, { name: editForm.name.trim(), color: editForm.color, icon: editForm.icon || null });
      setEditCat(null);
      await load();
    } catch (e) { setEditErr(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? Existing expenses will remain but unlinked.')) return;
    try { await deleteCategory(id); await load(); }
    catch (e) { alert(e.message); }
  };

  const handleSetBudget = async (catId, amount, mon) => {
    try { await setCategoryBudget(catId, amount, mon); await load(); }
    catch (e) { alert(e.message); }
  };

  const handleRemoveBudget = async (catId, mon) => {
    try { await deleteCategoryBudget(catId, mon); await load(); }
    catch (e) { alert(e.message); }
  };

  const totalBudgeted = cats.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totalSpent    = cats.reduce((s, c) => s + (c.spent ?? 0), 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Categories</h2>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginTop:2 }}>Manage categories and set spending limits</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" className="input-field input-rect" style={{ padding:'6px 10px', fontSize:'0.8125rem', width:'auto' }}
            value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ gap:6 }}>
            <Plus size={14} /> Add Category
          </button>
        </div>
      </div>

      {/* Summary pills */}
      {totalBudgeted > 0 && (
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
          {[
            { label:'Total Budgeted', value:fmt(totalBudgeted), color:'var(--primary-dim)' },
            { label:'Total Spent',   value:fmt(totalSpent),    color:'var(--secondary)' },
            { label:'Remaining',     value:fmt(totalBudgeted - totalSpent), color: totalBudgeted >= totalSpent ? 'var(--tertiary)' : 'var(--error)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background:'var(--surface-container)', border:'1px solid var(--outline)', borderRadius:12, padding:'0.625rem 1rem' }}>
              <p style={{ fontSize:'0.6rem', color:'var(--on-surface-variant)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{label}</p>
              <p style={{ fontSize:'0.9375rem', fontWeight:800, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Categories list */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner" /></div>
      ) : (
        <div style={{ background:'var(--surface-container)', border:'1px solid var(--outline)', borderRadius:16, overflow:'hidden' }}>
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 140px 120px 36px 36px', padding:'0.625rem 1.25rem', borderBottom:'1px solid var(--outline)', gap:'0.75rem' }}>
            {['Category','Spent','Budget / Month','Progress','',''].map((h, i) => (
              <span key={i} style={{ fontSize:'0.6rem', fontWeight:700, color:'var(--on-surface-variant)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</span>
            ))}
          </div>

          {cats.length === 0 ? (
            <div className="empty-state" style={{ padding:'3rem' }}>
              <p style={{ fontWeight:600 }}>No categories found</p>
            </div>
          ) : cats.map((cat, i) => {
            const color = cat.color || PRESET_COLORS[cat.id % PRESET_COLORS.length];
            const pct = cat.pct ?? (cat.budget ? Math.min(100, (cat.spent / cat.budget) * 100) : null);
            const isDanger = pct != null && pct >= 100;
            const isWarn = pct != null && pct >= 80 && !isDanger;

            return (
              <div key={cat.id} style={{
                display:'grid', gridTemplateColumns:'1fr 100px 140px 120px 36px 36px',
                padding:'0.875rem 1.25rem', alignItems:'center', gap:'0.75rem',
                borderBottom: i < cats.length - 1 ? '1px solid var(--outline)' : 'none',
              }}>
                {/* Name */}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1rem' }}>
                    {cat.icon || <div style={{ width:10, height:10, borderRadius:'50%', background:color }} />}
                  </div>
                  <div>
                    <p style={{ fontWeight:600, fontSize:'0.875rem' }}>{cat.name}</p>
                    {cat.is_custom && <span style={{ fontSize:'0.6rem', color:'var(--primary-dim)', fontWeight:600 }}>Custom</span>}
                  </div>
                </div>

                {/* Spent */}
                <p style={{ fontWeight:700, fontSize:'0.875rem', color: isDanger ? 'var(--error)' : 'var(--on-surface)' }}>
                  {fmt(cat.spent)}
                </p>

                {/* Budget inline edit */}
                <BudgetInline cat={cat} month={month} onSave={handleSetBudget} onRemove={handleRemoveBudget} />

                {/* Progress */}
                {pct != null ? (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:'0.6rem', color: isDanger ? 'var(--error)' : isWarn ? 'var(--secondary)' : 'var(--on-surface-variant)' }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="progress-track" style={{ height:5 }}>
                      <div className="progress-fill" style={{
                        width:`${pct}%`,
                        background: isDanger ? 'var(--error)' : isWarn ? 'var(--secondary)' : color,
                        borderRadius:999,
                      }} />
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', opacity:0.5 }}>—</span>
                )}

                {/* Edit */}
                <button onClick={() => openEdit(cat)}
                  style={{ background:'rgba(157,133,255,0.1)', border:'none', borderRadius:8, padding:'6px', width:32, height:32, cursor:'pointer', color:'var(--primary-dim)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Pencil size={12} />
                </button>

                {/* Delete (only non-default, i.e. user can delete any category) */}
                {cat.is_custom ? (
                  <button className="btn-danger" style={{ padding:'6px', width:32, height:32, justifyContent:'center' }}
                    onClick={() => handleDelete(cat.id)}>
                    <Trash2 size={12} />
                  </button>
                ) : <div />}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit category modal */}
      <Modal open={!!editCat} onClose={() => setEditCat(null)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:'1.25rem' }}>Edit Category</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="input-field input-rect" placeholder="Category name"
              value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Icon (emoji, optional)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {PRESET_ICONS.map(ic => (
                <button key={ic} onClick={() => setEditForm(p => ({ ...p, icon: p.icon === ic ? '' : ic }))}
                  style={{ width:36, height:36, borderRadius:8, border:`1px solid ${editForm.icon===ic?'var(--primary)':'var(--outline)'}`, background: editForm.icon===ic?'rgba(157,133,255,0.15)':'var(--surface-container)', fontSize:'1.1rem', cursor:'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
            {editForm.icon && (
              <button onClick={() => setEditForm(p => ({ ...p, icon:'' }))}
                style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                Clear icon
              </button>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setEditForm(p => ({ ...p, color:c }))}
                  style={{ width:24, height:24, borderRadius:'50%', background:c, border: editForm.color===c?'3px solid white':'2px solid transparent', cursor:'pointer' }} />
              ))}
            </div>
          </div>
          {editErr && <p style={{ color:'var(--error)', fontSize:'0.8125rem' }}>{editErr}</p>}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setEditCat(null)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleEdit}>Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Add category modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:'1.25rem' }}>Add Category</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="input-field input-rect" placeholder="e.g. Groceries"
              value={form.name} onChange={e => setForm(p => ({ ...p, name:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Icon (emoji, optional)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {PRESET_ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(p => ({ ...p, icon:ic }))}
                  style={{ width:36, height:36, borderRadius:8, border:`1px solid ${form.icon===ic?'var(--primary)':'var(--outline)'}`, background: form.icon===ic?'rgba(157,133,255,0.15)':'var(--surface-container)', fontSize:'1.1rem', cursor:'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color:c }))}
                  style={{ width:24, height:24, borderRadius:'50%', background:c, border: form.color===c?'3px solid white':'2px solid transparent', cursor:'pointer' }} />
              ))}
            </div>
          </div>
          {formErr && <p style={{ color:'var(--error)', fontSize:'0.8125rem' }}>{formErr}</p>}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleCreate}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
