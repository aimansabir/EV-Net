import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MessageSquare, MapPin, Receipt, RefreshCw, Star } from 'lucide-react';
import { bookingService, messagingService, reviewService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import useAuthStore from '../../store/authStore';
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

const moneyRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.65rem 0',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

// ─── Star Rating Component ─────────────────────────────
const StarRating = ({ rating, onRate, disabled }) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onRate(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => !disabled && setHovered(0)}
          style={{
            background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
            padding: '2px', transition: 'transform 0.15s',
            transform: (hovered === star || (!hovered && rating === star)) ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <Star
            size={28}
            fill={(hovered || rating) >= star ? '#fbbf24' : 'transparent'}
            color={(hovered || rating) >= star ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
};

const BookingDetail = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [messaging, setMessaging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Review state
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const bookingCacheKey = makePageCacheKey('booking-detail', bookingId);
  const fetchBooking = useCallback(() => bookingService.getById(bookingId), [bookingId]);
  const {
    data: booking,
    isLoading: loading,
    isRefreshing,
    error: loadError,
    refresh: refreshBooking,
    setData: setBooking,
  } = useCachedPageData(bookingCacheKey, fetchBooking, {
    enabled: !!bookingId,
    ttl: PAGE_CACHE_TTL.SHORT,
  });

  useEffect(() => {
    let mounted = true;
    if (!booking || booking.status !== 'COMPLETED' || !user?.id) {
      setHasReviewed(false);
      return () => {
        mounted = false;
      };
    }

    reviewService.hasReviewedBooking(user.id, bookingId)
      .then(reviewed => {
        if (mounted) setHasReviewed(reviewed);
      })
      .catch(err => {
        console.warn('[EV-Net] Review status check failed:', err.message);
      });

    return () => {
      mounted = false;
    };
  }, [booking, bookingId, user?.id]);

  const handleMessageHost = async () => {
    if (!booking?.listingId || messaging) return;

    try {
      setMessaging(true);
      const conversation = await messagingService.createOrGetInquiry(booking.listingId);
      navigate(`/app/messages?conversation=${conversation.id}`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Unable to message the host. Please try again.');
    } finally {
      setMessaging(false);
    }
  };

  const handleUploadProof = async (file) => {
    if (!file || !booking?.id) return;

    try {
      setUploading(true);
      setUploadError('');
      const result = await bookingService.uploadPaymentProof(booking.id, file);
      setBooking(prev => prev ? {
        ...prev,
        paymentStatus: result.paymentStatus || 'proof_submitted',
        payment_status: result.paymentStatus || 'proof_submitted',
        paymentProofPath: result.proofPath,
        payment_proof_path: result.proofPath
      } : prev);
      invalidatePageCaches([
        makePageCacheKey('user-bookings', booking.userId || user?.id),
        'host-bookings',
        'host-dashboard',
        'host-earnings',
        'admin-bookings',
        'admin-dashboard',
      ]);
      refreshBooking({ force: true, silent: true }).catch(err => {
        console.warn('[EV-Net] Background booking refresh after proof upload failed:', err.message);
      });
    } catch (err) {
      console.error(err);
      setUploadError('Failed to upload proof: ' + (err.message || 'Please retry.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      setReviewError('Please select a star rating.');
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError('Please write a comment.');
      return;
    }
    setReviewError('');
    setSubmittingReview(true);

    try {
      await reviewService.create({
        authorId: user.id,
        listingId: booking.listingId,
        bookingId: booking.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewSubmitted(true);
      setHasReviewed(true);
      invalidatePageCaches([
        makePageCacheKey('charger-detail', booking.listingId),
        'listings:active-approved',
      ]);
    } catch (err) {
      console.error('[EV-Net] Failed to submit review:', err);
      setReviewError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const loadErrorMessage = loadError?.message || 'Could not load booking details.';

  if (loading && !booking) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading booking...</div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/app/bookings')} style={{ marginBottom: '1rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h2 style={{ marginTop: 0 }}>Booking not found</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{loadErrorMessage || 'This booking may no longer be available.'}</p>
            <button className="btn btn-secondary" onClick={() => refreshBooking({ force: true, silent: false })}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const status = statusColors[booking.status] || statusColors.PENDING;
  const payStatus = paymentStatusMap[booking.paymentStatus] || { label: booking.paymentStatus || 'Not recorded', color: 'var(--text-secondary)' };
  const needsProof = ['unpaid', 'pay_later', 'payment_due', 'rejected'].includes(booking.paymentStatus);
  const imageUrl = booking.listing?.images?.[0];
  const canReview = booking.status === 'COMPLETED' && !hasReviewed && !reviewSubmitted && user?.id;

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/app/bookings')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => refreshBooking({ force: true })}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        {(isRefreshing || loadError) && (
          <div style={{ color: loadError ? '#fbbf24' : 'var(--brand-cyan)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {loadError ? 'Could not refresh. Showing cached booking details.' : 'Refreshing booking details...'}
          </div>
        )}

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div style={{
              width: '132px',
              height: '104px',
              borderRadius: '10px',
              background: imageUrl ? `url(${imageUrl}) center/cover` : '#222',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '2rem' }}>
                    {booking.listing?.title || 'Booking'}
                  </h1>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} />
                    {booking.date} - {formatTime12h(booking.startTime)} to {formatTime12h(booking.endTime)}
                  </div>
                  {(booking.listing?.area || booking.listing?.city) && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={16} />
                      {[booking.listing?.area, booking.listing?.city].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: payStatus.color, border: `1px solid ${payStatus.color}44` }}>
                    {payStatus.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} /> Payment
              </h3>
              <div style={moneyRowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>User paid</span>
                <strong style={{ color: 'var(--brand-green)' }}>{formatPKR(booking.userTotal)}</strong>
              </div>
              <div style={moneyRowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>Platform fee</span>
                <span>{formatPKR((booking.userServiceFee || 0) + (booking.hostPlatformFee || 0))}</span>
              </div>
              <div style={moneyRowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment method</span>
                <span>{booking.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : booking.paymentMethod || 'Not recorded'}</span>
              </div>
            </div>

            <div>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Booking Details</h3>
              <div style={moneyRowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>Booking ID</span>
                <span>{String(booking.id).slice(0, 8)}</span>
              </div>
              <div style={moneyRowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>Estimated energy</span>
                <span>{booking.estimatedKwh ? `${booking.estimatedKwh} kWh` : 'Not recorded'}</span>
              </div>
              <div style={moneyRowStyle}>
                <span style={{ color: 'var(--text-secondary)' }}>Pricing band</span>
                <span>{booking.pricingBand || 'Not recorded'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {uploadError && (
              <div style={{ width: '100%', color: '#f87171', fontSize: '0.85rem' }}>
                {uploadError}
              </div>
            )}
            {booking.listingId && booking.status !== 'CANCELLED' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMessageHost}
                disabled={messaging}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <MessageSquare size={16} />
                {messaging ? 'Opening...' : 'Message Host'}
              </button>
            )}
            {booking.listingId && (
              <button type="button" className="btn btn-secondary" onClick={() => navigate(`/app/charger/${booking.listingId}`)}>
                View Charger
              </button>
            )}
            {needsProof && (
              <label className="btn btn-secondary" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? 'Uploading...' : 'Upload Payment Proof'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={(e) => handleUploadProof(e.target.files[0])}
                />
              </label>
            )}
          </div>
        </div>

        {/* ─── Review Section ─────────────────────────────── */}
        {booking.status === 'COMPLETED' && (
          <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={18} color="#fbbf24" /> Rate Your Experience
            </h3>

            {reviewSubmitted ? (
              <div style={{
                padding: '1.5rem', borderRadius: '12px',
                background: 'rgba(0, 210, 106, 0.08)', border: '1px solid rgba(0, 210, 106, 0.25)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.3rem' }}>Thank you for your review!</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Your feedback helps other EV drivers find the best chargers.
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={20} fill={s <= reviewRating ? '#fbbf24' : 'transparent'} color={s <= reviewRating ? '#fbbf24' : 'rgba(255,255,255,0.15)'} />
                  ))}
                </div>
                {reviewComment && (
                  <div style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    "{reviewComment}"
                  </div>
                )}
              </div>
            ) : hasReviewed ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem 0' }}>
                ✓ You've already reviewed this booking. Thank you!
              </div>
            ) : canReview ? (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>How was your charging experience?</div>
                  <StarRating rating={reviewRating} onRate={setReviewRating} disabled={submittingReview} />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <textarea
                    placeholder="Tell other EV drivers about your experience..."
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    disabled={submittingReview}
                    maxLength={500}
                    style={{
                      width: '100%', minHeight: '100px', padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
                      borderRadius: '10px', color: '#fff', fontSize: '0.9rem',
                      fontFamily: 'var(--font-body)', resize: 'vertical',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--brand-green)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {reviewComment.length}/500
                  </div>
                </div>

                {reviewError && (
                  <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{reviewError}</div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitReview}
                  disabled={submittingReview || reviewRating === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Star size={16} />
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0.5rem 0' }}>
                Log in to leave a review for this booking.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDetail;
