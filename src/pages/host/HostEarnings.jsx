import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../../store/authStore';
import { hostService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

const HostEarnings = () => {
  const { user } = useAuthStore();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadError('');
      const data = await hostService.getEarnings(user.id);
      setEarnings(data);
    } catch (err) {
      console.error('[EV-Net] Failed to load earnings:', err);
      setLoadError(err.message || 'Could not load earnings.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !earnings) return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>{loading ? 'Loading earnings...' : (loadError || 'No earnings data available.')}</div>
        {loadError && <button className="btn btn-secondary" onClick={load} style={{ marginTop: '1rem' }}>Retry</button>}
      </div>
    </div>
  );

  const months = Object.entries(earnings.byMonth).sort((a, b) => b[0].localeCompare(a[0]));
  const maxRevenue = Math.max(...months.map(([, d]) => d.earnings + (d.pendingVerification || 0)), 1);

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>Earnings & Payouts</h2>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} /> Total Host Earnings
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--brand-green)' }}>{formatPKR(earnings.totalEarnings)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Verified payments only</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Pending Payout
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24' }}>{formatPKR(earnings.pendingPayout)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Verified, awaiting transfer</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} /> Paid Out
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--brand-cyan)' }}>{formatPKR(earnings.paidOut)}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Completed Sessions</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{earnings.totalSessions}</div>
          </div>
        </div>

        {/* Pending Verification Banner */}
        {earnings.pendingVerificationCount > 0 && (
          <div className="glass-card" style={{
            padding: '1.25rem 1.5rem', marginBottom: '2rem',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            background: 'rgba(251, 191, 36, 0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem', color: '#fbbf24' }}>
                  <AlertTriangle size={16} />
                  Awaiting Payment Verification
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {earnings.pendingVerificationCount} session{earnings.pendingVerificationCount > 1 ? 's' : ''} completed — payment proof submitted, awaiting EV-Net verification.
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  These are not counted in your earnings until payment is confirmed by the platform.
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Pending Verification</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fbbf24' }}>{formatPKR(earnings.pendingVerificationAmount)}</div>
              </div>
            </div>
          </div>
        )}

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
                    <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{formatPKR(data.earnings)}</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, var(--brand-green), var(--brand-cyan))', width: `${(data.earnings / maxRevenue) * 100}%`, transition: 'width 0.5s' }} />
                    {(data.pendingVerification || 0) > 0 && (
                      <div style={{
                        position: 'absolute', top: 0, height: '100%', borderRadius: '0 4px 4px 0',
                        background: 'rgba(251, 191, 36, 0.4)',
                        left: `${(data.earnings / maxRevenue) * 100}%`,
                        width: `${((data.pendingVerification || 0) / maxRevenue) * 100}%`,
                        transition: 'all 0.5s',
                      }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span>{data.sessions} sessions</span>
                    {data.pending > 0 && <span>Pending: {formatPKR(data.pending)}</span>}
                    {data.paid > 0 && <span>Paid Out: {formatPKR(data.paid)}</span>}
                    {(data.pendingVerification || 0) > 0 && (
                      <span style={{ color: '#fbbf24' }}>Awaiting Verification: {formatPKR(data.pendingVerification)}</span>
                    )}
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
