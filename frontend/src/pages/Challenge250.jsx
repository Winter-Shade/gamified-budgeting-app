import React, { useEffect, useState, useCallback } from 'react';
import { getChallenge250, startChallenge250, checkStep250, uncheckStep250, resetChallenge250 } from '../api/api';
import { getAccounts } from '../api/api';
import { Trophy, RotateCcw, X, Zap } from 'lucide-react';

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const TOTAL = 31375;

export default function Challenge250() {
  const [status, setStatus] = useState(null);   // null = not started
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);       // step toggle in flight
  const [showSetup, setShowSetup] = useState(false);
  const [setupMode, setSetupMode] = useState('manual');
  const [setupAccount, setSetupAccount] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, accs] = await Promise.all([getChallenge250(), getAccounts()]);
      setStatus(s);
      setAccounts(accs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    setError('');
    try {
      const s = await startChallenge250(setupMode, setupMode === 'transfer' ? parseInt(setupAccount) : null);
      setStatus(s);
      setShowSetup(false);
    } catch (e) { setError(e.message); }
  };

  const handleReset = async () => {
    if (!confirm('Reset all progress? This cannot be undone.')) return;
    const s = await resetChallenge250();
    setStatus(s);
  };

  const toggleStep = async (step) => {
    if (busy) return;
    setBusy(true);
    try {
      const checked = status.checked_steps.includes(step);
      const s = checked ? await uncheckStep250(step) : await checkStep250(step);
      setStatus(s);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  const checkedSet = new Set(status?.checked_steps ?? []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em' }}>1–250 Savings Challenge</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>
            Check off numbers 1–250. Each number = ₹ that amount. Total: {fmt(TOTAL)}
          </p>
        </div>
        {status && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-ghost" style={{ fontSize: '0.75rem', gap: 5, color: 'var(--error)' }} onClick={handleReset}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        )}
      </div>

      {/* Not started */}
      {!status && !showSetup && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💰</div>
          <p style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: 6 }}>Start the 1-250 Challenge</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: '1.5rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
            Save money by checking off numbers 1 to 250. Cross off ₹1 one day, ₹73 another — in any order, at your own pace. Complete all 250 and you've saved {fmt(TOTAL)}.
          </p>
          <button className="btn-primary" onClick={() => setShowSetup(true)}>Get Started</button>
        </div>
      )}

      {/* Setup form */}
      {showSetup && (
        <div className="card" style={{ padding: '1.5rem', maxWidth: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 800, fontSize: '1rem' }}>Choose Mode</p>
            <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setShowSetup(false)}><X size={15} /></button>
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { v: 'manual', label: 'Manual', desc: 'Self-track — just tick off the numbers', icon: '✏️' },
              { v: 'transfer', label: 'Auto Transfer', desc: 'Deduct ₹N from your account when you check step N', icon: '🏦' },
            ].map(opt => (
              <button key={opt.v} onClick={() => setSetupMode(opt.v)} style={{
                border: `2px solid ${setupMode === opt.v ? 'var(--primary)' : 'var(--outline)'}`,
                borderRadius: 12, padding: '0.875rem', background: setupMode === opt.v ? 'rgba(157,133,255,0.1)' : 'transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '1.25rem', marginBottom: 4 }}>{opt.icon}</div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--on-surface)' }}>{opt.label}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>{opt.desc}</p>
              </button>
            ))}
          </div>
          {setupMode === 'transfer' && (
            <label className="form-label" style={{ marginBottom: '1rem', display: 'block' }}>
              Linked Account
              <select className="form-input" value={setupAccount} onChange={e => setSetupAccount(e.target.value)}>
                <option value="">— select —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>)}
              </select>
            </label>
          )}
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleStart}>Start Challenge</button>
        </div>
      )}

      {/* Active challenge */}
      {status && (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
            {[
              { label: 'Steps Done', value: `${status.steps_done} / 250` },
              { label: 'Total Saved', value: fmt(status.total_saved) },
              { label: 'Remaining', value: fmt(status.target_total - status.total_saved) },
              { label: 'Progress', value: `${status.progress_pct}%` },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ padding: '0.875rem' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                <p style={{ fontWeight: 800, fontSize: '1rem' }} className="gradient-text">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                Mode: <strong style={{ color: 'var(--primary-dim)' }}>{status.mode === 'transfer' ? 'Auto Transfer' : 'Manual'}</strong>
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dim)' }}>{status.progress_pct}%</span>
            </div>
            <div className="progress-track" style={{ height: 8, borderRadius: 999 }}>
              <div className="progress-fill progress-primary" style={{ width: `${status.progress_pct}%`, borderRadius: 999 }} />
            </div>
          </div>

          {/* Completed banner */}
          {status.completed && (
            <div style={{ background: 'linear-gradient(135deg, rgba(16,217,160,0.15), rgba(16,217,160,0.05))', border: '1px solid rgba(16,217,160,0.3)', borderRadius: 14, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Trophy size={28} color="var(--tertiary)" />
              <div>
                <p style={{ fontWeight: 800, color: 'var(--tertiary)', fontSize: '1rem' }}>Challenge Complete! 🎉</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>You saved {fmt(TOTAL)} — incredible discipline!</p>
              </div>
            </div>
          )}

          {/* The 250 grid */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <p className="section-title" style={{ marginBottom: '1rem' }}>Tap to check off a number</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
              {Array.from({ length: 250 }, (_, i) => i + 1).map(n => {
                const checked = checkedSet.has(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleStep(n)}
                    disabled={busy}
                    title={`₹${n}`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 6,
                      border: checked ? '2px solid var(--primary)' : '1px solid var(--outline)',
                      background: checked ? 'rgba(157,133,255,0.2)' : 'transparent',
                      color: checked ? 'var(--primary-dim)' : 'var(--on-surface-variant)',
                      fontWeight: checked ? 800 : 400,
                      fontSize: n > 99 ? '0.5rem' : n > 9 ? '0.6rem' : '0.65rem',
                      cursor: busy ? 'wait' : 'pointer',
                      transition: 'all 0.12s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
