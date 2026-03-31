import React from 'react';
import { TrendingUp, Clock } from 'lucide-react';

const Investments = () => (
  <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
    <div className="flex-col gap-8">
      <div>
        <div className="flex-row items-center gap-3">
          <TrendingUp size={22} color="var(--primary)" strokeWidth={1.5} />
          <h1 className="text-xl">Investments</h1>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Track your portfolio growth</p>
      </div>
      <div className="glass-card card-2xl flex-col items-center" style={{ textAlign: 'center', padding: '80px 40px' }}>
        <Clock size={48} color="var(--on-surface-variant)" style={{ opacity: 0.2, marginBottom: '16px' }} />
        <h2 className="text-lg" style={{ marginBottom: '8px' }}>Coming Soon</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', maxWidth: '400px' }}>
          Investment tracking is being forged. Soon you'll be able to monitor your treasury and watch your gold reserves grow.
        </p>
      </div>
    </div>
  </div>
);

export default Investments;
