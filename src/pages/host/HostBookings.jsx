import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../../store/authStore';
import { bookingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { supabase } from '../../lib/supabase';
import { Bookmark, RefreshCw } from 'lucide-react';
import { invalidatePageCaches, isPageCacheStale, makePageCacheKey, PAGE_CACHE_TTL, useCachedPageData } from '../../store/pageCacheStore';

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
  const userId = user?.id;
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [proofUrls, setProofUrls] = useState({});
  const [proofLoadingId, setProofLoadingId] = useState(null);

  const bookingsCacheKey = makePageCacheKey('host-bookings', userId);
  const fetchBookings = useCallback(() => bookingService.getByHost(userId), [userId]);
  const {
    data: cachedBookings,
    isLoading: fetchLoading,
    isRefreshing,
    error: loadError,
    refresh: refreshBookings,
  } = useCachedPageData(bookingsCacheKey, fetchBookings, {
    enabled: !!userId,
    ttl: PAGE_CACHE_TTL.SHORT,
  });
  const bookings = cachedBookings || [];

  const loadBookings = useCallback(() => {
    setError(null);
    return refreshBookings({ force: true });
  }, [refreshBookings]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userId && isPageCacheStale(bookingsCacheKey, PAGE_CACHE_TTL.SHORT)) {
        refreshBookings({ force: true, silent: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [bookingsCacheKey, refreshBookings, userId]);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => String(b.status || 'pending').toLowerCase() === filter.toLowerCase());

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      setUpdatingId(bookingId);
      setError(null);
      await bookingService.updateStatus(bookingId, newStatus);
      invalidatePageCaches([
        'user-bookings',
        'booking-detail',
        makePageCacheKey('host-dashboard', userId),
        makePageCacheKey('host-earnings', userId),
        'admin-bookings',
        'admin-dashboard',
      ]);
      await refreshBookings({ force: true, silent: true });
    } catch (err) {
      console.error("[EV-Net] Failed to update booking status:", err);
      alert(err.message || "Failed to update booking. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const paymentMethodLabel = {
    BANK_TRANSFER: 'Bank Transfer',
    PAY_AFTER_CHARGING: 'Legacy Pay Later'
  };

  const paymentStatusMap = {
    unpaid: { label: 'Unpaid', color: '#f87171' },
    pay_later: { label: 'Legacy Pay Later', color: 'var(--brand-cyan)' },
    payment_due: { label: 'Payment Due', color: '#fbbf24' },
    proof_submitted: { label: 'Payment Proof Submitted', color: 'var(--brand-cyan)' },
    paid: { label: 'Payment Verified by EV-Net', color: 'var(--brand-green)' },
    rejected: { label: 'Payment Rejected', color: '#f87171' },
  };

  const getProofUrl = (bookingOrPath) => {
    if (bookingOrPath && typeof bookingOrPath === 'object') return bookingOrPath.paymentProofUrl || null;
    const path = bookingOrPath;
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

  const handleViewProof = async (booking) => {
    const cachedUrl = proofUrls[booking.id] || booking.paymentProofUrl;
    if (cachedUrl) {
      window.open(cachedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!booking.paymentProofPath || proofLoadingId) return;

    try {
      setProofLoadingId(booking.id);
      const url = await bookingService.getPaymentProofUrl(booking.paymentProofPath);
      if (!url) throw new Error('Payment proof is not available yet.');
      setProofUrls(prev => ({ ...prev, [booking.id]: url }));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.message || 'Could not open payment proof.');
    } finally {
      setProofLoadingId(null);
    }
  };

  if (fetchLoading && bookings.length === 0) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;
  if ((error || loadError) && bookings.length === 0) return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--brand-red)', marginBottom: '1rem' }}>{error || loadError?.message || 'Could not load booking requests.'}</div>
        <button className="btn btn-secondary" onClick={loadBookings}>Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0 }}>Booking Requests</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadBookings}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        {(isRefreshing || loadError) && bookings.length > 0 && (
          <div style={{ color: loadError ? '#fbbf24' : 'var(--brand-cyan)', fontSize: '0.85rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
            {loadError ? 'Could not refresh. Showing cached booking requests.' : 'Refreshing booking requests...'}
          </div>
        )}
        
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
              const proofUrl = proofUrls[booking.id] || getProofUrl(booking);
              const paymentVerified = booking.paymentStatus === 'paid';
              
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
                        {booking.paymentMethod === 'PAY_AFTER_CHARGING' && (
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: '4px' }}>Legacy</span>
                        )}
                        {booking.paymentProofPath && (
                          proofUrl ? (
                            <a href={proofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--brand-cyan)', textDecoration: 'none', borderBottom: '1px solid var(--brand-cyan)' }}>View Proof</a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleViewProof(booking)}
                              disabled={!!proofLoadingId}
                              style={{ padding: 0, background: 'transparent', border: 'none', borderBottom: '1px solid var(--brand-cyan)', color: 'var(--brand-cyan)', fontSize: '0.75rem', cursor: proofLoadingId ? 'not-allowed' : 'pointer' }}
                            >
                              {proofLoadingId === booking.id ? 'Opening...' : 'View Proof'}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formatPKR(booking.userTotal || booking.total_fee || 0)}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>User Paid</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formatPKR((booking.userServiceFee || 0) + (booking.hostPlatformFee || 0))}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Platform Fee</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--brand-green)', fontWeight: 700, fontSize: '1.05rem' }}>{formatPKR(booking.hostPayout ?? booking.baseFee ?? 0)}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--brand-green)' }}>Host Earning</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {bookingStatus === 'pending' && (
                          <>
                            {paymentVerified ? (
                              <button
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(booking.id, 'CONFIRMED')}
                                style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.15)', color: 'var(--brand-green)', cursor: isUpdating ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', minWidth: '80px' }}
                              >
                                {isUpdating ? '...' : 'Accept'}
                              </button>
                            ) : (
                              <span style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,240,255,0.25)', color: 'var(--brand-cyan)', background: 'rgba(0,240,255,0.06)', fontSize: '0.75rem', fontWeight: 600 }}>
                                Awaiting EV-Net payment verification
                              </span>
                            )}
                            <button
                              disabled={isUpdating}
                              onClick={() => handleStatusChange(booking.id, 'CANCELLED')}
                              style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: isUpdating ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', minWidth: '80px' }}
                            >
                              {isUpdating ? '...' : 'Decline'}
                            </button>
                          </>
                        )}
                        {['confirmed', 'accepted'].includes(bookingStatus) && (
                          <>
                            {paymentVerified && (
                              <button
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(booking.id, 'COMPLETED')}
                                style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid #fbbf24', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', cursor: isUpdating ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                              >
                                {isUpdating ? '...' : 'Mark Completed'}
                              </button>
                            )}
                          </>
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

export default HostBookings;
