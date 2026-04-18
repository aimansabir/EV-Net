import React from 'react';
import { AlertTriangle, ShieldAlert, MessageSquare, History, ExternalLink } from 'lucide-react';

const AdminReports = () => {
  return (
    <div className="section" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={32} style={{ color: '#fbbf24' }} />
            Reports & Flags
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage platform safety by reviewing user reports, flagged listings, and platform violations.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Dispute Statistics Placeholder */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h4 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>Moderation Summary</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { label: 'Unresolved Reports', value: '0', icon: ShieldAlert, color: 'var(--text-secondary)' },
                { label: 'Active Disputes', value: '0', icon: MessageSquare, color: 'var(--text-secondary)' },
                { label: 'Resolved (Last 30d)', value: '14', icon: History, color: '#00D26A' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <Icon size={16} />
                      {item.label}
                    </div>
                    <div style={{ fontWeight: 'bold', color: item.color }}>{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '2rem', background: 'rgba(225, 29, 72, 0.03)', border: '1px dashed rgba(225, 29, 72, 0.3)' }}>
            <h4 style={{ marginBottom: '1rem', color: '#fb7185' }}>Module: Case Resolution</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              The Reports module is currently under development. Note: Conversation moderation and chat logs are now managed in the dedicated Conversations tab.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fb7185' }} />
                Internal Ticketing System
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fb7185' }} />
                Booking Refund Triggers
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fb7185' }} />
                User Shadow-banning Tools
              </div>
            </div>
          </div>
        </div>

        {/* Polished Empty State */}
        <div className="glass-card" style={{ marginTop: '2rem', padding: '5rem 2rem', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: 'var(--text-secondary)', opacity: 0.2, marginBottom: '1.5rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No pending reports</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
            The platform is clean. All active reports and disputes have been resolved.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: '2rem', gap: '8px', opacity: 0.6, cursor: 'not-allowed' }}>
            View Archive <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
