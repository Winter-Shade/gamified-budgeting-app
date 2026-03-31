import React, { useEffect, useState } from 'react';
import { getFriends, addFriend } from '../api/api';
import { Users, UserPlus, User } from 'lucide-react';

const Friends = () => {
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchFriends(); }, []);
  const fetchFriends = async () => { try { setFriends(await getFriends()); } catch (e) { console.error(e); } finally { setIsLoading(false); } };

  const handleAdd = async (e) => {
    e.preventDefault(); setMsg('');
    try { await addFriend(username); setUsername(''); setMsg('Friend added!'); fetchFriends(); }
    catch (err) { setMsg(err.message || 'Failed'); }
  };

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--on-surface-variant)' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div className="flex-col gap-8">
        <div>
          <div className="flex-row items-center gap-3">
            <Users size={22} color="var(--primary)" strokeWidth={1.5} />
            <h1 className="text-xl">Friends</h1>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Build your party of adventurers</p>
        </div>

        <div className="glass-card card-2xl">
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>Add Companion</h2>
          <form onSubmit={handleAdd} className="flex-row gap-3 items-center">
            <input type="text" className="input-field" style={{ flex: 1 }} placeholder="Enter username..." value={username} onChange={(e) => setUsername(e.target.value)} required />
            <button type="submit" className="btn-primary" style={{ padding: '8px 20px' }}>
              <UserPlus size={14} /> Add
            </button>
          </form>
          {msg && <p style={{ marginTop: '12px', fontSize: '0.875rem', color: msg.includes('Failed') || msg.includes('failed') ? 'var(--error)' : 'var(--tertiary)' }}>{msg}</p>}
        </div>

        <div className="glass-card card-2xl-np">
          <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h2 className="text-lg">Your Party</h2>
          </div>
          {friends.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>No companions yet. Invite your first friend!</div>
          ) : (
            <div>
              {friends.map((f, i) => (
                <React.Fragment key={f.id}>
                  {i > 0 && <div className="divider" />}
                  <div className="ledger-row">
                    <div className="flex-row items-center gap-4">
                      <div className="ledger-icon" style={{ backgroundColor: 'var(--surface-container)' }}>
                        <User size={18} color="var(--primary)" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{f.username}</p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>
                          Level {f.level || 1} • {f.xp || 0} XP
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-tertiary">Active</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Friends;
