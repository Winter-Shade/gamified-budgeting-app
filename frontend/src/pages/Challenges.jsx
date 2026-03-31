import React, { useEffect, useState, useCallback } from 'react';
import { getChallenges, getMyChallenges, joinChallenge, checkCompletions, getEcoTemplates, createChallenge } from '../api/api';
import { useWallet } from '../context/WalletContext';
import { Flame, Target, Ban, Zap, CheckCircle2, XCircle, Clock, Plus, Leaf } from 'lucide-react';

const ICONS = { streak: Flame, budget_limit: Target, no_spend: Ban };
const TYPE_LABELS = { streak: 'Streak', budget_limit: 'Budget Limit', no_spend: 'No Spend' };
const STATUS_STYLE = {
  active:    { color:'var(--primary)',   bg:'rgba(157,133,255,0.1)',  label:'Active'    },
  completed: { color:'var(--tertiary)',  bg:'rgba(16,217,160,0.1)',   label:'Completed' },
  failed:    { color:'var(--error)',     bg:'rgba(248,113,113,0.1)',  label:'Failed'    },
};

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function daysLeft(endDate) {
  const d = Math.ceil((new Date(endDate) - new Date()) / 86400000);
  return d > 0 ? `${d}d left` : 'Ended';
}

function ProgressRing({ pct, size=60, stroke=5, color='var(--primary)' }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, pct) / 100) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.7s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:'0.7rem', fontWeight:800, color }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

