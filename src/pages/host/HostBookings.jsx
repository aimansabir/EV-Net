import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { bookingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { Bookmark } from 'lucide-react';

const HostBookings = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await bookingService.getByHost(user?.id || 'host_ahsan');
      setBookings(data);
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter.toUpperCase());

  const handleStatusChange = async (bookingId, newStatus) => {
    await bookingService.updateStatus(bookingId, newStatus);
    const data = await bookingService.getByHost(user?.id || 'host_ahsan');
    setBookings(data);
  };

  const statusColors = {
    PENDING: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending' },
    CONFIRMED: { bg: 'rgba(0,210,106,0.15)', color: '#00D26A', label: 'Confirmed' },
    COMPLETED: { bg: 'rgba(0,240,255,0.15)', color: '#00F0FF', label: 'Completed' },
    CANCELLED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Cancelled' },
  };

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>Booking Requests</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'confirmed', label: 'Confirmed' }, { key: 'completed', label: 'Completed' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: filter === f.key ? '1px solid var(--brand-green)' : '1px solid var(--border-color)', background: filter === f.key ? 'var(--brand-green)' : 'transparent', color: filter === f.key ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center' }}><Bookmark size={48} strokeWidth={1.5} /></div>
            <h3>No bookings found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>When users book your chargers, they'll appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(booking => {
              const status = statusColors[booking.status] || statusColors.PENDING;
              return (
                <div key={booking.id} className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{booking.user?.name || 'User'}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0' }}>{booking.listing?.title}</p>
                    </div>
                    <span style={{ padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: status.bg, color: status.color }}>{status.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {booking.date} • {booking.startTime} – {booking.endTime}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{formatPKR(booking.baseFee)}</span>
                      {booking.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleStatusChange(booking.id, 'CONFIRMED')} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.15)', color: 'var(--brand-green)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>Accept</button>
                          <button onClick={() => handleStatusChange(booking.id, 'CANCELLED')} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>Decline</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostBookings;
