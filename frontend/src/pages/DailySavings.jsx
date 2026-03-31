import React, { useEffect, useState, useCallback } from 'react';
import {
  getDailySavings, startDailySavings, dailySavingsCheckIn,
  dailySavingsGrace, stopDailySavings,
} from '../api/api';
import { Flame, CheckCircle2, Shield, StopCircle, X, Plus } from 'lucide-react';

function fmt(n) { return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export default function DailySavings() {
  const [challenge, setChallenge] = useState(null);  // null = not started / loaded
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    try {
      const data = await getDailySavings();
      setChallenge(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a positive daily amount'); return; }
    setSaving(true); setError('');
    try {
      const data = await startDailySavings(amt);
      setChallenge(data);
      setShowStart(false);
      setAmount('');
      flash('Challenge started! Check in daily to build your streak.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleCheckIn = async () => {
    setSaving(true);
    try {
      const data = await dailySavingsCheckIn();
      setChallenge(data);
      flash(`Day ${data.current_streak} ✓ Streak going strong!`);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleGrace = async () => {
    if (!confirm("Use your grace day? This covers yesterday's miss — you only get one per challenge.")) return;
    try {
      const data = await dailySavingsGrace();
      setChallenge(data);
      flash("Grace day used. Streak saved!");
    } catch (e) { alert(e.message); }
  };

  const handleStop = async () => {
    if (!confirm("End this challenge? Your streak will be stopped.")) return;
    try {
      const data = await stopDailySavings();
      setChallenge(data);
    } catch (e) { alert(e.message); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  const isActive = challenge?.is_active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'var(--surface-container-high)', border: '1px solid var(--tertiary)',
          borderRadius: 12, padding: '0.75rem 1.25rem',
          fontSize: '0.875rem', fontWeight: 600, color: 'var(--tertiary)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Daily Savings Challenge</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>
            Save a fixed amount every day. Build your streak. One grace day allowed.
          </p>
        </div>
        {!isActive && !showStart && (
          <button className="btn-primary" onClick={() => setShowStart(true)} style={{ gap: 6 }}>
            <Plus size={15} /> New Challenge
          </button>
        )}
      </div>

      {/* Start form */}
      {showStart && (
        <div className="card" style={{ padding: '1.5rem', maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 800 }}>Set Daily Amount</p>
            <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setShowStart(false)}><X size={15} /></button>
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>}
          <label className="form-label">Amount to save each day (₹)
            <input className="form-input" type="number" min="1" autoFocus
              value={amount} onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="e.g. 50" />
          </label>
          <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 6, marginBottom: '1rem' }}>
            Suggested: ₹50/day = ₹1,500/month · ₹100/day = ₹3,000/month
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowStart(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleStart} disabled={saving}>
              {saving ? 'Starting…' : 'Start'}
            </button>
          </div>
        </div>
      )}

      {/* No challenge at all */}
      {!challenge && !showStart && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Flame size={40} style={{ margin: '0 auto 1rem', color: 'var(--on-surface-variant)', display: 'block' }} />
          <p style={{ fontWeight: 700, marginBottom: 6 }}>No active challenge</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', marginBottom: '1.25rem' }}>
            Pick a daily amount and check in every day to build a streak
          </p>
          <button className="btn-primary" onClick={() => setShowStart(true)}>Start a Challenge</button>
        </div>
      )}

      {/* Active challenge card */}
      {challenge && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Main stat card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79,59,219,0.2), rgba(157,133,255,0.08))',
            border: '1px solid rgba(157,133,255,0.3)',
            borderRadius: 20,
            padding: '1.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: 4 }}>Daily Goal</p>
                <p style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.04em' }} className="gradient-text">
                  {fmt(challenge.daily_amount)}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>per day</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
                  <Flame size={18} color={challenge.current_streak > 0 ? 'var(--secondary)' : 'var(--on-surface-variant)'} />
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: challenge.current_streak > 0 ? 'var(--secondary)' : 'var(--on-surface-variant)' }}>
                    {challenge.current_streak}
                  </span>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>day streak</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>best: {challenge.best_streak}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Saved', value: fmt(challenge.total_saved) },
                { label: 'Grace Left', value: challenge.grace_used ? 'Used' : '1 available', warn: challenge.grace_used },
                { label: 'Status', value: challenge.is_active ? 'Active' : 'Ended', ok: challenge.is_active },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.75rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontWeight: 800, fontSize: '0.875rem', color: s.warn ? 'var(--error)' : s.ok === false ? 'var(--error)' : s.ok ? 'var(--tertiary)' : 'var(--on-surface)' }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            {isActive && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-primary" style={{ flex: 1, gap: 6 }}
                  onClick={handleCheckIn} disabled={saving || !challenge.can_check_in}>
                  <CheckCircle2 size={16} />
                  {!challenge.can_check_in ? 'Checked in today ✓' : `Check In — ${fmt(challenge.daily_amount)}`}
                </button>
                {challenge.can_use_grace && (
                  <button className="btn-ghost" style={{ gap: 5, color: 'var(--secondary)' }} onClick={handleGrace}>
                    <Shield size={15} /> Use Grace
                  </button>
                )}
                <button className="btn-ghost" style={{ gap: 5, color: 'var(--error)' }} onClick={handleStop}>
                  <StopCircle size={15} /> Stop
                </button>
              </div>
            )}

            {!isActive && (
              <div style={{ padding: '0.875rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, textAlign: 'center' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--error)', fontWeight: 600 }}>Challenge ended — best streak: {challenge.best_streak} days</p>
                <button className="btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }} onClick={() => setShowStart(true)}>Start New Challenge</button>
              </div>
            )}
          </div>

          {/* How it works info */}
          <div style={{ background: 'rgba(157,133,255,0.06)', border: '1px solid rgba(157,133,255,0.15)', borderRadius: 12, padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--on-surface-variant)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--primary-dim)' }}>How it works:</strong> Check in every day to save your daily amount and grow your streak.
            Miss a day? Use your one <strong>Grace Day</strong> to cover yesterday without breaking the streak.
            Miss 2+ days without grace, and the streak resets to 0.
          </div>
        </div>
      )}
    </div>
  );
}
