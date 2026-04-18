import React, { useState, useEffect } from 'react';
import { adminService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { adminService.getBookings().then(setBookings); }, []);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter.toUpperCase());

  const statusColors = {
    PENDING: '#fbbf24', CONFIRMED: '#00D26A', COMPLETED: '#00F0FF', CANCELLED: '#ef4444',
  };

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>All Bookings</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: filter === f ? '1px solid #fb7185' : '1px solid var(--border-color)', background: filter === f ? 'rgba(225,29,72,0.15)' : 'transparent', color: filter === f ? '#fb7185' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['User', 'Listing', 'Date', 'Time', 'Total', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem' }}>{b.user?.name || '—'}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{b.listing?.title || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{b.date}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{b.startTime} – {b.endTime}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--brand-green)' }}>{formatPKR(b.totalFee)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: `${statusColors[b.status]}20`, color: statusColors[b.status] }}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;
