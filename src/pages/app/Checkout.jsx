import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { listingService, bookingService } from '../../data/api';
import { calculateBookingFees, formatPKR } from '../../data/feeConfig';
import useAuthStore from '../../store/authStore';

const Checkout = () => {
  const { chargerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listing, setListing] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const startTime = searchParams.get('start') || '14:00';
  const duration = parseInt(searchParams.get('duration') || '2');
  const endHour = parseInt(startTime.split(':')[0]) + duration;
  const endTime = `${String(endHour).padStart(2, '0')}:00`;

  useEffect(() => {
    listingService.getById(chargerId).then(setListing);
  }, [chargerId]);

  if (!listing) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;

  const fees = calculateBookingFees(listing.pricePerHour, duration);

  const formatTime = (time24) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h === 0 ? 12 : h;
    return `${h}:${mStr} ${ampm}`;
  };

  const handleConfirm = async () => {
    setProcessing(true);
    setError('');
    try {
      await bookingService.create({
        userId: user?.id || 'user_ali',
        listingId: chargerId,
        date,
        startTime,
        endTime,
      });
      setConfirmed(true);
      setTimeout(() => navigate('/app/bookings'), 2500);
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex' }}>
      <div className="container" style={{ margin: 'auto', maxWidth: '600px', width: '100%' }}>
        
        {confirmed ? (
          <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'var(--brand-green)', borderRadius: '50%', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '2rem', animation: 'fadeInV 0.5s' }}>
              ✓
            </div>
            <h2 style={{ marginBottom: '1rem' }}>Booking Confirmed!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Your charger has been reserved. Redirecting to your bookings...</p>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '2rem', position: 'relative' }}>
            {/* Back Button */}
            <button onClick={() => navigate(-1)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: 'none', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.9rem',
              marginBottom: '1rem', padding: 0, transition: 'color 0.2s'
            }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>&larr;</span> Back to Slot Selection
            </button>

            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '1.5rem' }}>Confirm Booking</h2>
            
            {/* Listing Summary */}
            <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '1.5rem', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '45px', borderRadius: '6px', background: `url(${listing.images?.[0]}) center/cover`, backgroundColor: '#222', flexShrink: 0 }} />
              <div>
                <h4 style={{ marginBottom: '0.2rem', fontSize: '1rem' }}>{listing.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  {date} • {formatTime(startTime)} – {formatTime(endTime)} ({duration} hour{duration > 1 ? 's' : ''})
                </p>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            {/* Fee Breakdown */}
            <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '1.5rem 0', marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Fee Summary</h4>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Base Charging Fee ({duration} hr{duration > 1 ? 's' : ''} × {formatPKR(listing.pricePerHour)})</span>
                <span>{formatPKR(fees.baseFee)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Platform Service Fee 
                  <span style={{ fontSize: '0.7rem', background: 'rgba(0, 210, 106, 0.2)', color: 'var(--brand-green)', padding: '2px 6px', borderRadius: '4px' }}>Required</span>
                </span>
                <span>{formatPKR(fees.serviceFee)}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic' }}>
                The service fee helps us run the platform and provide 24/7 customer support.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                <span>Total Payable</span>
                <span style={{ color: 'var(--brand-green)' }}>{formatPKR(fees.totalFee)}</span>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleConfirm} disabled={processing} style={{ width: '100%', fontSize: '1.1rem' }}>
              {processing ? 'Processing...' : 'Confirm Payment & Book Slot'}
            </button>
            <p className="text-center" style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              You won't be charged until the host accepts the booking if required.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Checkout;
