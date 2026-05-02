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

  const [uploadingId, setUploadingId] = useState(null);

  const handleUploadProof = async (bookingId, file) => {
    if (!file) return;
    try {
      setUploadingId(bookingId);
      await bookingService.uploadPaymentProof(bookingId, file);
      // Refresh list
      const data = await bookingService.getByUser(user?.id);
      setBookings(data);
      alert("Payment proof submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to upload proof: " + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const statusColors = {
    PENDING: { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', label: 'Pending' },
    CONFIRMED: { bg: 'rgba(0, 210, 106, 0.15)', color: '#00D26A', label: 'Confirmed' },
    COMPLETED: { bg: 'rgba(0, 240, 255, 0.15)', color: '#00F0FF', label: 'Completed' },
    CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Cancelled' },
  };

  const paymentStatusMap = {
    unpaid: { label: 'Unpaid', color: '#f87171' },
    pay_later: { label: 'Pay Later', color: 'var(--brand-cyan)' },
    payment_due: { label: 'Payment Due', color: '#fbbf24' },
    proof_submitted: { label: 'Proof Submitted', color: 'var(--brand-green)' },
    paid: { label: 'Paid', color: 'var(--brand-green)' },
    rejected: { label: 'Payment Rejected', color: '#f87171' },
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
              const payStatus = paymentStatusMap[booking.paymentStatus] || { label: booking.paymentStatus, color: 'var(--text-secondary)' };
              const needsProof = ['unpaid', 'pay_later', 'payment_due', 'rejected'].includes(booking.paymentStatus);
              const isUploading = uploadingId === booking.id;

              return (
                <div key={booking.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  {/* Listing Image */}
                  <div style={{
                    width: '100px', height: '80px', borderRadius: '10px', flexShrink: 0,
                    background: booking.listing?.images?.[0] ? `url(${booking.listing.images[0]}) center/cover` : '#222',
                  }} />
                  
                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', cursor: 'pointer' }} onClick={() => navigate(`/app/charger/${booking.listingId}`)}>{booking.listing?.title || 'Charger'}</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{
                          padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                          background: status.bg, color: status.color,
                        }}>
                          {status.label}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                          background: 'rgba(255,255,255,0.05)', color: payStatus.color, border: `1px solid ${payStatus.color}44`
                        }}>
                          {payStatus.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                      {booking.date} • {formatTime12h(booking.startTime)} – {formatTime12h(booking.endTime)}
                    </div>
                    <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{formatPKR(booking.userTotal)}</span>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {needsProof && (
                          <label style={{ 
                            padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'var(--brand-cyan)', color: '#000', 
                            fontSize: '0.75rem', fontWeight: 700, cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' 
                          }}>
                            {isUploading ? 'Uploading...' : 'Upload Payment Proof'}
                            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploading} onChange={(e) => handleUploadProof(booking.id, e.target.files[0])} />
                          </label>
                        )}
                        {booking.status === 'COMPLETED' && (
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/app/charger/${booking.listingId}`)}
                          >
                            Book Again
                          </button>
                        )}
                      </div>
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
