import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginAPI, register as registerAPI } from '../api/api';
import { Wallet } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isLogin) {
        const data = await loginAPI(email, password);
        login(data.token, data.user);
      } else {
        await registerAPI(username, email, password);
        const data = await loginAPI(email, password);
        login(data.token, data.user);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card flex-col gap-8">
        <div className="flex-col items-center gap-3">
          <div style={styles.logoIcon}>
            <Wallet size={20} color="var(--on-primary)" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>BudgetQuest</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>Level up your finances</p>
        </div>

        <div className="flex-row" style={{ borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--surface-container-high)' }}>
          {['Login', 'Register'].map((label) => {
            const active = (label === 'Login') === isLogin;
            return (
              <button
                key={label}
                onClick={() => { setIsLogin(label === 'Login'); setError(''); }}
                style={{
                  flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                  fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: '0.875rem',
                  backgroundColor: active ? 'var(--surface-container-highest)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-col gap-4">
          {!isLogin && (
            <div className="flex-col gap-2">
              <label style={styles.label}>Username</label>
              <input type="text" className="input-field input-rect" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          )}
          <div className="flex-col gap-2">
            <label style={styles.label}>Email</label>
            <input type="email" className="input-field input-rect" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex-col gap-2">
            <label style={styles.label}>Password</label>
            <input type="password" className="input-field input-rect" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div style={{ color: 'var(--error)', fontSize: '0.875rem' }}>{error}</div>}
          <button type="submit" disabled={isLoading} className="btn-primary btn-primary-lg w-full" style={{ marginTop: '8px' }}>
            {isLoading ? 'Loading...' : isLogin ? 'Enter the Quest' : 'Begin Your Adventure'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  logoIcon: {
    width: '56px', height: '56px', borderRadius: '16px',
    background: 'linear-gradient(135deg, var(--primary), var(--primary-container))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(157,133,255,0.3)',
  },
  label: {
    fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface-variant)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
};

export default Login;
