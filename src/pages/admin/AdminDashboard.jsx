import React, { useState, useEffect } from 'react';
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
  CreditCard,
  ArrowRight,
  Receipt
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminService.getDashboard().then(setStats);
  }, []);

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
    { label: 'Total Bookings', value: stats.totalBookings, color: '#00D26A', icon: CalendarDays, sub: 'Last 30 days' },
  ];

  const moderationCards = [
    { label: 'Pending EV Verifications', value: stats.pendingEvVerifications, color: '#fbbf24', icon: UserCheck, path: '/admin/verifications' },
    { label: 'Pending Host Verifications', value: stats.pendingHostVerifications, color: '#f59e0b', icon: ShieldCheck, path: '/admin/verifications' },
    { label: 'Onboarding Payments', value: stats.pendingPayments, color: '#00F0FF', icon: Receipt, path: '/admin/verifications' },
    { label: 'Flagged Listings', value: '0', color: '#f87171', icon: Flag, path: '/admin/listings' },
  ];

  return (
    <div className="section" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>Admin Overview</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Real-time platform metrics and security posture.</p>
          </div>
          <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(0, 210, 106, 0.2)', background: 'rgba(0, 210, 106, 0.05)' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0, 210, 106, 0.1)', color: '#00D26A' }}>
              <CreditCard size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Total Revenue</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00D26A' }}>{formatPKR(stats.totalRevenue)}</div>
            </div>
          </div>
        </div>

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
    </div>
  );
};

export default AdminDashboard;
