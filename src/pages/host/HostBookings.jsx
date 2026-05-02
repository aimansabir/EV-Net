import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { bookingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { Bookmark } from 'lucide-react';

const HostBookings = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  const loadBookings = async () => {
    try {
      const data = await bookingService.getByHost(user?.id);
      setBookings(data || []);
    } catch (err) {
      console.error("[EV-Net] Failed to load host bookings:", err);
      setError("Failed to load bookings.");
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadBookings();
    }
  }, [user]);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter.toUpperCase());

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      setUpdatingId(bookingId);
      setError(null);
      await bookingService.updateStatus(bookingId, newStatus);
      // Refresh list
      await loadBookings();
    } catch (err) {
      console.error("[EV-Net] Failed to update booking status:", err);
      alert(err.message || "Failed to update booking. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const paymentMethodLabel = {
    BANK_TRANSFER: 'Bank Transfer',
    PAY_AFTER_CHARGING: 'Pay After Charging'
  };

  const paymentStatusMap = {
    unpaid: { label: 'Unpaid', color: '#f87171' },
    pay_later: { label: 'Pay Later', color: 'var(--brand-cyan)' },
    payment_due: { label: 'Payment Due', color: '#fbbf24' },
    proof_submitted: { label: 'Proof Submitted', color: 'var(--brand-green)' },
    paid: { label: 'Paid', color: 'var(--brand-green)' },
    rejected: { label: 'Payment Rejected', color: '#f87171' },
  };

  const getProofUrl = (path) => {
    if (!path) return null;
    return `https://yqomlyvshmqmrvstveps.supabase.co/storage/v1/object/public/payment_proofs/${path}`;
  };

  if (fetchLoading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;
  if (error) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--brand-red)' }}>{error}</div></div>;

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
              const payStatus = paymentStatusMap[booking.paymentStatus] || { label: booking.paymentStatus, color: 'var(--text-secondary)' };
              const isUpdating = updatingId === booking.id;
              
              return (
                <div key={booking.id} className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{booking.user?.name || 'User'}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0' }}>{booking.listing?.title}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: status.bg, color: status.color }}>{status.label}</span>
                      <span style={{ padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: payStatus.color, border: `1px solid ${payStatus.color}44` }}>{payStatus.label}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
                        {booking.date} • {booking.startTime} – {booking.endTime}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Method: <strong>{paymentMethodLabel[booking.paymentMethod] || booking.paymentMethod}</strong></span>
                        {booking.paymentProofPath && (
                          <a href={getProofUrl(booking.paymentProofPath)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--brand-cyan)', textDecoration: 'none', borderBottom: '1px solid var(--brand-cyan)' }}>View Proof</a>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--brand-green)', fontWeight: 700, fontSize: '1.05rem' }}>{formatPKR(booking.hostPayout)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Payout</div>
                      </div>
                      {booking.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(booking.id, 'CONFIRMED')} 
                            style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.15)', color: 'var(--brand-green)', cursor: isUpdating ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-body)', transition: 'all 0.2s', minWidth: '80px' }}
                          >
                            {isUpdating ? '...' : 'Accept'}
                          </button>
                          <button 
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(booking.id, 'CANCELLED')} 
                            style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: isUpdating ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-body)', transition: 'all 0.2s', minWidth: '80px' }}
                          >
                            {isUpdating ? '...' : 'Decline'}
                          </button>
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