function MyChallengeCard({ ch }) {
  const Icon = ICONS[ch.type] ?? Zap;
  const ss   = STATUS_STYLE[ch.my_status] ?? STATUS_STYLE.active;
  const pct  = ch.progress_pct ?? 0;

  return (
    <div style={{
      background:'var(--surface-container)',
      border:`1px solid ${ch.my_status === 'completed' ? 'rgba(16,217,160,0.25)' : ch.my_status === 'failed' ? 'rgba(248,113,113,0.2)' : 'var(--outline)'}`,
      borderRadius:16,
      padding:'1.125rem',
      display:'flex', gap:'1rem', alignItems:'center',
      transition:'border-color 0.2s',
    }}>
      <ProgressRing pct={pct} color={ss.color} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
          <Icon size={13} color={ss.color} />
          <span style={{ fontWeight:700, fontSize:'0.875rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.title}</span>
        </div>
        <p style={{ fontSize:'0.7rem', color:'var(--on-surface-variant)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {ch.description || TYPE_LABELS[ch.type]}
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span className="badge badge-muted" style={{ fontSize:'0.6rem' }}>{daysLeft(ch.end_date)}</span>
          <span className="badge" style={{ fontSize:'0.6rem', background:ss.bg, color:ss.color, border:'none' }}>{ss.label}</span>
          <span style={{ marginLeft:'auto', fontSize:'0.7rem', fontWeight:700, color:'var(--secondary)' }}>⚡ {ch.reward_xp} XP + {ch.reward_gold ?? Math.max(1, Math.floor(ch.reward_xp/10))}G</span>
        </div>
      </div>
    </div>
  );
}

function AvailableCard({ ch, onJoin, joining }) {
  const Icon = ICONS[ch.type] ?? Zap;
  return (
    <div style={{
      background:'var(--surface-container)',
      border:`1px solid ${ch.joined ? 'rgba(157,133,255,0.2)' : 'var(--outline)'}`,
      borderRadius:16,
      padding:'1.125rem',
      display:'flex', flexDirection:'column', gap:'0.75rem',
      transition:'all 0.2s',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem' }}>
        <div style={{ width:38, height:38, background:'rgba(157,133,255,0.1)', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={18} color="var(--primary)" />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:2 }}>{ch.title}</p>
          <p style={{ fontSize:'0.75rem', color:'var(--on-surface-variant)', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
            {ch.description || `Complete this ${TYPE_LABELS[ch.type]} challenge`}
          </p>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <span className="badge badge-primary" style={{ fontSize:'0.6rem' }}>{TYPE_LABELS[ch.type]}</span>
        <span className="badge badge-muted" style={{ fontSize:'0.6rem' }}>{daysLeft(ch.end_date)}</span>
        <span style={{ marginLeft:'auto', fontWeight:700, fontSize:'0.75rem', color:'var(--secondary)' }}>⚡ {ch.reward_xp} XP</span>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {ch.joined ? (
          <div style={{ flex:1, textAlign:'center', padding:'7px', background:'rgba(157,133,255,0.08)', borderRadius:10, fontSize:'0.75rem', fontWeight:700, color:'var(--primary)' }}>
            ✓ Joined
          </div>
        ) : (
          <button className="btn-primary" style={{ flex:1, fontSize:'0.75rem', padding:'7px' }}
            onClick={() => onJoin(ch.id)} disabled={joining === ch.id}>
            {joining === ch.id ? <span className="animate-spin" style={{ display:'inline-block', width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%' }} /> : 'Join Challenge'}
          </button>
        )}
      </div>
    </div>
  );
}

function EcoCard({ tmpl, onStart, starting }) {
  return (
    <div style={{
      background: 'rgba(16,217,160,0.05)',
      border: '1px solid rgba(16,217,160,0.2)',
      borderRadius: 16, padding: '1.125rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{tmpl.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2 }}>{tmpl.title}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {tmpl.description}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--tertiary)', background: 'rgba(16,217,160,0.1)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>🌿 {tmpl.impact}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{tmpl.duration_days} days · ⚡ {tmpl.reward_xp} XP</span>
        <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 14px', background: 'rgba(16,217,160,0.2)', color: 'var(--tertiary)', border: '1px solid rgba(16,217,160,0.3)' }}
          onClick={() => onStart(tmpl)} disabled={starting === tmpl.id}>
          {starting === tmpl.id ? '…' : 'Start Challenge'}
        </button>
      </div>
    </div>
  );
}

export default function Challenges() {
  const { refresh: refreshWallet } = useWallet();
  const [mine, setMine]       = useState([]);
  const [avail, setAvail]     = useState([]);
  const [ecoTemplates, setEcoTemplates] = useState([]);
  const [joining, setJoining] = useState(null);
  const [startingEco, setStartingEco] = useState(null);
  const [tab, setTab]         = useState('challenges'); // 'challenges' | 'eco'
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [my, all, eco] = await Promise.all([getMyChallenges(), getChallenges(), getEcoTemplates()]);
      setMine(my);
      setAvail(all.filter(c => !c.joined));
      setEcoTemplates(eco);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  // Auto-check completions on mount
  useEffect(() => {
    checkCompletions().catch(() => {});
    load();
  }, [load]);

  const handleJoin = async (id) => {
    setJoining(id);
    try {
      await joinChallenge(id);
      await load();
      refreshWallet();
    } catch(e) { alert(e.message); }
    finally { setJoining(null); }
  };

  const handleStartEco = async (tmpl) => {
    setStartingEco(tmpl.id);
    try {
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + tmpl.duration_days);
      const fmt = d => d.toISOString().slice(0, 10);
      const ch = await createChallenge({
        title: tmpl.title,
        description: tmpl.description,
        type: tmpl.type,
        target_value: tmpl.target_value,
        start_date: fmt(today),
        end_date: fmt(end),
        reward_xp: tmpl.reward_xp,
      });
      await joinChallenge(ch.id);
      await load();
      refreshWallet();
      setTab('challenges');
    } catch(e) { alert(e.message); }
    finally { setStartingEco(null); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  const active    = mine.filter(c => c.my_status === 'active');
  const completed = mine.filter(c => c.my_status === 'completed');
  const failed    = mine.filter(c => c.my_status === 'failed');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em' }}>Challenges</h2>
          <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)', marginTop:2 }}>
            Complete goals to earn XP and Gold
          </p>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-container)', borderRadius: 12, padding: 4 }}>
          {[
            { key: 'challenges', label: 'Challenges' },
            { key: 'eco', label: '🌿 Eco' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8125rem', fontFamily: 'inherit',
              background: tab === t.key ? 'var(--primary)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--on-surface-variant)',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Eco Templates tab */}
      {tab === 'eco' && (
        <section>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: '1rem' }}>
            Sustainability-themed challenges. Start one and it auto-joins.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {ecoTemplates.map(t => <EcoCard key={t.id} tmpl={t} onStart={handleStartEco} starting={startingEco} />)}
          </div>
        </section>
      )}

      {tab === 'challenges' && <>
      {/* My Active Challenges */}
      {active.length > 0 && (
        <section>
          <div className="section-header">
            <span className="section-title">My Active Challenges</span>
            <span className="badge badge-primary">{active.length}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'0.75rem' }}>
            {active.map(ch => <MyChallengeCard key={ch.id} ch={ch} />)}
          </div>
        </section>
      )}

      {/* Available Challenges */}
      <section>
        <div className="section-header">
          <span className="section-title">Available Challenges</span>
          {avail.length > 0 && <span className="badge badge-muted">{avail.length} open</span>}
        </div>
        {avail.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Zap size={22} color="var(--on-surface-variant)" /></div>
              <p style={{ fontWeight:600, marginBottom:4 }}>No new challenges available</p>
              <p style={{ fontSize:'0.8125rem' }}>Check back later for new challenges</p>
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0.75rem' }}>
            {avail.map(ch => <AvailableCard key={ch.id} ch={ch} onJoin={handleJoin} joining={joining} />)}
          </div>
        )}
      </section>

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div className="section-header">
            <span className="section-title">Completed</span>
            <span className="badge badge-tertiary">{completed.length}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'0.75rem' }}>
            {completed.map(ch => <MyChallengeCard key={ch.id} ch={ch} />)}
          </div>
        </section>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <section>
          <div className="section-header">
            <span className="section-title">Failed</span>
            <span className="badge badge-error">{failed.length}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'0.75rem' }}>
            {failed.map(ch => <MyChallengeCard key={ch.id} ch={ch} />)}
          </div>
        </section>
      )}
      </>}
    </div>
  );
}
