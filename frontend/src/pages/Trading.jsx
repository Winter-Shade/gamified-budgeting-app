import React, { useEffect, useState, useCallback } from 'react';
import {
  getTradingAccounts, createTradingAccount, updateTradingAccount, deleteTradingAccount,
  getTraders, createTrader, deleteTrader, runTrader, setSchedule, removeSchedule,
  getTraderTransactions,
} from '../api/api';
import { TrendingUp, Plus, Play, Clock, Trash2, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';

const MODELS    = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'];
const INTERVALS = ['manual','hourly','every_6h','every_12h','daily','weekly'];
const INTERVAL_LABELS = { manual:'Manual only', hourly:'Every hour', every_6h:'Every 6 hours', every_12h:'Every 12 hours', daily:'Daily', weekly:'Weekly' };

function fmt(n, prefix='$') { return `${prefix}${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`; }

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

function AccountCard({ acc, selected, onClick, onReset }) {
  const pnl    = acc.pnl ?? 0;
  const isPos  = pnl >= 0;
  return (
    <div
      onClick={onClick}
      style={{
        padding:'1rem 1.25rem', borderRadius:14, cursor:'pointer',
        background: selected ? 'rgba(157,133,255,0.1)' : 'var(--surface-container)',
        border: selected ? '1px solid rgba(157,133,255,0.35)' : '1px solid var(--outline)',
        transition:'all 0.2s',
        display:'flex', flexDirection:'column', gap:4,
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p style={{ fontWeight:700, fontSize:'0.875rem' }}>{acc.name}</p>
        <span style={{ fontSize:'0.75rem', fontWeight:700, color: isPos ? 'var(--tertiary)' : 'var(--error)' }}>
          {isPos ? '+' : ''}{fmt(pnl)}
        </span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>Cash: {fmt(acc.cash_balance)}</span>
        <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>{acc.trader_count} traders</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
        <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>Total: <b style={{ color:'var(--on-surface)' }}>{fmt(acc.total_value)}</b></span>
        <button className="btn-ghost" style={{ padding:'2px 6px', fontSize:'0.7rem' }}
          onClick={e => { e.stopPropagation(); onReset(acc.id); }}>
          <RefreshCw size={11} /> Reset
        </button>
      </div>
    </div>
  );
}

function TraderCard({ trader, onRun, onDelete, onSchedule, running }) {
  const [expanded, setExpanded] = useState(false);
  const [txns, setTxns]         = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const loadTxns = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    setLoadingTxns(true);
    try { setTxns(await getTraderTransactions(trader.id, 20)); }
    catch(_) {}
    finally { setLoadingTxns(false); }
  };

  const holdings = trader.holdings ?? [];

  return (
    <div className="trader-card">
      <div style={{ padding:'1.125rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
              <div style={{ width:32, height:32, background:'linear-gradient(135deg,#1e1e34,#2e1065)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>🤖</div>
              <div>
                <p style={{ fontWeight:700, fontSize:'0.9375rem' }}>{trader.name}</p>
                <span className="badge badge-primary" style={{ fontSize:'0.6rem' }}>{trader.model}</span>
              </div>
            </div>
            {trader.identity && (
              <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)', fontStyle:'italic', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                "{trader.identity}"
              </p>
            )}
            <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {trader.strategy}
            </p>
          </div>
          <div style={{ textAlign:'right', flexShrink:0, marginLeft:'1rem' }}>
            <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:2 }}>Portfolio</p>
            <p style={{ fontWeight:800, fontSize:'1rem' }}>{fmt(trader.portfolio_value ?? 0)}</p>
            {trader.run_count > 0 && (
              <p style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)', marginTop:2 }}>{trader.run_count} runs</p>
            )}
          </div>
        </div>

        {/* Holdings */}
        {holdings.length > 0 && (
          <div style={{ background:'var(--surface-container-high)', borderRadius:10, padding:'0.625rem', marginBottom:'0.75rem' }}>
            <p style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>Holdings</p>
            {holdings.map(h => (
              <div key={h.symbol} className="holding-row">
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:'0.8125rem' }}>{h.symbol}</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>{h.quantity} shares</span>
                </div>
                <div style={{ textAlign:'right' }}>
                  {h.market_value != null && <p style={{ fontWeight:700, fontSize:'0.8125rem' }}>{fmt(h.market_value)}</p>}
                  {h.unrealized_pnl != null && (
                    <p style={{ fontSize:'0.7rem', color: h.unrealized_pnl >= 0 ? 'var(--tertiary)' : 'var(--error)', fontWeight:600 }}>
                      {h.unrealized_pnl >= 0 ? '+' : ''}{fmt(h.unrealized_pnl)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule info */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:'0.75rem' }}>
          <Clock size={12} color="var(--on-surface-variant)" />
          <span style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)' }}>
            {INTERVAL_LABELS[trader.schedule_interval] ?? trader.schedule_interval}
          </span>
          {trader.schedule_active && <span className="badge badge-tertiary" style={{ fontSize:'0.6rem' }}>● Active</span>}
          {trader.last_run_at && (
            <span style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)', marginLeft:'auto' }}>
              Last run: {new Date(trader.last_run_at).toLocaleDateString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button className="btn-primary" style={{ flex:1, fontSize:'0.75rem', padding:'7px', minWidth:80 }}
            onClick={() => onRun(trader.id)} disabled={running === trader.id}>
            {running === trader.id ? <span style={{ display:'inline-block', width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> : <><Play size={12} /> Run</>}
          </button>
          <select
            value={trader.schedule_interval}
            onChange={e => onSchedule(trader.id, e.target.value)}
            style={{ flex:2, background:'var(--surface-container-high)', border:'1px solid var(--outline)', borderRadius:10, padding:'6px 10px', color:'var(--on-surface)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'inherit' }}
          >
            {INTERVALS.map(iv => <option key={iv} value={iv}>{INTERVAL_LABELS[iv]}</option>)}
          </select>
          <button className="btn-ghost" style={{ padding:'7px 10px', gap:4 }} onClick={loadTxns}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button className="btn-danger" style={{ padding:'7px 10px' }} onClick={() => { if(confirm(`Delete trader "${trader.name}"?`)) onDelete(trader.id); }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Transactions panel */}
      {expanded && (
        <div style={{ borderTop:'1px solid var(--outline)', padding:'0.875rem' }}>
          <p className="section-title" style={{ marginBottom:'0.625rem' }}>Recent Transactions</p>
          {loadingTxns ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'1rem' }}><div className="spinner" /></div>
          ) : txns.length === 0 ? (
            <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', textAlign:'center', padding:'1rem' }}>No transactions yet</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {txns.map(t => (
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--outline-variant)' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, color: t.side==='buy' ? 'var(--tertiary)' : 'var(--error)' }}>
                      {t.side.toUpperCase()}
                    </span>
                    <span style={{ fontSize:'0.8125rem', fontWeight:600 }}>{t.quantity} × {t.symbol}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:'0.8125rem', fontWeight:700 }}>@{fmt(t.price)}</p>
                    <p style={{ fontSize:'0.65rem', color:'var(--on-surface-variant)' }}>{new Date(t.executed_at).toLocaleDateString('en',{month:'short',day:'numeric'})}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Trading() {
  const [accounts, setAccounts]     = useState([]);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [traders, setTraders]       = useState([]);
  const [running, setRunning]       = useState(null);
  const [showNewAcc, setShowNewAcc] = useState(false);
  const [showNewTrader, setShowNewTrader] = useState(false);
  const [runResult, setRunResult]   = useState(null);

  const [newAcc, setNewAcc] = useState({ name:'My Trading Account', initial_balance:'10000' });
  const [newTrader, setNewTrader] = useState({ name:'', identity:'', strategy:'', model:'gemini-2.0-flash' });

  const loadAccounts = useCallback(async () => {
    try {
      const accs = await getTradingAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAcc) setSelectedAcc(accs[0].id);
    } catch(e) { console.error(e); }
  }, [selectedAcc]);

  const loadTraders = useCallback(async () => {
    if (!selectedAcc) return;
    try { setTraders(await getTraders(selectedAcc)); }
    catch(e) { console.error(e); }
  }, [selectedAcc]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTraders(); }, [loadTraders]);

  const handleCreateAccount = async () => {
    try {
      await createTradingAccount(newAcc.name, parseFloat(newAcc.initial_balance));
      setShowNewAcc(false);
      setNewAcc({ name:'My Trading Account', initial_balance:'10000' });
      await loadAccounts();
    } catch(e) { alert(e.message); }
  };

  const handleReset = async (id) => {
    if (!confirm('Reset this account? All holdings and transactions will be cleared.')) return;
    try { await updateTradingAccount(id, { reset: true }); await loadAccounts(); await loadTraders(); }
    catch(e) { alert(e.message); }
  };

  const handleCreateTrader = async () => {
    if (!newTrader.name.trim() || !newTrader.strategy.trim()) return alert('Name and strategy are required');
    try {
      await createTrader({ ...newTrader, account_id: selectedAcc });
      setShowNewTrader(false);
      setNewTrader({ name:'', identity:'', strategy:'', model:'gemini-2.0-flash' });
      await loadTraders();
    } catch(e) { alert(e.message); }
  };

  const handleRun = async (traderId) => {
    setRunning(traderId);
    setRunResult(null);
    try {
      const result = await runTrader(traderId);
      setRunResult(result);
      await loadAccounts();
      await loadTraders();
    } catch(e) { alert(`Run failed: ${e.message}`); }
    finally { setRunning(null); }
  };

  const handleDelete = async (traderId) => {
    try { await deleteTrader(traderId); await loadTraders(); await loadAccounts(); }
    catch(e) { alert(e.message); }
  };

  const handleSchedule = async (traderId, interval) => {
    try {
      await setSchedule(traderId, interval, interval !== 'manual');
      await loadTraders();
    } catch(e) { alert(e.message); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
            <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Trading Lab</h2>
            <span className="badge badge-tertiary" style={{ fontSize:'0.6rem' }}>BETA</span>
          </div>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>
            AI-powered equity trading simulation
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewAcc(true)} style={{ gap:6 }}>
          <Plus size={14} /> New Account
        </button>
      </div>

      {/* Accounts */}
      {accounts.length > 0 ? (
        <div>
          <p className="section-title" style={{ marginBottom:'0.625rem' }}>Trading Accounts</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
            {accounts.map(acc => (
              <AccountCard key={acc.id} acc={acc} selected={selectedAcc === acc.id}
                onClick={() => setSelectedAcc(acc.id)} onReset={handleReset} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><TrendingUp size={22} color="var(--on-surface-variant)" /></div>
            <p style={{ fontWeight:600, marginBottom:4 }}>No trading accounts yet</p>
            <p style={{ fontSize:'0.8125rem', marginBottom:12 }}>Create an account to start trading with AI</p>
            <button className="btn-primary" onClick={() => setShowNewAcc(true)}><Plus size={14} /> Create Account</button>
          </div>
        </div>
      )}

      {/* Run result toast */}
      {runResult && (
        <div style={{
          background: runResult.errors?.length > 0 && runResult.executed_trades?.length === 0 ? 'rgba(248,113,113,0.1)' : 'rgba(16,217,160,0.1)',
          border: `1px solid ${runResult.errors?.length > 0 && runResult.executed_trades?.length === 0 ? 'rgba(248,113,113,0.25)' : 'rgba(16,217,160,0.25)'}`,
          borderRadius:14, padding:'1rem 1.25rem',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <p style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:4 }}>
                {runResult.trader_name} — Run Complete
              </p>
              {runResult.executed_trades?.length > 0 ? (
                <div>
                  {runResult.executed_trades.map((t,i) => (
                    <p key={i} style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>
                      {t.action === 'buy' ? '✓ Bought' : '✓ Sold'} {t.quantity} × {t.symbol} @ {fmt(t.price)} — {t.rationale}
                    </p>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>No trades executed (AI decided to hold)</p>
              )}
              {runResult.errors?.map((e,i) => (
                <p key={i} style={{ fontSize:'0.8125rem', color:'var(--error)', marginTop:2 }}>⚠ {e}</p>
              ))}
            </div>
            <button className="btn-ghost" style={{ padding:4 }} onClick={() => setRunResult(null)}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Traders */}
      {selectedAcc && (
        <div>
          <div className="section-header">
            <span className="section-title">Traders {accounts.find(a=>a.id===selectedAcc)?.name ? `— ${accounts.find(a=>a.id===selectedAcc).name}` : ''}</span>
            <button className="btn-primary" style={{ fontSize:'0.75rem', padding:'6px 12px', gap:5 }} onClick={() => setShowNewTrader(true)}>
              <Plus size={13} /> Add Trader
            </button>
          </div>
          {traders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🤖</div>
                <p style={{ fontWeight:600, marginBottom:4 }}>No traders yet</p>
                <p style={{ fontSize:'0.8125rem', marginBottom:12 }}>Add your first AI trader with a custom strategy</p>
                <button className="btn-primary" onClick={() => setShowNewTrader(true)}><Plus size={14} /> Add Trader</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'0.875rem' }}>
              {traders.map(t => (
                <TraderCard key={t.id} trader={t} running={running}
                  onRun={handleRun} onDelete={handleDelete} onSchedule={handleSchedule} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Account Modal */}
      <Modal open={showNewAcc} onClose={() => setShowNewAcc(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:'1.25rem' }}>Create Trading Account</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Account Name</label>
            <input className="input-field input-rect" value={newAcc.name}
              onChange={e => setNewAcc(p => ({ ...p, name:e.target.value }))} placeholder="e.g. Growth Portfolio" />
          </div>
          <div className="form-group">
            <label className="form-label">Initial Balance (USD)</label>
            <input className="input-field input-rect" type="number" value={newAcc.initial_balance}
              onChange={e => setNewAcc(p => ({ ...p, initial_balance:e.target.value }))} placeholder="10000" />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowNewAcc(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleCreateAccount}>Create Account</button>
          </div>
        </div>
      </Modal>

      {/* New Trader Modal */}
      <Modal open={showNewTrader} onClose={() => setShowNewTrader(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:'1.25rem' }}>Add AI Trader</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Trader Name</label>
            <input className="input-field input-rect" value={newTrader.name}
              onChange={e => setNewTrader(p => ({ ...p, name:e.target.value }))} placeholder="e.g. Warren Jr." />
          </div>
          <div className="form-group">
            <label className="form-label">Identity / Persona (optional)</label>
            <input className="input-field input-rect" value={newTrader.identity}
              onChange={e => setNewTrader(p => ({ ...p, identity:e.target.value }))} placeholder="e.g. A cautious value investor who avoids speculation" />
          </div>
          <div className="form-group">
            <label className="form-label">Trading Strategy</label>
            <textarea className="input-field input-area" value={newTrader.strategy}
              onChange={e => setNewTrader(p => ({ ...p, strategy:e.target.value }))}
              placeholder="Describe the investment strategy. e.g. Focus on large-cap tech stocks with strong earnings growth. Buy on dips, hold for at least 30 days." />
          </div>
          <div className="form-group">
            <label className="form-label">AI Model</label>
            <select className="input-field input-rect" value={newTrader.model}
              onChange={e => setNewTrader(p => ({ ...p, model:e.target.value }))}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowNewTrader(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleCreateTrader}>Add Trader</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
