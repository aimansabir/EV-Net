import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { listingService, bookingService } from '../../data/api';
import { 
  calculateEnergyBookingFees, 
  getPricingBand, 
  PRICING_BAND, 
  VEHICLE_SIZES, 
  ENERGY_BY_SIZE,
  formatPKR,
  calculateBookingFees
} from '../../data/feeConfig';
import { 
  Calendar, Clock, Zap, Moon, ShieldCheck, ArrowLeft, 
  Info, AlertTriangle, CheckCircle, Car, MapPin
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { canBook } from '../../utils/accessControl';

const Checkout = () => {
  const { chargerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const { user } = useAuthStore();

  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const startTime = searchParams.get('start') || '';
  const duration = parseInt(searchParams.get('duration') || '2');
  const vehicleSize = searchParams.get('vehicleSize') || '';
  const isVehicleSizeValid = Object.values(VEHICLE_SIZES).includes(vehicleSize);
  
  // End time calculation for scheduling
  const endHour = startTime ? (parseInt(startTime.split(':')[0]) + duration) % 24 : null;
  const endTime = endHour === null ? '' : `${String(endHour).padStart(2, '0')}:00`;

  useEffect(() => {
    listingService.getById(chargerId).then(setListing);
  }, [chargerId]);

  if (!listing) return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
    </div>
  );

  // Pricing Logic (Same as ChargerDetail)
  const currentBand = startTime ? getPricingBand(startTime) : PRICING_BAND.DAY;
  const energyFees = calculateEnergyBookingFees(
    isVehicleSizeValid ? vehicleSize : VEHICLE_SIZES.SMALL, 
    currentBand, 
    listing.priceDay, 
    listing.priceNight
  );

  const hasEnergyPricing = !energyFees.isIncomplete;
  
  let fees;
  if (hasEnergyPricing) {
    fees = energyFees;
  } else {
    // Final Legacy Fallback (using old hourly model)
    const legacyFees = calculateBookingFees(listing.pricePerHour, duration);
    fees = {
      baseCharge: legacyFees.baseFee,
      userServiceFee: legacyFees.serviceFee,
      userTotal: legacyFees.totalFee,
      isLegacy: true,
      reason: energyFees.error, // e.g. MISSING_RATE
      rateUsed: listing.pricePerHour,
    };
  }

  const vehicleLabel = vehicleSize === VEHICLE_SIZES.LARGE ? 'Large SUV / Truck' : vehicleSize === VEHICLE_SIZES.MEDIUM ? 'Sedan / Crossover' : vehicleSize === VEHICLE_SIZES.SMALL ? 'Small / City Car' : 'Not selected';
  const energyKwh = ENERGY_BY_SIZE[isVehicleSizeValid ? vehicleSize : VEHICLE_SIZES.SMALL];

  const formatTime12h = (time24) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h === 0 ? 12 : h;
    return `${h}:${mStr} ${ampm}`;
  };

  const handleConfirm = async () => {
    if (processing) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!canBook(user)) {
      setError('Complete account verification before reserving a charger.');
      return;
    }
    if (!startTime) {
      setError('Please select an arrival time before reserving.');
      return;
    }
    if (!isVehicleSizeValid) {
      setError('Please select a vehicle option before reserving.');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      await bookingService.create({
        listingId: chargerId,
        date,
        startTime,
        endTime,
        vehicleSize,
      });
      setConfirmed(true);
      setTimeout(() => navigate('/app/bookings'), 2500);
    } catch (err) {
      const message = err.message || '';
      if (message.toLowerCase().includes('overlap')) {
        setError('That time slot was just reserved. Please choose another arrival time.');
      } else if (message.toLowerCase().includes('verified')) {
        setError('Complete account verification before reserving a charger.');
      } else {
        setError(message || 'Could not create booking. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)', background: 'radial-gradient(circle at top right, rgba(0, 240, 255, 0.05), transparent 400px)' }}>
      <div className="container" style={{ maxWidth: '850px', paddingTop: '2rem', paddingBottom: '4rem' }}>
        
        {confirmed ? (
          <div className="glass-card text-center" style={{ padding: '5rem 2rem', borderRadius: '32px' }}>
            <div style={{ width: '90px', height: '90px', background: 'var(--brand-green)', borderRadius: '50%', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem', fontSize: '2.5rem', boxShadow: '0 0 30px rgba(0, 210, 106, 0.4)' }}>
              <CheckCircle size={40} />
            </div>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '1rem', fontWeight: 800 }}>Booking Confirmed!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Your charger has been reserved. Redirecting to your bookings...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <button onClick={() => navigate(-1)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                  padding: 0, transition: 'all 0.2s', marginBottom: '1.25rem'
                }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                  <ArrowLeft size={16} /> Back to Charger
                </button>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, lineHeight: 1.1, color: '#fff', letterSpacing: '-0.5px' }}>Review Booking</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1.05rem', fontWeight: 500 }}>Please verify your session details before confirming.</p>
              </div>
              <div style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800 }}>Step 2 of 2</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                  <div style={{ width: '24px', height: '4px', borderRadius: '2px', background: 'var(--brand-green)', opacity: 0.3 }} />
                  <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--brand-green)' }} />
                </div>
              </div>
            </div>

                    {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '1.25rem', borderRadius: '16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <AlertTriangle size={20} />
                {error}
              </div>
            )}
            {(!startTime || !isVehicleSizeValid) && (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', padding: '1.25rem', borderRadius: '16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <AlertTriangle size={20} />
                Go back to the charger page and choose an arrival time and vehicle option before confirming.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2.5rem', alignItems: 'start' }}>
              {/* Left Column: Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 1. Listing Summary */}
                <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ width: '120px', height: '85px', borderRadius: '16px', background: `url(${listing.images?.[0]}) center/cover`, border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{listing.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <MapPin size={16} color="var(--brand-green)" />
                        {listing.area}, {listing.city}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Session Detail Grid */}
                <div className="glass-card" style={{ padding: '2rem', borderRadius: '24px' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '1px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Clock size={14} color="var(--brand-green)" /> Reservation Window
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    
                    <div style={{ display: 'flex', gap: '14px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        <Calendar size={20} color="var(--brand-green)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '2px' }}>Date</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '14px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        <Zap size={20} color="var(--brand-green)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '2px' }}>Arrival Time</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatTime12h(startTime)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>2 hr session window</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '14px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        <Car size={20} color="var(--brand-green)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '2px' }}>Vehicle</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{vehicleLabel}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{vehicleSize} size class</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '14px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        {currentBand === 'DAY' ? <Zap size={20} color="var(--brand-cyan)" /> : <Moon size={20} color="#fbbf24" />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '2px' }}>Pricing Mode</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{hasEnergyPricing ? `${currentBand} Band` : 'Legacy Mode'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{hasEnergyPricing ? `${formatPKR(fees.rateUsed)} / kWh` : `${formatPKR(listing.pricePerHour)} / hr`}</div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 3. Safety Notice */}
                <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid rgba(0, 240, 255, 0.2)', background: 'rgba(0, 240, 255, 0.03)', display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <ShieldCheck size={24} color="var(--brand-cyan)" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Exact address and contact info shared instantly upon confirmation. Your safety is our priority.
                  </p>
                </div>

              </div>

              {/* Right Column: Checkout Card */}
              <div style={{ position: 'sticky', top: '100px' }}>
                <div className="glass-card" style={{ padding: '2rem', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '2rem' }}>Total Payable</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        {hasEnergyPricing ? `Energy Usage (${energyKwh} kWh)` : `Session Duration (${duration} hrs)`}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{formatPKR(fees.baseCharge)}</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Platform Service Fee</span>
                        <div className="tooltip-trigger" title="Covers 24/7 support and platform maintenance."><Info size={14} style={{ opacity: 0.3 }} /></div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{formatPKR(fees.userServiceFee)}</div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Total Amount</div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--brand-green)', lineHeight: 1 }}>{formatPKR(fees.userTotal)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Incl. all taxes & fees</div>
                      </div>
                    </div>

                  </div>

                  {fees.isLegacy && (
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', marginBottom: '1.5rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>
                         <AlertTriangle size={12} /> Legacy Listing
                       </div>
                       <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                         This host uses legacy hourly pricing. Energy estimation is not available.
                       </p>
                    </div>
                  )}

                  <button 
                    onClick={handleConfirm}
                    disabled={processing || !startTime || !isVehicleSizeValid}
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      padding: '1.25rem', 
                      fontSize: '1.15rem', 
                      fontWeight: 800, 
                      borderRadius: '16px', 
                      boxShadow: '0 12px 30px rgba(0, 210, 106, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {processing ? 'Processing Booking...' : 'Confirm Reservation'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} color="var(--brand-green)" /> Payment handled upon arrival
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
