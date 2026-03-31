import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../api/api';
import { Trophy, Zap, Coins, Crown } from 'lucide-react';

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_BG = [
  'linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05))',
  'linear-gradient(135deg,rgba(192,192,192,0.12),rgba(192,192,192,0.04))',
  'linear-gradient(135deg,rgba(205,127,50,0.12),rgba(205,127,50,0.04))',
];

function Avatar({ name, size = 40, rank }) {
  const colors = ['#4f3bdb','#9D85FF','#10d9a0','#fbbf24','#f97316','#fb7185'];
  const bg = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${bg}, ${bg}88)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#fff', flexShrink: 0,
      border: rank != null && rank < 3 ? `2px solid ${MEDAL[rank]}` : '2px solid transparent',
      boxShadow: rank === 0 ? `0 0 16px ${MEDAL[0]}55` : 'none',
    }}>
      {(name ?? '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then(setLeaders).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  if (leaders.length === 0) return (
    <div className="card"><div className="empty-state">
      <div className="empty-icon"><Trophy size={22} color="var(--on-surface-variant)" /></div>
      <p style={{ fontWeight:600 }}>No players on the leaderboard yet</p>
    </div></div>
  );

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeights = top3[1] ? [140, 180, 110] : [180];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2rem', animation:'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:56, height:56, background:'linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,215,0,0.05))', borderRadius:16, marginBottom:12, border:'1px solid rgba(255,215,0,0.2)' }}>
          <Trophy size={26} color="#FFD700" />
        </div>
        <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-0.02em', marginBottom:4 }}>Leaderboard</h2>
        <p style={{ fontSize:'0.8125rem', color:'var(--on-surface-variant)' }}>Top savers ranked by XP earned</p>
      </div>

      {/* Podium */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap:'0.75rem', padding:'0 1rem' }}>
        {podiumOrder.map((u, i) => {
          const isFirst = u.rank === 1;
          const rankIdx = u.rank - 1;
          const height = top3[1] ? [140, 180, 110][i] : 180;
          return (
            <div key={u.user_id} style={{
              flex: isFirst ? '0 0 200px' : '0 0 160px',
              background: isFirst ? RANK_BG[0] : RANK_BG[rankIdx],
              border: `1px solid ${MEDAL[rankIdx]}33`,
              borderRadius:'16px 16px 0 0',
              height, padding:'1rem',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:6,
              position:'relative',
            }}>
              {isFirst && (
                <Crown size={20} color="#FFD700" style={{ position:'absolute', top:-28, filter:'drop-shadow(0 0 8px #FFD70088)' }} />
              )}
              <Avatar name={u.username} size={isFirst ? 52 : 44} rank={rankIdx} />
              <p style={{ fontWeight:800, fontSize: isFirst ? '0.9375rem' : '0.8125rem', textAlign:'center', color:'var(--on-surface)' }}>
                {u.username}
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <Zap size={11} color={MEDAL[rankIdx]} fill={MEDAL[rankIdx]} />
                <span style={{ fontSize:'0.75rem', fontWeight:700, color:MEDAL[rankIdx] }}>{u.xp} XP</span>
              </div>
              <div style={{
                position:'absolute', bottom:-14, width:28, height:28, borderRadius:'50%',
                background:`${MEDAL[rankIdx]}22`, border:`2px solid ${MEDAL[rankIdx]}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'0.7rem', fontWeight:800, color:MEDAL[rankIdx],
              }}>
                {u.rank}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rankings table */}
      <div style={{ background:'var(--surface-container)', border:'1px solid var(--outline)', borderRadius:16, overflow:'hidden', marginTop:'0.5rem' }}>
        {/* header */}
        <div style={{ display:'grid', gridTemplateColumns:'48px 1fr 80px 80px 60px', padding:'0.625rem 1.25rem', borderBottom:'1px solid var(--outline)' }}>
          {['#','Player','XP','Gold','Lvl'].map(h => (
            <span key={h} style={{ fontSize:'0.6rem', fontWeight:700, color:'var(--on-surface-variant)', textTransform:'uppercase', letterSpacing:'0.08em', textAlign: h==='#' ? 'center' : h==='Player' ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>

        {leaders.map((u, i) => (
          <div key={u.user_id} style={{
            display:'grid', gridTemplateColumns:'48px 1fr 80px 80px 60px',
            padding:'0.75rem 1.25rem', alignItems:'center',
            borderBottom: i < leaders.length - 1 ? '1px solid var(--outline)' : 'none',
            background: u.rank <= 3 ? `${MEDAL[u.rank-1]}08` : 'transparent',
            transition:'background 0.15s',
          }}>
            <span style={{
              textAlign:'center', fontWeight:800, fontSize:'0.8125rem',
              color: u.rank <= 3 ? MEDAL[u.rank-1] : 'var(--on-surface-variant)',
            }}>
              {u.rank <= 3 ? ['🥇','🥈','🥉'][u.rank-1] : u.rank}
            </span>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Avatar name={u.username} size={32} rank={u.rank <= 3 ? u.rank-1 : null} />
              <span style={{ fontWeight:600, fontSize:'0.875rem' }}>{u.username}</span>
            </div>

            <div style={{ textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
              <Zap size={11} color="var(--primary)" fill="var(--primary)" />
              <span style={{ fontWeight:700, fontSize:'0.8125rem', color:'var(--primary-dim)' }}>{u.xp}</span>
            </div>

            <div style={{ textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
              <Coins size={11} color="var(--secondary)" />
              <span style={{ fontWeight:600, fontSize:'0.8125rem', color:'var(--secondary)' }}>{u.gold}</span>
            </div>

            <div style={{ textAlign:'right' }}>
              <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'2px 8px', borderRadius:999, background:'rgba(157,133,255,0.12)', color:'var(--primary-dim)' }}>
                {u.level}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
