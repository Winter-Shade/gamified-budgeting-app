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
  TrendingUp, Plus, Play, Clock, Trash2, RefreshCw, X,
  Upload, ArrowRightLeft, Check, XCircle, Lightbulb, BarChart3, Shield,
  ChevronDown, ChevronUp, FileText, Bot,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MODELS    = ['gemini-2.0-flash','gemini-2.0-flash-lite','gemini-1.5-pro','gemini-1.5-flash'];
const INTERVALS = ['manual','hourly','every_6h','every_12h','daily','weekly'];
const INTERVAL_LABELS = { manual:'Manual only', hourly:'Every hour', every_6h:'Every 6h', every_12h:'Every 12h', daily:'Daily', weekly:'Weekly' };

function fmt(n, p='$') { return `${p}${Number(n ?? 0).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}`; }

/* ── Modal ── */
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e=>e.stopPropagation()} style={{position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'none',border:'none',cursor:'pointer',color:'var(--tl-on-surface-var)'}}>
          <X size={18}/>
        </button>
        {children}
      </div>
    </div>
  );
}

/* ── Portfolio Chart ── */
function PortfolioChart({ traderId, refreshKey }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const h = await getPortfolioHistory(traderId);
        if (!c) setData(h.map(x => ({...x, time: new Date(x.timestamp).toLocaleDateString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})})));
      } catch(_){}
      finally { if(!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, [traderId, refreshKey]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner"/></div>;
  if (data.length < 2) return <p className="tl-muted" style={{textAlign:'center',padding:'2rem',fontSize:'0.875rem'}}>Not enough data yet. Run the trader to generate chart data.</p>;

  return (
    <div className="tl-chart-container">
      <p className="tl-label" style={{marginBottom:12}}>Portfolio Value Over Time</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,196,215,0.15)" />
          <XAxis dataKey="time" tick={{fontSize:10, fill:'#484554'}} />
          <YAxis tick={{fontSize:10, fill:'#484554'}} tickFormatter={v=>`$${v.toLocaleString()}`} />
          <Tooltip formatter={v=>[fmt(v),'Value']} contentStyle={{background:'#fff',border:'1px solid rgba(201,196,215,0.1)',borderRadius:12,fontSize:'0.875rem'}} />
          <Line type="monotone" dataKey="value" stroke="#5435ce" strokeWidth={2.5} dot={false} activeDot={{r:4}} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Suggestion Card (Stitch style) ── */
function SuggestionCard({ suggestion, onResolve, resolving }) {
  const isBuy = suggestion.action === 'buy';
  const total = (suggestion.price * suggestion.quantity).toFixed(2);
  return (
    <div className="tl-suggestion-card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <span className={`tl-action-badge ${suggestion.action}`}>{suggestion.action}</span>
        {suggestion.confidence && (
          <span className={`tl-confidence ${suggestion.confidence}`}>
            {suggestion.confidence === 'high' ? '✓ ' : ''}{suggestion.confidence} confidence
          </span>
        )}
      </div>
      <h5 style={{fontSize:'1rem',fontWeight:700,marginBottom:6}}>{suggestion.symbol}</h5>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:8}}>
        <div>
          <p className="tl-label">Qty</p>
          <p style={{fontSize:'0.875rem',fontWeight:700}}>{suggestion.quantity}</p>
        </div>
        <div>
          <p className="tl-label">Price</p>
          <p style={{fontSize:'0.875rem',fontWeight:700}}>{fmt(suggestion.price)}</p>
        </div>
      </div>
      <div style={{borderTop:'1px solid rgba(201,196,215,0.05)',paddingTop:8,marginBottom:12}}>
        <p className="tl-label">Estimated Total</p>
        <p style={{fontSize:'1.125rem',fontWeight:900}}>{fmt(total)}</p>
      </div>
      {suggestion.reasoning && (
        <div className="tl-reasoning" style={{marginBottom:12}}>
          <span style={{fontWeight:700}}>Reasoning: </span>{suggestion.reasoning}
        </div>
      )}
      {suggestion.sources?.length > 0 && (
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12,fontSize:'10px',color:'rgba(72,69,84,0.6)'}}>
          <FileText size={12}/>
          <span style={{fontWeight:700}}>Source: {suggestion.sources.map(s => s.title || s.url).join(', ')}</span>
        </div>
      )}
      {suggestion.status === 'pending' ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <button className="tl-btn-outline" style={{fontSize:'0.8125rem',padding:'0.625rem',justifyContent:'center'}}
            disabled={resolving} onClick={()=>onResolve(suggestion.id,'reject')}>Reject</button>
          <button className="tl-btn-primary" style={{fontSize:'0.8125rem',padding:'0.625rem'}}
            disabled={resolving} onClick={()=>onResolve(suggestion.id,'approve')}>Approve</button>
        </div>
      ) : (
        <span className={`tl-action-badge ${suggestion.status === 'approved' ? 'buy' : 'sell'}`}>{suggestion.status}</span>
      )}
    </div>
  );
}

