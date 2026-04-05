import React, { useEffect, useState, useCallback } from 'react';
import {
  getTradingAccounts, createTradingAccount, updateTradingAccount,
  getTraders, createTrader, updateTrader, deleteTrader, runTrader,
  setSchedule, getTraderTransactions, getPortfolioHistory,
  getUserAccounts, transferFunds, importPortfolioCSV,
  getSuggestions, resolveSuggestion, bulkResolveSuggestions,
  getStrategyAdvice,
} from '../api/api';
import {
  TrendingUp, Plus, Play, Clock, Trash2, RefreshCw, ChevronDown, ChevronUp, X,
  Upload, ArrowRightLeft, Check, XCircle, Lightbulb, BarChart3, Shield,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MODELS    = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'];
const INTERVALS = ['manual','hourly','every_6h','every_12h','daily','weekly'];
const INTERVAL_LABELS = { manual:'Manual only', hourly:'Every hour', every_6h:'Every 6h', every_12h:'Every 12h', daily:'Daily', weekly:'Weekly' };

function fmt(n, prefix='$') { return `${prefix}${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`; }

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', cursor:'pointer', color:'var(--on-surface-variant)' }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function AccountCard({ acc, selected, onClick, onReset }) {
  const pnl = acc.pnl ?? 0;
  const isPos = pnl >= 0;
  return (
    <div onClick={onClick} style={{
      padding:'1.25rem 1.5rem', borderRadius:16, cursor:'pointer',
      background: selected ? 'rgba(109,82,232,0.08)' : 'var(--surface-container)',
      border: selected ? '2px solid rgba(109,82,232,0.4)' : '1px solid var(--outline)',
      transition:'all 0.2s', display:'flex', flexDirection:'column', gap:6,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p style={{ fontWeight:700, fontSize:'0.9375rem' }}>{acc.name}</p>
        <span style={{ fontSize:'0.8125rem', fontWeight:700, color: isPos ? 'var(--tertiary)' : 'var(--error)' }}>
          {isPos ? '+' : ''}{fmt(pnl)}
        </span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>Cash: {fmt(acc.cash_balance)}</span>
        <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>{acc.trader_count} traders</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
        <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>Total: <b style={{ color:'var(--on-surface)' }}>{fmt(acc.total_value)}</b></span>
        <button className="btn-ghost" style={{ padding:'2px 8px', fontSize:'0.75rem' }}
          onClick={e => { e.stopPropagation(); onReset(acc.id); }}>
          <RefreshCw size={11} /> Reset
        </button>
      </div>
    </div>
  );
}

/* ── Portfolio Chart ── accepts refreshKey to force re-fetch after trades */
function PortfolioChart({ traderId, refreshKey }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const history = await getPortfolioHistory(traderId);
        if (!cancelled) setData(history.map(h => ({
          ...h,
          time: new Date(h.timestamp).toLocaleDateString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
        })));
      } catch(_) {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [traderId, refreshKey]); // ← refreshKey forces re-fetch

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:'1.5rem' }}><div className="spinner" /></div>;
  if (data.length < 2) return <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', textAlign:'center', padding:'1.5rem' }}>Not enough data for chart yet. Run the trader to generate data.</p>;

  return (
    <div className="portfolio-chart-container">
      <p style={{ fontSize:'0.6875rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--on-surface-variant)', marginBottom:12 }}>Portfolio Value Over Time</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--outline)" />
          <XAxis dataKey="time" tick={{ fontSize:10, fill:'var(--on-surface-variant)' }} />
          <YAxis tick={{ fontSize:10, fill:'var(--on-surface-variant)' }} tickFormatter={v => `$${v.toLocaleString()}`} />
          <Tooltip
            formatter={(v) => [fmt(v), 'Value']}
            contentStyle={{ background:'var(--surface-container-high)', border:'1px solid var(--outline)', borderRadius:12, fontSize:'0.875rem' }}
          />
          <Line type="monotone" dataKey="value" stroke="#6d52e8" strokeWidth={2.5} dot={false} activeDot={{ r:4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SuggestionCard({ suggestion, onResolve, resolving }) {
  const isBuy = suggestion.action === 'buy';
  const totalValue = (suggestion.price * suggestion.quantity).toFixed(2);
  return (
    <div className={`suggestion-card ${suggestion.action}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:'0.8125rem', fontWeight:800, color: isBuy ? 'var(--tertiary)' : 'var(--error)', textTransform:'uppercase' }}>
            {suggestion.action}
          </span>
          <span style={{ fontWeight:700, fontSize:'0.9375rem' }}>{suggestion.quantity} × {suggestion.symbol}</span>
          <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>@ {fmt(suggestion.price)}</span>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:'0.8125rem', fontWeight:700 }}>{fmt(totalValue)}</span>
          {suggestion.confidence && (
            <span className={`badge ${suggestion.confidence === 'high' ? 'badge-tertiary' : suggestion.confidence === 'low' ? 'badge-error' : 'badge-muted'}`} style={{ fontSize:'0.65rem' }}>
              {suggestion.confidence}
            </span>
          )}
        </div>
      </div>
      {suggestion.reasoning && (
        <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', lineHeight:1.6, marginBottom:10 }}>
          {suggestion.reasoning}
        </p>
      )}
      {suggestion.sources?.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
          {suggestion.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:'0.75rem', color:'var(--primary)', textDecoration:'underline' }}>
              {s.title || s.url}
            </a>
          ))}
        </div>
      )}
      {suggestion.status === 'pending' && (
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <button className="btn-primary" style={{ flex:1, fontSize:'0.8125rem', padding:'8px', gap:5 }}
            disabled={resolving} onClick={() => onResolve(suggestion.id, 'approve')}>
            <Check size={14} /> Approve
          </button>
          <button className="btn-danger" style={{ flex:1, fontSize:'0.8125rem', padding:'8px', gap:5 }}
            disabled={resolving} onClick={() => onResolve(suggestion.id, 'reject')}>
            <XCircle size={14} /> Reject
          </button>
        </div>
      )}
      {suggestion.status !== 'pending' && (
        <span className={`badge ${suggestion.status === 'approved' ? 'badge-tertiary' : 'badge-error'}`} style={{ fontSize:'0.7rem' }}>
          {suggestion.status}
        </span>
      )}
    </div>
  );
}

function TraderCard({ trader, onRun, onDelete, onSchedule, onToggleApproval, running, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('holdings');
  const [txns, setTxns] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [chartKey, setChartKey] = useState(0);       // ← forces chart re-fetch
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);

  const loadTab = async (tab) => {
    if (expanded && activeTab === tab) { setExpanded(false); return; }
    setExpanded(true);
    setActiveTab(tab);
    setLoadingTab(true);
    try {
      if (tab === 'transactions') setTxns(await getTraderTransactions(trader.id, 30));
      if (tab === 'suggestions') setSuggestions(await getSuggestions(trader.id));
    } catch(_) {}
    finally { setLoadingTab(false); }
  };

  const refreshSuggestions = async () => {
    setRefreshingSuggestions(true);
    try { setSuggestions(await getSuggestions(trader.id)); }
    catch(_) {}
    finally { setRefreshingSuggestions(false); }
  };

  const handleResolve = async (id, action) => {
    setResolvingId(id);
    try {
      await resolveSuggestion(id, action);
      setSuggestions(await getSuggestions(trader.id));
      setChartKey(k => k + 1);  // ← refresh chart
      onRefresh();
    } catch(e) { alert(e.message); }
    finally { setResolvingId(null); }
  };

  const handleBulkResolve = async (action) => {
    const pendingIds = suggestions.filter(s => s.status === 'pending').map(s => s.id);
    if (!pendingIds.length) return;
    setResolvingId('bulk');
    try {
      await bulkResolveSuggestions(pendingIds, action);
      setSuggestions(await getSuggestions(trader.id));
      setChartKey(k => k + 1);
      onRefresh();
    } catch(e) { alert(e.message); }
    finally { setResolvingId(null); }
  };

  const handleAdvisor = async () => {
    setShowAdvisor(!showAdvisor);
    if (!advice && !advisorLoading) {
      setAdvisorLoading(true);
      try { setAdvice(await getStrategyAdvice(trader.id)); }
      catch(e) { alert(e.message); }
      finally { setAdvisorLoading(false); }
    }
  };

  const handleCsvImport = async () => {
    if (!csvContent.trim()) return;
    setCsvLoading(true);
    try {
      const result = await importPortfolioCSV(trader.id, csvContent);
      alert(`Imported ${result.imported} holdings (cost: ${fmt(result.total_cost)})`);
      setShowCsvModal(false); setCsvContent('');
      setChartKey(k => k + 1);
      onRefresh();
    } catch(e) { alert(e.message); }
    finally { setCsvLoading(false); }
  };

  const holdings = trader.holdings ?? [];
  const pendingCount = trader.pending_suggestions ?? 0;

  return (
    <div className="trader-card">
      <div className="trader-card-inner">
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:40, height:40, background:'linear-gradient(135deg,#6d52e8,#9D85FF)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.125rem', flexShrink:0 }}>🤖</div>
              <div>
                <p style={{ fontWeight:800, fontSize:'1.0625rem' }}>{trader.name}</p>
                <span className="badge badge-primary" style={{ fontSize:'0.65rem' }}>{trader.model}</span>
              </div>
            </div>
            {trader.identity && (
              <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', fontStyle:'italic', marginBottom:4 }}>
                "{trader.identity}"
              </p>
            )}
            <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', lineHeight:1.5 }}>
              {trader.strategy}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="trader-stat-row">
          <div className="trader-stat-box">
            <div className="stat-val">{fmt(trader.portfolio_value ?? 0)}</div>
            <div className="stat-lbl">Portfolio</div>
          </div>
          <div className="trader-stat-box">
            <div className="stat-val">{trader.run_count || 0}</div>
            <div className="stat-lbl">Runs</div>
          </div>
          <div className="trader-stat-box">
            <div className="stat-val" style={{ color: pendingCount > 0 ? 'var(--error)' : undefined }}>{pendingCount}</div>
            <div className="stat-lbl">Pending</div>
          </div>
        </div>

        {/* Approval + Schedule */}
        <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--surface-container-high)', borderRadius:12, flex:1, minWidth:180 }}>
            <Shield size={13} color="var(--on-surface-variant)" />
            <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', flex:1 }}>Require approval</span>
            <button className={`toggle-switch ${trader.require_approval ? 'active' : ''}`}
              onClick={() => onToggleApproval(trader.id, !trader.require_approval)} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', background:'var(--surface-container-high)', borderRadius:12, flex:1, minWidth:180 }}>
            <Clock size={13} color="var(--on-surface-variant)" />
            <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', flex:1 }}>
              {INTERVAL_LABELS[trader.schedule_interval] ?? trader.schedule_interval}
            </span>
            {trader.schedule_active && <span className="badge badge-tertiary" style={{ fontSize:'0.6rem' }}>● Active</span>}
          </div>
        </div>

        {trader.last_run_at && (
          <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)', marginBottom:'0.75rem' }}>
            Last run: {new Date(trader.last_run_at).toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
          </p>
        )}

        {/* Holdings */}
        {holdings.length > 0 && (
          <div style={{ background:'var(--surface-container-high)', borderRadius:14, padding:'0.875rem', marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.6875rem', color:'var(--on-surface-variant)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>Holdings</p>
            {holdings.map(h => (
              <div key={h.symbol} className="holding-row">
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:'0.9375rem' }}>{h.symbol}</span>
                  <span style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>{h.quantity} shares</span>
                </div>
                <div style={{ textAlign:'right' }}>
                  {h.market_value != null && <p style={{ fontWeight:700, fontSize:'0.9375rem' }}>{fmt(h.market_value)}</p>}
                  {h.unrealized_pnl != null && (
                    <p style={{ fontSize:'0.75rem', color: h.unrealized_pnl >= 0 ? 'var(--tertiary)' : 'var(--error)', fontWeight:600 }}>
                      {h.unrealized_pnl >= 0 ? '+' : ''}{fmt(h.unrealized_pnl)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions row 1: Run + Schedule + Delete */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          <button className="btn-primary" style={{ flex:'1 1 100px', fontSize:'0.8125rem', padding:'9px 14px', minWidth:90 }}
            onClick={() => onRun(trader.id)} disabled={running === trader.id}>
            {running === trader.id ? <span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> : <><Play size={14} /> Run</>}
          </button>
          <select value={trader.schedule_interval} onChange={e => onSchedule(trader.id, e.target.value)}
            style={{ flex:'2 1 140px', background:'var(--surface-container-high)', border:'1px solid var(--outline)', borderRadius:12, padding:'8px 12px', color:'var(--on-surface)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'inherit' }}>
            {INTERVALS.map(iv => <option key={iv} value={iv}>{INTERVAL_LABELS[iv]}</option>)}
          </select>
          <button className="btn-danger" style={{ padding:'9px 12px' }} onClick={() => { if(confirm(`Delete trader "${trader.name}"?`)) onDelete(trader.id); }}>
            <Trash2 size={14} />
          </button>
        </div>

        {/* Actions row 2 */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button className="btn-ghost" style={{ flex:1, padding:'8px 10px', gap:5, fontSize:'0.8125rem' }} onClick={() => { setShowChart(!showChart); if (!showChart) setChartKey(k => k + 1); }}>
            <BarChart3 size={14} /> {showChart ? 'Hide Chart' : 'Chart'}
          </button>
          <button className="btn-ghost" style={{ flex:1, padding:'8px 10px', gap:5, fontSize:'0.8125rem' }} onClick={() => loadTab('transactions')}>
            {expanded && activeTab === 'transactions' ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Transactions
          </button>
          {trader.require_approval && (
            <button className="btn-ghost" style={{ flex:1, padding:'8px 10px', gap:5, fontSize:'0.8125rem', position:'relative' }} onClick={() => loadTab('suggestions')}>
              <Shield size={14} /> Suggestions
              {pendingCount > 0 && <span style={{ position:'absolute', top:-4, right:-4, width:20, height:20, borderRadius:'50%', background:'var(--error)', color:'#fff', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{pendingCount}</span>}
            </button>
          )}
          <button className="btn-ghost" style={{ flex:1, padding:'8px 10px', gap:5, fontSize:'0.8125rem' }} onClick={handleAdvisor}>
            <Lightbulb size={14} /> Advisor
          </button>
          <button className="btn-ghost" style={{ padding:'8px 10px', gap:5, fontSize:'0.8125rem' }} onClick={() => setShowCsvModal(true)}>
            <Upload size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Portfolio chart */}
      {showChart && (
        <div style={{ borderTop:'1px solid var(--outline)', padding:'1.25rem' }}>
          <PortfolioChart traderId={trader.id} refreshKey={chartKey} />
        </div>
      )}

      {/* Strategy advisor */}
      {showAdvisor && (
        <div style={{ borderTop:'1px solid var(--outline)', padding:'1.25rem' }}>
          <p className="section-title" style={{ marginBottom:'0.75rem' }}>Strategy Advisor</p>
          {advisorLoading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'1.5rem' }}><div className="spinner" /></div>
          ) : advice ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <p style={{ fontSize:'0.875rem', lineHeight:1.6 }}>{advice.performance_summary}</p>
              {advice.strengths?.length > 0 && (
                <div>
                  <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--tertiary)', marginBottom:6 }}>Strengths</p>
                  {advice.strengths.map((s, i) => <p key={i} style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>+ {s}</p>)}
                </div>
              )}
              {advice.weaknesses?.length > 0 && (
                <div>
                  <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--error)', marginBottom:6 }}>Weaknesses</p>
                  {advice.weaknesses.map((s, i) => <p key={i} style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>- {s}</p>)}
                </div>
              )}
              {advice.recommendations?.length > 0 && (
                <div>
                  <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--primary)', marginBottom:6 }}>Recommendations</p>
                  {advice.recommendations.map((s, i) => <p key={i} style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>{i+1}. {s}</p>)}
                </div>
              )}
              {advice.suggested_strategy && (
                <div style={{ background:'var(--surface-container-high)', borderRadius:12, padding:'1rem' }}>
                  <p style={{ fontSize:'0.75rem', fontWeight:700, marginBottom:6 }}>Suggested Strategy Update</p>
                  <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', lineHeight:1.6, fontStyle:'italic' }}>{advice.suggested_strategy}</p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>No advice available</p>
          )}
        </div>
      )}

      {/* Expandable panels */}
      {expanded && (
        <div style={{ borderTop:'1px solid var(--outline)', padding:'1.25rem' }}>
          {activeTab === 'transactions' && (
            <>
              <div className="panel-header">
                <p className="section-title">Recent Transactions</p>
                <button className={`btn-icon-sm ${loadingTab ? 'spinning' : ''}`}
                  onClick={() => loadTab('transactions')} title="Refresh">
                  <RefreshCw size={13} />
                </button>
              </div>
              {loadingTab ? (
                <div style={{ display:'flex', justifyContent:'center', padding:'1.5rem' }}><div className="spinner" /></div>
              ) : txns.length === 0 ? (
                <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', textAlign:'center', padding:'1.5rem' }}>No transactions yet. Run the trader to start trading.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {txns.map(t => (
                    <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--outline-variant)' }}>
                      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                        <span style={{ fontSize:'0.8125rem', fontWeight:700, color: t.side==='buy' ? 'var(--tertiary)' : 'var(--error)' }}>
                          {t.side.toUpperCase()}
                        </span>
                        <span style={{ fontSize:'0.875rem', fontWeight:600 }}>{t.quantity} × {t.symbol}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:'0.875rem', fontWeight:700 }}>@ {fmt(t.price)}</p>
                        <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)' }}>{new Date(t.executed_at).toLocaleDateString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {activeTab === 'suggestions' && (
            <>
              <div className="panel-header">
                <p className="section-title">Trade Suggestions</p>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {suggestions.filter(s => s.status === 'pending').length > 1 && (
                    <>
                      <button className="btn-primary" style={{ fontSize:'0.7rem', padding:'5px 10px', gap:4 }}
                        disabled={resolvingId} onClick={() => handleBulkResolve('approve')}>
                        <Check size={11} /> Approve All
                      </button>
                      <button className="btn-danger" style={{ fontSize:'0.7rem', padding:'5px 10px', gap:4 }}
                        disabled={resolvingId} onClick={() => handleBulkResolve('reject')}>
                        <XCircle size={11} /> Reject All
                      </button>
                    </>
                  )}
                  <button className={`btn-icon-sm ${refreshingSuggestions ? 'spinning' : ''}`}
                    onClick={refreshSuggestions} title="Refresh suggestions">
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              {loadingTab ? (
                <div style={{ display:'flex', justifyContent:'center', padding:'1.5rem' }}><div className="spinner" /></div>
              ) : suggestions.length === 0 ? (
                <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', textAlign:'center', padding:'1.5rem' }}>No suggestions yet. Run the trader to generate them.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {suggestions.map(s => (
                    <SuggestionCard key={s.id} suggestion={s} onResolve={handleResolve} resolving={resolvingId != null} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CSV Import Modal */}
      <Modal open={showCsvModal} onClose={() => setShowCsvModal(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.125rem', marginBottom:'1.25rem' }}>Import Portfolio (CSV)</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>
            Paste CSV with columns: <b>symbol,quantity</b>
          </p>
          <textarea className="input-field input-area" value={csvContent} onChange={e => setCsvContent(e.target.value)}
            placeholder={"symbol,quantity\nAAPL,10\nGOOG,5\nSPY,20"} style={{ minHeight:120, fontFamily:'monospace', fontSize:'0.875rem' }} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowCsvModal(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleCsvImport} disabled={csvLoading}>
              {csvLoading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Trading() {
  const [accounts, setAccounts]     = useState([]);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [traders, setTraders]       = useState([]);
  const [running, setRunning]       = useState(null);
  const [showNewTrader, setShowNewTrader] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [runResult, setRunResult]   = useState(null);

  const [newTrader, setNewTrader] = useState({ name:'', identity:'', strategy:'', model:'gemini-2.0-flash', require_approval:false });

  const [userAccounts, setUserAccounts] = useState([]);
  const [transferData, setTransferData] = useState({ source_account_id:'', amount:'' });
  const [transferLoading, setTransferLoading] = useState(false);

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
    try { await createTradingAccount('My Trading Account', 10000); await loadAccounts(); }
    catch(e) { alert(e.message); }
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
      setNewTrader({ name:'', identity:'', strategy:'', model:'gemini-2.0-flash', require_approval:false });
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
    try { await setSchedule(traderId, interval, interval !== 'manual'); await loadTraders(); }
    catch(e) { alert(e.message); }
  };

  const handleToggleApproval = async (traderId, value) => {
    try { await updateTrader(traderId, { require_approval: value }); await loadTraders(); }
    catch(e) { alert(e.message); }
  };

  const handleOpenTransfer = async () => {
    setShowTransfer(true);
    try { setUserAccounts(await getUserAccounts()); }
    catch(e) { console.error(e); }
  };

  const handleTransfer = async () => {
    if (!transferData.source_account_id || !transferData.amount) return alert('Select an account and enter an amount');
    setTransferLoading(true);
    try {
      await transferFunds(parseInt(transferData.source_account_id), selectedAcc, parseFloat(transferData.amount));
      setShowTransfer(false);
      setTransferData({ source_account_id:'', amount:'' });
      await loadAccounts();
    } catch(e) { alert(e.message); }
    finally { setTransferLoading(false); }
  };

  const handleRefresh = async () => { await loadAccounts(); await loadTraders(); };

  return (
    <div className="trading-light-theme" style={{ display:'flex', flexDirection:'column', gap:'1.75rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <h2 style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em' }}>Trading Lab</h2>
            <span className="badge badge-tertiary" style={{ fontSize:'0.65rem' }}>BETA</span>
          </div>
          <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>
            AI-powered equity trading simulation
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {selectedAcc && (
            <button className="btn-secondary" onClick={handleOpenTransfer} style={{ gap:6 }}>
              <ArrowRightLeft size={14} /> Transfer Funds
            </button>
          )}
          {accounts.length === 0 && (
            <button className="btn-primary" onClick={handleCreateAccount} style={{ gap:6 }}>
              <Plus size={14} /> New Account
            </button>
          )}
        </div>
      </div>

      {/* Accounts */}
      {accounts.length > 0 ? (
        <div>
          <p className="section-title" style={{ marginBottom:'0.75rem' }}>Trading Accounts</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0.875rem' }}>
            {accounts.map(acc => (
              <AccountCard key={acc.id} acc={acc} selected={selectedAcc === acc.id}
                onClick={() => setSelectedAcc(acc.id)} onReset={handleReset} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><TrendingUp size={24} color="var(--on-surface-variant)" /></div>
            <p style={{ fontWeight:600, marginBottom:6 }}>No trading accounts yet</p>
            <p style={{ fontSize:'0.875rem', marginBottom:16 }}>Create an account to start trading with AI agents</p>
            <button className="btn-primary" onClick={handleCreateAccount}><Plus size={14} /> Create Account</button>
          </div>
        </div>
      )}

      {/* Run result toast */}
      {runResult && (
        <div style={{
          background: runResult.errors?.length > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(5,150,105,0.06)',
          border: `1px solid ${runResult.errors?.length > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(5,150,105,0.2)'}`,
          borderRadius:16, padding:'1.25rem 1.5rem',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0, marginRight:'1rem' }}>
              <p style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:6 }}>
                {runResult.trader_name} — {runResult.session === 'trade' ? 'Trade' : 'Rebalance'} Session Complete
              </p>
              {runResult.summary ? (
                <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)', lineHeight:1.6 }}>{runResult.summary}</p>
              ) : (
                <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>Session complete — check transaction history for details.</p>
              )}
              {runResult.errors?.map((e,i) => (
                <p key={i} style={{ fontSize:'0.875rem', color:'var(--error)', marginTop:4 }}>⚠ {e}</p>
              ))}
            </div>
            <button className="btn-ghost" style={{ padding:6, flexShrink:0 }} onClick={() => setRunResult(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Traders */}
      {selectedAcc && (
        <div>
          <div className="section-header">
            <span className="section-title">Traders {accounts.find(a=>a.id===selectedAcc)?.name ? `— ${accounts.find(a=>a.id===selectedAcc).name}` : ''}</span>
            <button className="btn-primary" style={{ fontSize:'0.8125rem', padding:'8px 14px', gap:6 }} onClick={() => setShowNewTrader(true)}>
              <Plus size={14} /> Add Trader
            </button>
          </div>
          {traders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🤖</div>
                <p style={{ fontWeight:600, marginBottom:6 }}>No traders yet</p>
                <p style={{ fontSize:'0.875rem', marginBottom:16 }}>Add your first AI trader with a custom strategy</p>
                <button className="btn-primary" onClick={() => setShowNewTrader(true)}><Plus size={14} /> Add Trader</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(480px,1fr))', gap:'1rem' }}>
              {traders.map(t => (
                <TraderCard key={t.id} trader={t} running={running}
                  onRun={handleRun} onDelete={handleDelete} onSchedule={handleSchedule}
                  onToggleApproval={handleToggleApproval} onRefresh={handleRefresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Trader Modal */}
      <Modal open={showNewTrader} onClose={() => setShowNewTrader(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.25rem', marginBottom:'1.5rem' }}>Add AI Trader</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
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
              placeholder="Describe the investment strategy. e.g. Focus on large-cap tech stocks with strong earnings growth." />
          </div>
          <div className="form-group">
            <label className="form-label">AI Model</label>
            <select className="input-field input-rect" value={newTrader.model}
              onChange={e => setNewTrader(p => ({ ...p, model:e.target.value }))}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className={`toggle-switch ${newTrader.require_approval ? 'active' : ''}`}
              onClick={() => setNewTrader(p => ({ ...p, require_approval: !p.require_approval }))} />
            <div>
              <p style={{ fontSize:'0.875rem', fontWeight:600 }}>Require human approval</p>
              <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>Trades become suggestions you approve/reject</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowNewTrader(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleCreateTrader}>Add Trader</button>
          </div>
        </div>
      </Modal>

      {/* Transfer Funds Modal */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)}>
        <h3 style={{ fontWeight:800, fontSize:'1.25rem', marginBottom:'1.5rem' }}>Transfer Funds</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <p style={{ fontSize:'0.875rem', color:'var(--on-surface-variant)' }}>
            Transfer funds from your bank account to <b>{accounts.find(a=>a.id===selectedAcc)?.name}</b>
          </p>
          <div className="form-group">
            <label className="form-label">Source Account</label>
            <select className="input-field input-rect" value={transferData.source_account_id}
              onChange={e => setTransferData(p => ({ ...p, source_account_id:e.target.value }))}>
              <option value="">Select account...</option>
              {userAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance)} ({a.type})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (USD)</label>
            <input className="input-field input-rect" type="number" value={transferData.amount}
              onChange={e => setTransferData(p => ({ ...p, amount:e.target.value }))} placeholder="1000" />
          </div>
          {transferData.source_account_id && (
            <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>
              Available: {fmt(userAccounts.find(a => a.id === parseInt(transferData.source_account_id))?.balance ?? 0)}
            </p>
          )}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowTransfer(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleTransfer} disabled={transferLoading}>
              {transferLoading ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
