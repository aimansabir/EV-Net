import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { 
  Users, 
  Home, 
  Zap, 
  CalendarDays, 
  UserCheck, 
  ShieldCheck, 
  Flag, 
  AlertTriangle,
  ArrowRight,
  Receipt,
  X
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [feeActionId, setFeeActionId] = useState(null);

  const loadDashboard = useCallback(async () => {
    const data = await adminService.getDashboard();
    setStats(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    adminService
      .getDashboard()
      .then(data => {
        if (mounted) setStats(data);
      })
      .catch(err => console.error('[EV-Net] Failed to load admin dashboard:', err));
    return () => {
      mounted = false;
    };
  }, []);

  const handleArchiveOnboardingFee = async (paymentId) => {
    if (feeActionId) return;
    if (!window.confirm('Exclude this host registration payment from financial totals as test data?')) return;

    try {
      setFeeActionId(paymentId);
      await adminService.archiveOnboardingPayment(paymentId);
      await loadDashboard();
    } catch (err) {
      alert(err.message || 'Could not exclude host registration payment.');
    } finally {
      setFeeActionId(null);
    }
  };

  const handleRestoreOnboardingFee = async (paymentId) => {
    if (feeActionId) return;

    try {
      setFeeActionId(paymentId);
      await adminService.unarchiveOnboardingPayment(paymentId);
      await loadDashboard();
    } catch (err) {
      alert(err.message || 'Could not restore host registration payment.');
    } finally {
      setFeeActionId(null);
    }
  };

  if (!stats) return (
    <div className="section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(225, 29, 72, 0.2)', borderTopColor: '#fb7185', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        Loading Intelligence...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const businessCards = [
    { label: 'Total Users', value: stats.totalUsers, color: '#00F0FF', icon: Users, sub: '+4 this week' },
    { label: 'Total Hosts', value: stats.totalHosts, color: '#a78bfa', icon: Home, sub: 'Active partners' },
    { label: 'Active Listings', value: `${stats.activeListings}/${stats.totalListings}`, color: '#fb7185', icon: Zap, sub: 'Online now' },
    { label: 'Real Bookings', value: stats.totalBookings, color: '#00D26A', icon: CalendarDays, sub: 'Confirmed sessions' },
    { label: 'Archived / Test Bookings', value: stats.testArchivedBookings, color: '#94a3b8', icon: Flag, sub: 'Excluded from financials' },
  ];

  const moderationCards = [
    { label: 'Pending EV Verifications', value: stats.pendingEvVerifications, color: '#fbbf24', icon: UserCheck, path: '/admin/verifications' },
    { label: 'Pending Host Verifications', value: stats.pendingHostVerifications, color: '#f59e0b', icon: ShieldCheck, path: '/admin/verifications' },
    { label: 'Onboarding Payments', value: stats.pendingPayments, color: '#00F0FF', icon: Receipt, path: '/admin/verifications' },
    { label: 'Flagged Listings', value: '0', color: '#f87171', icon: Flag, path: '/admin/listings' },
  ];

  const renderPanelContent = () => {
    if (!activePanel) return null;
    
    let title = '';
    let rows = [];
    let columns = [];

    const isRealFinancialBooking = (b) => 
      !b.archived_at && 
      !b.exclude_from_financials && 
      b.status === 'COMPLETED' && 
      b.payment_status === 'paid';
    const isIncludedOnboardingPayment = (p) => !p.archived_at && !p.exclude_from_financials;
    
    if (activePanel === 'collected') {
      title = 'Booking Cash Collected (Completed & Paid)';
      rows = (stats.bookingRows || []).filter(isRealFinancialBooking);
      columns = [
        { key: 'id', label: 'Booking ID' },
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Collected Amount', render: r => formatPKR(r.total_user_price ?? r.total_fee ?? 0) }
      ];
    } else if (activePanel === 'revenue') {
      title = 'Booking Platform Revenue (Completed & Paid)';
      rows = (stats.bookingRows || []).filter(isRealFinancialBooking);
      columns = [
        { key: 'id', label: 'Booking ID' },
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Platform Fee', render: r => formatPKR((r.user_service_fee || 0) + (r.host_platform_fee || 0)) }
      ];
    } else if (activePanel === 'payoutsDue') {
      title = 'Host Payouts Due';
      rows = (stats.bookingRows || []).filter(b => isRealFinancialBooking(b) && b.payout_status === 'pending');
      columns = [
        { key: 'id', label: 'Booking ID' },
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Payout Due', render: r => formatPKR(r.host_payout || 0) }
      ];
    } else if (activePanel === 'payoutsPaid') {
      title = 'Host Payouts Paid';
      rows = (stats.bookingRows || []).filter(b => isRealFinancialBooking(b) && b.payout_status === 'paid_to_host');
      columns = [
        { key: 'id', label: 'Booking ID' },
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Payout Paid', render: r => formatPKR(r.host_payout || 0) }
      ];
    } else if (activePanel === 'receivables') {
      title = 'Pending Receivables (Completed & Unpaid)';
      rows = (stats.bookingRows || []).filter(b => !b.archived_at && !b.exclude_from_financials && b.status === 'COMPLETED' && b.payment_status !== 'paid');
      columns = [
        { key: 'id', label: 'Booking ID' },
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Amount Due', render: r => formatPKR(r.total_user_price ?? r.total_fee ?? 0) },
        { key: 'payment_status', label: 'Status' }
      ];
    } else if (activePanel === 'bookingValue') {
      title = 'Pending Booking Value (Future/Confirmed)';
      rows = (stats.bookingRows || []).filter(b => !b.archived_at && !b.exclude_from_financials && ['PENDING', 'CONFIRMED', 'ACCEPTED'].includes(b.status));
      columns = [
        { key: 'id', label: 'Booking ID' },
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Value', render: r => formatPKR(r.total_user_price ?? r.total_fee ?? 0) },
        { key: 'status', label: 'Status' }
      ];
    } else if (activePanel === 'fees') {
      title = 'Host Registration Fees (Verified)';
      rows = (stats.onboardingRows || []).filter(o => o.status === 'verified');
      columns = [
        { key: 'id', label: 'Payment ID' },
        { key: 'host', label: 'Host', render: r => r.user?.name || 'Unknown' },
        { key: 'email', label: 'Email', render: r => r.user?.email || 'Unknown' },
        { key: 'listing', label: 'Listing', render: r => r.listing?.title || 'Not linked' },
        { key: 'date', label: 'Date', render: r => new Date(r.created_at).toLocaleDateString() },
        { key: 'amount', label: 'Fee', render: r => formatPKR(r.amount || 0) },
        {
          key: 'financials',
          label: 'Financials',
          render: r => isIncludedOnboardingPayment(r) ? 'Included' : `Excluded${r.archive_reason ? `: ${r.archive_reason}` : ''}`
        },
        {
          key: 'action',
          label: 'Action',
          render: r => isIncludedOnboardingPayment(r) ? (
            <button
              type="button"
              disabled={!!feeActionId}
              onClick={() => handleArchiveOnboardingFee(r.id)}
              style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--text-secondary)', background: 'transparent', color: 'var(--text-secondary)', cursor: feeActionId ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              {feeActionId === r.id ? 'Excluding...' : 'Exclude Test Fee'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!!feeActionId}
              onClick={() => handleRestoreOnboardingFee(r.id)}
              style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.1)', color: 'var(--brand-green)', cursor: feeActionId ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              {feeActionId === r.id ? 'Restoring...' : 'Restore'}
            </button>
          )
        }
      ];
    }

    return (
      <div className="glass-card panel-slide-down" style={{ marginTop: '1.5rem', marginBottom: '2.5rem', padding: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
        <button onClick={() => setActivePanel(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{title}</h3>
        {activePanel === 'fees' && (
          <p style={{ marginTop: '-0.4rem', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Financial totals count only included verified host registration fees. Test/excluded rows stay visible here for audit history.
          </p>
        )}
        {rows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {columns.map(c => <th key={c.key} style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)' }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: '0.75rem' }}>{c.render ? c.render(r) : r[c.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <style>{`
          .panel-slide-down { animation: slideDown 0.3s ease-out forwards; transform-origin: top; }
          @keyframes slideDown { from { opacity: 0; transform: scaleY(0.95); } to { opacity: 1; transform: scaleY(1); } }
        `}</style>
      </div>
    );
  };

  return (
    <div className="section" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>Admin Overview</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Real-time platform metrics and security posture.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'collected' ? null : 'collected')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'collected' ? '1px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Booking Cash Collected</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#60a5fa' }}>{formatPKR(stats.totalCollected)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Completed paid bookings only</div>
              </div>
            </div>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'revenue' ? null : 'revenue')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'revenue' ? '1px solid #00D26A' : '1px solid rgba(0, 210, 106, 0.2)', background: 'rgba(0, 210, 106, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Booking Platform Revenue</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#00D26A' }}>{formatPKR(stats.totalRevenue)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>User fee + host fee</div>
              </div>
            </div>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'payoutsDue' ? null : 'payoutsDue')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'payoutsDue' ? '1px solid #00F0FF' : '1px solid rgba(0, 240, 255, 0.2)', background: 'rgba(0, 240, 255, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Host Payouts Due</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#00F0FF' }}>{formatPKR(stats.hostPayoutsDue)}</div>
              </div>
            </div>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'payoutsPaid' ? null : 'payoutsPaid')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'payoutsPaid' ? '1px solid #a78bfa' : '1px solid rgba(167, 139, 250, 0.2)', background: 'rgba(167, 139, 250, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Host Payouts Paid</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a78bfa' }}>{formatPKR(stats.hostPayoutsPaid)}</div>
              </div>
            </div>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'receivables' ? null : 'receivables')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'receivables' ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Receivables</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b' }}>{formatPKR(stats.pendingReceivables)}</div>
              </div>
            </div>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'bookingValue' ? null : 'bookingValue')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'bookingValue' ? '1px solid #fbbf24' : '1px solid rgba(251, 191, 36, 0.2)', background: 'rgba(251, 191, 36, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Booking Value</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24' }}>{formatPKR(stats.pendingBookingValue)}</div>
              </div>
            </div>
            <div 
              className="glass-card hover-lift" 
              onClick={() => setActivePanel(activePanel === 'fees' ? null : 'fees')}
              style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: activePanel === 'fees' ? '1px solid #fb7185' : '1px solid rgba(225, 29, 72, 0.2)', background: 'rgba(225, 29, 72, 0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Host Registration Fees</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fb7185' }}>{formatPKR(stats.hostFeesCollected)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Excludes test fees: {formatPKR(stats.hostFeesExcluded || 0)} ({stats.hostFeesExcludedCount || 0})
                </div>
              </div>
            </div>
          </div>
        </div>

        {renderPanelContent()}

        {/* Row 1: Business Metrics */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1.5rem', fontWeight: 700 }}>Business Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {businessCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="glass-card" style={{ padding: '1.75rem', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '1.5rem', opacity: 0.1 }}>
                    <Icon size={48} />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 500 }}>{card.label}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>{card.value}</div>
                  <div style={{ fontSize: '0.75rem', color: card.color, fontWeight: 600 }}>{card.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Moderation Queue */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1.5rem', fontWeight: 700 }}>Moderation & Safety</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {moderationCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <Link to={card.path} key={i} className="glass-card" style={{ 
                  padding: '1.75rem', 
                  border: card.value > 0 ? `1px solid ${card.color}40` : '1px solid var(--border-color)', 
                  background: card.value > 0 ? `${card.color}05` : 'rgba(255,255,255,0.02)',
                  textDecoration: 'none',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', background: `${card.color}15`, color: card.color }}>
                      <Icon size={24} />
                    </div>
                    {card.value > 0 && (
                      <div style={{ background: card.color, color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>Attention</div>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>{card.label}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: card.value > 0 ? card.color : '#fff' }}>{card.value}</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Administrative Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/admin/listings" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem' }}>
              <Zap size={18} /> Review Listings
            </Link>
            <Link to="/admin/users" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem' }}>
              <Users size={18} /> User Management
            </Link>
            <Link to="/admin/bookings" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem' }}>
              <CalendarDays size={18} /> Booking Audit
            </Link>
            <Link to="/admin/verifications" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', color: '#fb7185', borderColor: 'rgba(225, 29, 72, 0.3)' }}>
              Open Queue <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
      <style>{`
        .hover-lift:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
