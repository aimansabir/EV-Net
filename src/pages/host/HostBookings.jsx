import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../../store/authStore';
import { bookingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { supabase } from '../../lib/supabase';
import { Bookmark } from 'lucide-react';

const BOOKING_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    style: { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    style: { background: 'rgba(0, 210, 106, 0.15)', color: '#00D26A', borderColor: 'rgba(0, 210, 106, 0.3)' }
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    style: { background: 'rgba(0, 210, 106, 0.15)', color: '#00D26A', borderColor: 'rgba(0, 210, 106, 0.3)' }
  },
  completed: {
    label: 'Completed',
    className: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    style: { background: 'rgba(0, 240, 255, 0.15)', color: '#00F0FF', borderColor: 'rgba(0, 240, 255, 0.3)' }
  },
  declined: {
    label: 'Declined',
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
    style: { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
    style: { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }
  }
};

const getBookingStatusConfig = (status) => {
  const key = String(status || 'pending').toLowerCase();
  return BOOKING_STATUS_CONFIG[key] || {
    label: key ? key.replace(/_/g, ' ').toUpperCase() : 'Unknown',
    className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    style: { background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', borderColor: 'rgba(148, 163, 184, 0.3)' }
  };
};

const HostBookings = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    try {
      setFetchLoading(true);
      setError(null);
      const data = await bookingService.getByHost(user?.id);
      setBookings(data || []);
    } catch (err) {
      console.error("[EV-Net] Failed to load host bookings:", err);
      setError("Could not load booking requests.");
    } finally {
      setFetchLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadBookings();
    } else {
      setFetchLoading(false);
    }
  }, [user?.id, loadBookings]);

  // Refetch when tab regains focus (stale data fix)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        loadBookings();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id, loadBookings]);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => String(b.status || 'pending').toLowerCase() === filter.toLowerCase());

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
    // If path is already a full URL, check if it's from the correct project
    if (/^https?:\/\//.test(path)) {
      const currentHost = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (currentHost && path.includes(currentHost)) {
        return path; // Already correct URL
      }
      // Wrong domain — try to extract relative path from the full URL
      const match = path.match(/\/storage\/v1\/object\/public\/payment_proofs\/(.+)$/);
      if (match) {
        const relativePath = match[1];
        const { data } = supabase.storage.from('payment_proofs').getPublicUrl(relativePath);
        return data?.publicUrl || null;
      }
      return null; // Cannot resolve
    }
    // Relative path — build URL via storage client
    const { data } = supabase.storage.from('payment_proofs').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  if (fetchLoading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;
  if (error) return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--brand-red)', marginBottom: '1rem' }}>{error}</div>
        <button className="btn btn-secondary" onClick={loadBookings}>Try Again</button>
      </div>
    </div>
  );

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
            <h3>No booking requests yet.</h3>
            <p style={{ color: 'var(--text-secondary)' }}>When users book your chargers, they'll appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(booking => {
              const bookingStatus = String(booking.status || 'pending').toLowerCase();
              const statusConfig = getBookingStatusConfig(booking.status);
              const payStatus = paymentStatusMap[booking.paymentStatus] || { label: booking.paymentStatus || 'Not recorded', color: 'var(--text-secondary)' };
              const isUpdating = updatingId === booking.id;
              const proofUrl = getProofUrl(booking.paymentProofPath);
              
              return (
                <div key={booking.id} className="glass-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{booking.user?.name || 'Guest'}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0' }}>{booking.listing?.title || 'Listing unavailable'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span
                        className={statusConfig.className}
                        style={{ padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', ...statusConfig.style }}
                      >
                        {statusConfig.label}
                      </span>
                      <span style={{ padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: payStatus.color, border: `1px solid ${payStatus.color}44` }}>{payStatus.label}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
                        {booking.date} • {booking.startTime} – {booking.endTime}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Method: <strong>{paymentMethodLabel[booking.paymentMethod] || booking.paymentMethod || 'Not recorded'}</strong></span>
                        {booking.paymentProofPath && (
                          proofUrl ? (
                            <a href={proofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--brand-cyan)', textDecoration: 'none', borderBottom: '1px solid var(--brand-cyan)' }}>View Proof</a>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Payment proof unavailable</span>
                          )
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--brand-green)', fontWeight: 700, fontSize: '1.05rem' }}>{formatPKR(booking.hostPayout ?? booking.baseFee ?? 0)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Payout</div>
                      </div>
                      {bookingStatus === 'pending' && (
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
