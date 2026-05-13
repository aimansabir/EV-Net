import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MessageSquare, RefreshCw } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { bookingService, messagingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { invalidatePageCaches, makePageCacheKey, PAGE_CACHE_TTL, useCachedPageData } from '../../store/pageCacheStore';

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
  const [filter, setFilter] = useState('all');
  const [messagingId, setMessagingId] = useState(null);

  const userId = user?.id || 'user_ali';
  const bookingsCacheKey = makePageCacheKey('user-bookings', userId);
  const fetchBookings = useCallback(() => bookingService.getByUser(userId), [userId]);
  const {
    data: cachedBookings,
    isLoading: loading,
    isRefreshing,
    error: loadError,
    refresh: refreshBookings,
    setData: setBookings,
  } = useCachedPageData(bookingsCacheKey, fetchBookings, {
    ttl: PAGE_CACHE_TTL.SHORT,
  });

  const bookings = cachedBookings || [];
  const loadErrorMessage = loadError?.message || 'Could not load your bookings.';

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter.toUpperCase());

  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const openBooking = (booking) => {
    if (booking?.id) {
      navigate(`/app/bookings/${booking.id}`);
    }
  };

  const handleMessageHost = async (e, booking) => {
    e.stopPropagation();
    if (!booking?.listingId || messagingId) return;

    try {
      setMessagingId(booking.id);
      const conversation = await messagingService.createOrGetInquiry(booking.listingId);
      navigate(`/app/messages?conversation=${conversation.id}`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Unable to message the host. Please try again.');
    } finally {
      setMessagingId(null);
    }
  };

  const handleUploadProof = async (bookingId, file) => {
    if (!file) return;
    try {
      setUploadingId(bookingId);
      setUploadError('');
      const result = await bookingService.uploadPaymentProof(bookingId, file);
      setBookings(prev => (prev || []).map(booking => (
        booking.id === bookingId
          ? {
              ...booking,
              paymentStatus: result.paymentStatus || 'proof_submitted',
              payment_status: result.paymentStatus || 'proof_submitted',
              paymentProofPath: result.proofPath,
              payment_proof_path: result.proofPath
            }
          : booking
      )));
      invalidatePageCaches([
        makePageCacheKey('booking-detail', bookingId),
        'host-bookings',
        'host-dashboard',
        'host-earnings',
        'admin-bookings',
        'admin-dashboard',
      ]);
      refreshBookings({ force: true, silent: true }).catch(err => {
        console.warn('[EV-Net] Background bookings refresh after proof upload failed:', err.message);
      });
    } catch (err) {
      console.error(err);
      setUploadError("Failed to upload proof: " + (err.message || 'Please retry.'));
    } finally {
      setUploadingId(null);
    }
  };

  const statusColors = {
    PENDING: { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', label: 'Pending' },
    CONFIRMED: { bg: 'rgba(0, 210, 106, 0.15)', color: '#00D26A', label: 'Confirmed' },
    ACCEPTED: { bg: 'rgba(0, 210, 106, 0.15)', color: '#00D26A', label: 'Accepted' },
    COMPLETED: { bg: 'rgba(0, 240, 255, 0.15)', color: '#00F0FF', label: 'Completed' },
    CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Cancelled' },
  };

  const paymentStatusMap = {
    unpaid: { label: 'Unpaid', color: '#f87171' },
    pay_later: { label: 'Legacy Pay Later', color: 'var(--brand-cyan)' },
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

  if (loading && bookings.length === 0) {
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0 }}>My Bookings</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => refreshBookings({ force: true })}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        {isRefreshing && bookings.length > 0 && (
          <div style={{ color: 'var(--brand-cyan)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Refreshing bookings...</div>
        )}
        {(loadError || uploadError) && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>
            {uploadError || (bookings.length > 0 ? 'Could not refresh. Showing cached bookings.' : loadErrorMessage)}
          </div>
        )}
        
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
                <div
                  key={booking.id}
                  className="glass-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openBooking(booking)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openBooking(booking);
                    }
                  }}
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    gap: '1.5rem',
                    alignItems: 'center',
                    cursor: booking.id ? 'pointer' : 'default',
                  }}
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
                      
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        {booking.listingId && booking.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            disabled={messagingId === booking.id}
                            onClick={(e) => handleMessageHost(e, booking)}
                          >
                            <MessageSquare size={14} />
                            {messagingId === booking.id ? 'Opening...' : 'Message Host'}
                          </button>
                        )}
                        {needsProof && (
                          <label style={{ 
                            padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'var(--brand-cyan)', color: '#000', 
                            fontSize: '0.75rem', fontWeight: 700, cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' 
                          }}>
                            {isUploading ? 'Uploading...' : 'Upload Payment Proof'}
                            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={isUploading} onChange={(e) => handleUploadProof(booking.id, e.target.files[0])} />
                          </label>
                        )}
                        {booking.status === 'COMPLETED' && (
                          <>
                            <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/app/bookings/${booking.id}`);
                              }}
                            >
                              ★ Leave Review
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/app/charger/${booking.listingId}`);
                              }}
                            >
                              Book Again
                            </button>
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

export default Bookings;