/* ── Trader Card (Stitch "AI Strategy Control" layout) ── */
function TraderCard({ trader, onRun, onDelete, onSchedule, onToggleApproval, running, onRefresh }) {
  const [showChart, setShowChart] = useState(false);
  const [showTxns, setShowTxns] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [txns, setTxns] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [chartKey, setChartKey] = useState(0);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);

  const holdings = trader.holdings ?? [];
  const pendingCount = trader.pending_suggestions ?? 0;

  const toggleTxns = async () => {
    if (showTxns) { setShowTxns(false); return; }
    setShowTxns(true); setShowSuggestions(false); setShowAdvisor(false);
    setLoadingTxns(true);
    try { setTxns(await getTraderTransactions(trader.id, 30)); } catch(_){}
    finally { setLoadingTxns(false); }
  };

  const toggleSuggestions = async () => {
    if (showSuggestions) { setShowSuggestions(false); return; }
    setShowSuggestions(true); setShowTxns(false); setShowAdvisor(false);
    setLoadingSugg(true);
    try { setSuggestions(await getSuggestions(trader.id)); } catch(_){}
    finally { setLoadingSugg(false); }
  };

  const refreshSuggestions = async () => {
    setLoadingSugg(true);
    try { setSuggestions(await getSuggestions(trader.id)); } catch(_){}
    finally { setLoadingSugg(false); }
  };

  const handleResolve = async (id, action) => {
    setResolvingId(id);
    try {
      await resolveSuggestion(id, action);
      setSuggestions(await getSuggestions(trader.id));
      setChartKey(k=>k+1);
      onRefresh();
    } catch(e) { alert(e.message); }
    finally { setResolvingId(null); }
  };

  const handleBulkResolve = async (action) => {
    const ids = suggestions.filter(s=>s.status==='pending').map(s=>s.id);
    if (!ids.length) return;
    setResolvingId('bulk');
    try {
      await bulkResolveSuggestions(ids, action);
      setSuggestions(await getSuggestions(trader.id));
      setChartKey(k=>k+1);
      onRefresh();
    } catch(e) { alert(e.message); }
    finally { setResolvingId(null); }
  };

  const toggleAdvisor = async () => {
    if (showAdvisor) { setShowAdvisor(false); return; }
    setShowAdvisor(true); setShowTxns(false); setShowSuggestions(false);
    if (!advice) {
      setAdvisorLoading(true);
      try { setAdvice(await getStrategyAdvice(trader.id)); } catch(e) { alert(e.message); }
      finally { setAdvisorLoading(false); }
    }
  };

  const rerunAdvisor = async () => {
    setAdvisorLoading(true); setAdvice(null);
    try { setAdvice(await getStrategyAdvice(trader.id)); } catch(e) { alert(e.message); }
    finally { setAdvisorLoading(false); }
  };

  const handleCsvImport = async () => {
    if (!csvContent.trim()) return;
    setCsvLoading(true);
    try {
      const r = await importPortfolioCSV(trader.id, csvContent);
      alert(`Imported ${r.imported} holdings (cost: ${fmt(r.total_cost)})`);
      setShowCsvModal(false); setCsvContent('');
      setChartKey(k=>k+1); onRefresh();
    } catch(e) { alert(e.message); }
    finally { setCsvLoading(false); }
  };

  return (
    <div className="tl-trader-card">
      {/* ── Header ── */}
      <div className="tl-trader-section" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'1rem'}}>
        <div style={{display:'flex',gap:'1rem',alignItems:'center',flex:1,minWidth:0}}>
          <div style={{width:56,height:56,background:'rgba(84,53,206,0.05)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Bot size={28} color="#5435ce"/>
          </div>
          <div style={{minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <h4 style={{fontSize:'1.25rem',fontWeight:700,letterSpacing:'-0.02em'}}>{trader.name}</h4>
              <span className="tl-model-badge">{trader.model}</span>
            </div>
            <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)',lineHeight:1.5,maxWidth:480}}>
              {trader.identity ? `"${trader.identity}" · ` : ''}{trader.strategy}
            </p>
          </div>
        </div>
        {/* Toolbar icons */}
        <div style={{display:'flex',gap:4}}>
          <button className={`tl-icon-btn ${showChart ? 'active' : ''}`} title="Chart"
            onClick={()=>{setShowChart(!showChart);if(!showChart) setChartKey(k=>k+1);}}>
            <BarChart3 size={20}/>
          </button>
          <button className={`tl-icon-btn ${showTxns ? 'active' : ''}`} title="Transactions" onClick={toggleTxns}>
            <FileText size={20}/>
          </button>
          {trader.require_approval && (
            <button className={`tl-icon-btn ${showSuggestions ? 'active' : ''}`} title="Suggestions" onClick={toggleSuggestions}>
              <Lightbulb size={20}/>
              {pendingCount > 0 && <span className="tl-notif">{pendingCount}</span>}
            </button>
          )}
          <button className={`tl-icon-btn ${showAdvisor ? 'active' : ''}`} title="Advisor" onClick={toggleAdvisor}>
            <Shield size={20}/>
          </button>
          <button className="tl-icon-btn" title="Import CSV" onClick={()=>setShowCsvModal(true)}>
            <Upload size={20}/>
          </button>
        </div>
      </div>

      {/* ── Stats Grid (3-col) ── */}
      <div className="tl-stats-grid">
        <div className="tl-stat-cell">
          <p className="tl-label" style={{marginBottom:4}}>Portfolio Value</p>
          <p className="tl-value-md">{fmt(trader.portfolio_value ?? 0)}</p>
        </div>
        <div className="tl-stat-cell">
          <p className="tl-label" style={{marginBottom:4}}>Total Runs</p>
          <p className="tl-value-md">{trader.run_count || 0}</p>
        </div>
        <div className="tl-stat-cell">
          <p className="tl-label" style={{marginBottom:4}}>Pending Orders</p>
          <p className="tl-value-md" style={{color: pendingCount > 0 ? 'var(--tl-primary)' : undefined}}>{pendingCount}</p>
        </div>
      </div>

      {/* ── Holdings Table ── */}
      {holdings.length > 0 && (
        <div className="tl-trader-section">
          <p className="tl-label" style={{marginBottom:16}}>Current Holdings</p>
          <table className="tl-holdings-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th style={{textAlign:'right'}}>Shares</th>
                <th style={{textAlign:'right'}}>Market Value</th>
                <th style={{textAlign:'right'}}>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => (
                <tr key={h.symbol}>
                  <td className="sym">{h.symbol}</td>
                  <td style={{textAlign:'right'}}>{h.quantity}</td>
                  <td style={{textAlign:'right'}}>{h.market_value != null ? fmt(h.market_value) : '—'}</td>
                  <td style={{textAlign:'right',color: (h.unrealized_pnl ?? 0) >= 0 ? 'var(--tl-green)' : 'var(--tl-red)', fontWeight:600}}>
                    {h.unrealized_pnl != null ? `${h.unrealized_pnl >= 0 ? '+' : ''}${fmt(h.unrealized_pnl)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Chart panel ── */}
      {showChart && (
        <div className="tl-trader-section">
          <PortfolioChart traderId={trader.id} refreshKey={chartKey}/>
        </div>
      )}

      {/* ── Transactions panel ── */}
      {showTxns && (
        <div className="tl-trader-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p className="tl-label">Recent Transactions</p>
            <button className={`tl-icon-btn ${loadingTxns?'spinning':''}`} onClick={toggleTxns} title="Refresh">
              <RefreshCw size={16}/>
            </button>
          </div>
          {loadingTxns ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner"/></div>
           : txns.length === 0 ? <p className="tl-muted" style={{textAlign:'center',padding:'1.5rem',fontSize:'0.875rem'}}>No transactions yet</p>
           : (
            <table className="tl-holdings-table">
              <thead><tr><th>Side</th><th>Symbol</th><th style={{textAlign:'right'}}>Qty</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Date</th></tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id}>
                    <td style={{fontWeight:700,color:t.side==='buy'?'var(--tl-green)':'var(--tl-red)'}}>{t.side.toUpperCase()}</td>
                    <td className="sym">{t.symbol}</td>
                    <td style={{textAlign:'right'}}>{t.quantity}</td>
                    <td style={{textAlign:'right'}}>{fmt(t.price)}</td>
                    <td style={{textAlign:'right',fontSize:'0.8125rem',color:'var(--tl-on-surface-var)'}}>{new Date(t.executed_at).toLocaleDateString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Suggestions panel (inline) ── */}
      {showSuggestions && (
        <div className="tl-trader-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p className="tl-label">Trade Suggestions</p>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {suggestions.filter(s=>s.status==='pending').length > 1 && (
                <>
                  <button className="tl-btn-primary" style={{fontSize:'0.75rem',padding:'5px 12px'}} disabled={resolvingId} onClick={()=>handleBulkResolve('approve')}>Approve All</button>
                  <button className="tl-btn-outline" style={{fontSize:'0.75rem',padding:'5px 12px'}} disabled={resolvingId} onClick={()=>handleBulkResolve('reject')}>Reject All</button>
                </>
              )}
              <button className={`tl-icon-btn ${loadingSugg?'spinning':''}`} onClick={refreshSuggestions} title="Refresh suggestions">
                <RefreshCw size={16}/>
              </button>
            </div>
          </div>
          {loadingSugg ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner"/></div>
           : suggestions.length === 0 ? <p className="tl-muted" style={{textAlign:'center',padding:'1.5rem',fontSize:'0.875rem'}}>No suggestions. Run the trader to generate them.</p>
           : <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              {suggestions.map(s => <SuggestionCard key={s.id} suggestion={s} onResolve={handleResolve} resolving={resolvingId!=null}/>)}
            </div>
          }
        </div>
      )}

      {/* ── Advisor panel ── */}
      {showAdvisor && (
        <div className="tl-trader-section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p className="tl-label">Strategy Advisor</p>
            <button className={`tl-icon-btn ${advisorLoading?'spinning':''}`} onClick={rerunAdvisor} title="Re-run advisor">
              <RefreshCw size={16}/>
            </button>
          </div>
          {advisorLoading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><div className="spinner"/></div>
           : advice ? (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <p style={{fontSize:'0.875rem',lineHeight:1.7}}>{advice.performance_summary}</p>
              {advice.strengths?.length > 0 && (
                <div><p style={{fontSize:'0.75rem',fontWeight:700,color:'var(--tl-green)',marginBottom:6}}>Strengths</p>
                {advice.strengths.map((s,i) => <p key={i} style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)'}}>+ {s}</p>)}</div>
              )}
              {advice.weaknesses?.length > 0 && (
                <div><p style={{fontSize:'0.75rem',fontWeight:700,color:'var(--tl-red)',marginBottom:6}}>Weaknesses</p>
                {advice.weaknesses.map((s,i) => <p key={i} style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)'}}>- {s}</p>)}</div>
              )}
              {advice.recommendations?.length > 0 && (
                <div><p style={{fontSize:'0.75rem',fontWeight:700,color:'var(--tl-primary)',marginBottom:6}}>Recommendations</p>
                {advice.recommendations.map((s,i) => <p key={i} style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)'}}>{i+1}. {s}</p>)}</div>
              )}
              {advice.suggested_strategy && (
                <div style={{background:'var(--tl-surface-low)',borderRadius:8,padding:'1rem'}}>
                  <p style={{fontSize:'0.75rem',fontWeight:700,marginBottom:6}}>Suggested Strategy Update</p>
                  <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)',lineHeight:1.6,fontStyle:'italic'}}>{advice.suggested_strategy}</p>
                </div>
              )}
            </div>
          ) : <p className="tl-muted" style={{textAlign:'center',padding:'1.5rem',fontSize:'0.875rem'}}>No advice available</p>}
        </div>
      )}

      {/* ── Footer Controls ── */}
      <div className="tl-footer-bar">
        <div style={{display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className={`tl-toggle ${trader.require_approval ? '' : 'active'}`}
              onClick={()=>onToggleApproval(trader.id, !trader.require_approval)}/>
            <span style={{fontSize:'0.8125rem',fontWeight:700,color:'var(--tl-on-surface-var)'}}>
              Auto-approve trades ({trader.require_approval ? 'OFF' : 'ON'})
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--tl-on-surface-var)'}}>
            <Clock size={14}/>
            <span style={{fontSize:'0.8125rem'}}>
              Schedule: <select value={trader.schedule_interval} onChange={e=>onSchedule(trader.id,e.target.value)}
                style={{background:'transparent',border:'none',color:'var(--tl-on-surface)',fontWeight:700,fontSize:'0.8125rem',cursor:'pointer',fontFamily:'inherit'}}>
                {INTERVALS.map(iv => <option key={iv} value={iv}>{INTERVAL_LABELS[iv]}</option>)}
              </select>
            </span>
            {trader.schedule_active && <span style={{fontSize:'10px',fontWeight:700,color:'var(--tl-green)'}}>● Active</span>}
          </div>
          {trader.last_run_at && (
            <span style={{fontSize:'0.8125rem',color:'var(--tl-on-surface-var)'}}>
              Last run: <b>{new Date(trader.last_run_at).toLocaleString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</b>
            </span>
          )}
        </div>
        <div style={{display:'flex',gap:'0.75rem'}}>
          <button className="tl-btn-danger" onClick={()=>{if(confirm(`Delete trader "${trader.name}"?`)) onDelete(trader.id)}}>Delete</button>
          <button className="tl-btn-primary" onClick={()=>onRun(trader.id)} disabled={running===trader.id}>
            {running===trader.id ? <span style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> : <><Play size={16}/> Run Strategy</>}
          </button>
        </div>
      </div>

      {/* CSV Modal */}
      <Modal open={showCsvModal} onClose={()=>setShowCsvModal(false)}>
        <h3 style={{fontWeight:800,fontSize:'1.25rem',marginBottom:'1.5rem',color:'var(--tl-on-surface)'}}>Import Portfolio (CSV)</h3>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)'}}>Paste CSV with columns: <b>symbol,quantity</b></p>
          <textarea className="input-field input-area" value={csvContent} onChange={e=>setCsvContent(e.target.value)}
            placeholder={"symbol,quantity\nAAPL,10\nGOOG,5"} style={{minHeight:120,fontFamily:'monospace',fontSize:'0.875rem'}}/>
          <div style={{display:'flex',gap:8}}>
            <button className="tl-btn-outline" style={{flex:1}} onClick={()=>setShowCsvModal(false)}>Cancel</button>
            <button className="tl-btn-primary" style={{flex:2}} onClick={handleCsvImport} disabled={csvLoading}>
              {csvLoading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Trading Page
   ═══════════════════════════════════════════════════ */
export default function Trading() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [traders, setTraders] = useState([]);
  const [running, setRunning] = useState(null);
  const [showNewTrader, setShowNewTrader] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [newTrader, setNewTrader] = useState({name:'',identity:'',strategy:'',model:'gemini-2.0-flash',require_approval:false});
  const [userAccounts, setUserAccounts] = useState([]);
  const [transferData, setTransferData] = useState({source_account_id:'',amount:''});
  const [transferLoading, setTransferLoading] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const a = await getTradingAccounts();
      setAccounts(a);
      if (a.length > 0 && !selectedAcc) setSelectedAcc(a[0].id);
    } catch(_){}
  }, [selectedAcc]);

  const loadTraders = useCallback(async () => {
    if (!selectedAcc) return;
    try { setTraders(await getTraders(selectedAcc)); } catch(_){}
  }, [selectedAcc]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTraders(); }, [loadTraders]);

  const handleCreateAccount = async () => {
    try { await createTradingAccount('My Trading Account',10000); await loadAccounts(); } catch(e) { alert(e.message); }
  };
  const handleReset = async (id) => {
    if (!confirm('Reset this account? All holdings and transactions will be cleared.')) return;
    try { await updateTradingAccount(id,{reset:true}); await loadAccounts(); await loadTraders(); } catch(e) { alert(e.message); }
  };
  const handleCreateTrader = async () => {
    if (!newTrader.name.trim() || !newTrader.strategy.trim()) return alert('Name and strategy are required');
    try {
      await createTrader({...newTrader, account_id:selectedAcc});
      setShowNewTrader(false);
      setNewTrader({name:'',identity:'',strategy:'',model:'gemini-2.0-flash',require_approval:false});
      await loadTraders();
    } catch(e) { alert(e.message); }
  };
  const handleRun = async (tid) => {
    setRunning(tid); setRunResult(null);
    try { const r = await runTrader(tid); setRunResult(r); await loadAccounts(); await loadTraders(); }
    catch(e) { alert(`Run failed: ${e.message}`); }
    finally { setRunning(null); }
  };
  const handleDelete = async (tid) => {
    try { await deleteTrader(tid); await loadTraders(); await loadAccounts(); } catch(e) { alert(e.message); }
  };
  const handleSchedule = async (tid, iv) => {
    try { await setSchedule(tid, iv, iv !== 'manual'); await loadTraders(); } catch(e) { alert(e.message); }
  };
  const handleToggleApproval = async (tid, val) => {
    try { await updateTrader(tid, {require_approval:val}); await loadTraders(); } catch(e) { alert(e.message); }
  };
  const handleOpenTransfer = async () => {
    setShowTransfer(true);
    try { setUserAccounts(await getUserAccounts()); } catch(e) { console.error(e); }
  };
  const handleTransfer = async () => {
    if (!transferData.source_account_id || !transferData.amount) return alert('Select an account and enter an amount');
    setTransferLoading(true);
    try {
      await transferFunds(parseInt(transferData.source_account_id), selectedAcc, parseFloat(transferData.amount));
      setShowTransfer(false); setTransferData({source_account_id:'',amount:''}); await loadAccounts();
    } catch(e) { alert(e.message); }
    finally { setTransferLoading(false); }
  };
  const handleRefresh = async () => { await loadAccounts(); await loadTraders(); };

  return (
    <div className="trading-light-theme" style={{minHeight:'100vh',padding:'0 2.5rem 3rem',animation:'fadeIn 0.3s ease'}}>
      {/* ── Top Bar ── */}
      <header style={{position:'sticky',top:0,zIndex:40,background:'rgba(248,249,250,0.8)',backdropFilter:'blur(12px)',padding:'1.5rem 0',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
        <h2 style={{fontSize:'1.5rem',fontWeight:800,letterSpacing:'-0.03em'}}>
          BudgetQuest <span style={{fontWeight:400,color:'var(--tl-on-surface-var)'}}>Lab</span>
        </h2>
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
          {selectedAcc && <button className="tl-btn-outline" onClick={handleOpenTransfer}><ArrowRightLeft size={14}/> Transfer Funds</button>}
          {accounts.length === 0 && <button className="tl-btn-primary" onClick={handleCreateAccount}><Plus size={14}/> New Account</button>}
        </div>
      </header>

      {/* ── Accounts Grid ── */}
      {accounts.length > 0 ? (
        <section style={{marginBottom:'3rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'1.5rem'}}>
            <h3 style={{fontSize:'1.125rem',fontWeight:700,letterSpacing:'-0.01em'}}>Active Portfolios</h3>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1.5rem'}}>
            {accounts.map(acc => {
              const pnl = acc.pnl ?? 0;
              const isSelected = selectedAcc === acc.id;
              return (
                <div key={acc.id}
                  className={`tl-card tl-account-card ${isSelected ? 'tl-card-selected' : ''}`}
                  onClick={()=>setSelectedAcc(acc.id)}>
                  {isSelected && <span className="tl-selected-tag">Selected</span>}
                  <p className="tl-label" style={{marginBottom:4}}>{acc.name}</p>
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:16}}>
                    <span className="tl-value-lg">{fmt(acc.total_value)}</span>
                    <span className={`tl-pnl-badge ${pnl >= 0 ? 'tl-pnl-positive' : 'tl-pnl-negative'}`}>
                      {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                    </span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',paddingTop:'1rem',borderTop:'1px solid rgba(201,196,215,0.1)'}}>
                    <div>
                      <p className="tl-label">Cash Balance</p>
                      <p style={{fontSize:'0.875rem',fontWeight:600}}>{fmt(acc.cash_balance)}</p>
                    </div>
                    <div>
                      <p className="tl-label">Total Traders</p>
                      <p style={{fontSize:'0.875rem',fontWeight:600}}>{acc.trader_count} Active</p>
                    </div>
                  </div>
                  <button className="tl-btn-ghost" style={{marginTop:10,fontSize:'0.75rem',padding:'4px 8px',gap:4}}
                    onClick={e=>{e.stopPropagation();handleReset(acc.id);}}>
                    <RefreshCw size={11}/> Reset
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section style={{marginBottom:'3rem'}}>
          <div className="tl-card" style={{padding:'3rem',textAlign:'center'}}>
            <div style={{width:52,height:52,background:'var(--tl-surface-high)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
              <TrendingUp size={24} color="var(--tl-on-surface-var)"/>
            </div>
            <p style={{fontWeight:600,marginBottom:6}}>No trading accounts yet</p>
            <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)',marginBottom:16}}>Create an account to start trading with AI agents</p>
            <button className="tl-btn-primary" onClick={handleCreateAccount}><Plus size={14}/> Create Account</button>
          </div>
        </section>
      )}

      {/* ── Run result toast ── */}
      {runResult && (
        <div style={{background: runResult.errors?.length > 0 ? 'var(--tl-red-bg)' : 'var(--tl-green-bg)', borderRadius:12, padding:'1.25rem 1.5rem', marginBottom:'1.5rem', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div style={{flex:1,minWidth:0,marginRight:'1rem'}}>
            <p style={{fontWeight:700,fontSize:'0.9375rem',marginBottom:6}}>
              {runResult.trader_name} — {runResult.session === 'trade' ? 'Trade' : 'Rebalance'} Session Complete
            </p>
            <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)',lineHeight:1.6}}>{runResult.summary || 'Session complete — check transaction history for details.'}</p>
            {runResult.errors?.map((e,i)=> <p key={i} style={{fontSize:'0.875rem',color:'var(--tl-red)',marginTop:4}}>⚠ {e}</p>)}
          </div>
          <button className="tl-btn-ghost" style={{flexShrink:0}} onClick={()=>setRunResult(null)}><X size={16}/></button>
        </div>
      )}

      {/* ── Traders Section ── */}
      {selectedAcc && (
        <section>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
            <h3 style={{fontSize:'1.125rem',fontWeight:700,letterSpacing:'-0.01em'}}>AI Strategy Control</h3>
            <button className="tl-btn-primary" style={{fontSize:'0.875rem',padding:'0.625rem 1.25rem'}} onClick={()=>setShowNewTrader(true)}>
              <Plus size={14}/> Add Trader
            </button>
          </div>
          {traders.length === 0 ? (
            <div className="tl-card" style={{padding:'3rem',textAlign:'center'}}>
              <div style={{width:52,height:52,background:'rgba(84,53,206,0.05)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
                <Bot size={24} color="#5435ce"/>
              </div>
              <p style={{fontWeight:600,marginBottom:6}}>No traders yet</p>
              <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)',marginBottom:16}}>Add your first AI trader with a custom strategy</p>
              <button className="tl-btn-primary" onClick={()=>setShowNewTrader(true)}><Plus size={14}/> Add Trader</button>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
              {traders.map(t => (
                <TraderCard key={t.id} trader={t} running={running}
                  onRun={handleRun} onDelete={handleDelete} onSchedule={handleSchedule}
                  onToggleApproval={handleToggleApproval} onRefresh={handleRefresh}/>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── New Trader Modal ── */}
      <Modal open={showNewTrader} onClose={()=>setShowNewTrader(false)}>
        <h3 style={{fontWeight:800,fontSize:'1.25rem',marginBottom:'1.5rem',color:'var(--tl-on-surface)'}}>Add AI Trader</h3>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div className="form-group">
            <label style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--tl-on-surface-var)'}}>Trader Name</label>
            <input className="input-field" value={newTrader.name} onChange={e=>setNewTrader(p=>({...p,name:e.target.value}))} placeholder="e.g. Warren Jr."/>
          </div>
          <div className="form-group">
            <label style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--tl-on-surface-var)'}}>Identity / Persona (optional)</label>
            <input className="input-field" value={newTrader.identity} onChange={e=>setNewTrader(p=>({...p,identity:e.target.value}))} placeholder="e.g. A cautious value investor"/>
          </div>
          <div className="form-group">
            <label style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--tl-on-surface-var)'}}>Trading Strategy</label>
            <textarea className="input-field input-area" value={newTrader.strategy} onChange={e=>setNewTrader(p=>({...p,strategy:e.target.value}))}
              placeholder="Describe the investment strategy..."/>
          </div>
          <div className="form-group">
            <label style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--tl-on-surface-var)'}}>AI Model</label>
            <select className="input-field" value={newTrader.model} onChange={e=>setNewTrader(p=>({...p,model:e.target.value}))}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className={`tl-toggle ${newTrader.require_approval ? '' : 'active'}`}
              onClick={()=>setNewTrader(p=>({...p,require_approval:!p.require_approval}))}/>
            <div>
              <p style={{fontSize:'0.875rem',fontWeight:600,color:'var(--tl-on-surface)'}}>Require human approval</p>
              <p style={{fontSize:'0.8125rem',color:'var(--tl-on-surface-var)'}}>Trades become suggestions you approve/reject</p>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <button className="tl-btn-outline" style={{flex:1}} onClick={()=>setShowNewTrader(false)}>Cancel</button>
            <button className="tl-btn-primary" style={{flex:2}} onClick={handleCreateTrader}>Add Trader</button>
          </div>
        </div>
      </Modal>

      {/* ── Transfer Modal ── */}
      <Modal open={showTransfer} onClose={()=>setShowTransfer(false)}>
        <h3 style={{fontWeight:800,fontSize:'1.25rem',marginBottom:'1.5rem',color:'var(--tl-on-surface)'}}>Transfer Funds</h3>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <p style={{fontSize:'0.875rem',color:'var(--tl-on-surface-var)'}}>Transfer funds from your bank account to <b>{accounts.find(a=>a.id===selectedAcc)?.name}</b></p>
          <div className="form-group">
            <label style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--tl-on-surface-var)'}}>Source Account</label>
            <select className="input-field" value={transferData.source_account_id} onChange={e=>setTransferData(p=>({...p,source_account_id:e.target.value}))}>
              <option value="">Select account...</option>
              {userAccounts.map(a => <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance)} ({a.type})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--tl-on-surface-var)'}}>Amount (USD)</label>
            <input className="input-field" type="number" value={transferData.amount} onChange={e=>setTransferData(p=>({...p,amount:e.target.value}))} placeholder="1000"/>
          </div>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button className="tl-btn-outline" style={{flex:1}} onClick={()=>setShowTransfer(false)}>Cancel</button>
            <button className="tl-btn-primary" style={{flex:2}} onClick={handleTransfer} disabled={transferLoading}>
              {transferLoading ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
