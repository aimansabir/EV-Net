import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { hostService } from '../../data/api';
import { formatPKR, PLATFORM_COMMISSION_PERCENT, HOST_PAYOUT_PERCENT } from '../../data/feeConfig';

const HostEarnings = () => {
  const { user } = useAuthStore();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await hostService.getEarnings(user?.id || 'host_ahsan');
      setEarnings(data);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading || !earnings) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;

  const months = Object.entries(earnings.byMonth).sort((a, b) => b[0].localeCompare(a[0]));
  const maxRevenue = Math.max(...months.map(([, d]) => d.revenue), 1);

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>Earnings & Payouts</h2>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Total Revenue</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--brand-green)' }}>{formatPKR(earnings.totalRevenue)}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Your Payout ({Math.round(HOST_PAYOUT_PERCENT * 100)}%)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--brand-cyan)' }}>{formatPKR(earnings.totalPayout)}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Platform Fee ({Math.round(PLATFORM_COMMISSION_PERCENT * 100)}%)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{formatPKR(earnings.totalCommission)}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Total Sessions</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{earnings.totalSessions}</div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Monthly Breakdown</h3>
          {months.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No earnings data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {months.map(([month, data]) => (
                <div key={month}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span>{new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                    <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{formatPKR(data.payout)}</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, var(--brand-green), var(--brand-cyan))', width: `${(data.revenue / maxRevenue) * 100}%`, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{data.sessions} sessions</span>
                    <span>Revenue: {formatPKR(data.revenue)}</span>
                    <span>Commission: {formatPKR(data.commission)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostEarnings;
