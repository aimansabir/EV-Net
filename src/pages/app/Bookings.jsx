import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { bookingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { ListSkeleton } from '../../components/ui/Skeleton';

const formatTime12h = (time24) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h === 0 ? 12 : h;
  return `${h}:${mStr} ${ampm}`;
};

const Bookings = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await bookingService.getByUser(user?.id || 'user_ali');
        setBookings(data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter.toUpperCase());

  const statusColors = {
    PENDING: { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', label: 'Pending' },
    CONFIRMED: { bg: 'rgba(0, 210, 106, 0.15)', color: '#00D26A', label: 'Confirmed' },
    COMPLETED: { bg: 'rgba(0, 240, 255, 0.15)', color: '#00F0FF', label: 'Completed' },
    CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Cancelled' },
  };

  const filters = [
    { key: 'all', label: 'All Bookings' },
    { key: 'confirmed', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  if (loading) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem', opacity: 0.1 }}>My Bookings</h2>
          <ListSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>My Bookings</h2>
        
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: filter === f.key ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                background: filter === f.key ? 'var(--brand-green)' : 'transparent',
                color: filter === f.key ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--brand-green)', marginBottom: '1.5rem', opacity: 0.8 }}>
              <Calendar size={64} strokeWidth={1.5} />
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>No bookings found</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {filter === 'all' ? "You haven't made any bookings yet." : `No ${filter} bookings.`}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/app/explore')}>
              Explore Chargers
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(booking => {
              const status = statusColors[booking.status] || statusColors.PENDING;
              return (
                <div key={booking.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => booking.listing && navigate(`/app/charger/${booking.listingId}`)}
                >
                  {/* Listing Image */}
                  <div style={{
                    width: '100px', height: '80px', borderRadius: '10px', flexShrink: 0,
                    background: booking.listing?.images?.[0] ? `url(${booking.listing.images[0]}) center/cover` : '#222',
                  }} />
                  
                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{booking.listing?.title || 'Charger'}</h4>
                      <span style={{
                        padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: status.bg, color: status.color,
                      }}>
                        {status.label}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                      {booking.date} • {formatTime12h(booking.startTime)} – {formatTime12h(booking.endTime)}
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{formatPKR(booking.totalFee)}</span>
                      {booking.status === 'COMPLETED' && (
                        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/charger/${booking.listingId}`); }}
                        >
                          Book Again
                        </button>
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

export default Bookings;
