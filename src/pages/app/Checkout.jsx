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
  const { user } = useAuthStore();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [paymentStep, setPaymentStep] = useState('summary'); // 'summary' | 'payment'
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER'); // 'BANK_TRANSFER' | 'PAY_AFTER_CHARGING'
  const [proofFile, setProofFile] = useState(null);

  // Extract params
  const date = searchParams.get('date');
  const startTime = searchParams.get('start');
  const duration = parseInt(searchParams.get('duration') || '2');
  const vehicleSize = searchParams.get('vehicleSize') || 'SMALL';

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const data = await listingService.getById(chargerId);
        setListing(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load charger details.');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [chargerId]);

  const formatTime12h = (time24) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h === 0 ? 12 : h;
    return `${h}:${mStr} ${ampm}`;
  };

  const getEndTime = (start, dur) => {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const endH = (h + dur) % 24;
    return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const endTime = getEndTime(startTime, duration);
  const isVehicleSizeValid = !!VEHICLE_SIZES[vehicleSize];
  const currentBand = getPricingBand(startTime);
  
  // Calculate Fees
  const hasEnergyPricing = listing?.priceDayPerKwh !== undefined;
  const fees = hasEnergyPricing 
    ? calculateEnergyBookingFees(vehicleSize, currentBand, listing.priceDayPerKwh, listing.priceNightPerKwh)
    : calculateBookingFees(listing?.pricePerHour || 0, duration);

  const energyKwh = ENERGY_BY_SIZE[vehicleSize];
  const vehicleLabel = vehicleSize.charAt(0) + vehicleSize.slice(1).toLowerCase();

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

    if (paymentStep === 'summary') {
      setPaymentStep('payment');
      return;
    }

    if (paymentMethod === 'BANK_TRANSFER' && !proofFile) {
      setError('Please upload payment proof for bank transfer.');
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
        paymentMethod,
        paymentProofFile: proofFile
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

  if (loading) return <div className="section text-center"><div className="spinner" style={{ margin: '100px auto' }}></div></div>;
  if (!listing) return <div className="section text-center"><h2 style={{ marginTop: '100px' }}>Charger not found</h2><button onClick={() => navigate('/app/explore')} className="btn btn-primary">Go Back</button></div>;

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
                    <div style={{ width: '120px', height: '85px', borderRadius: '16px', background: listing.images?.[0] ? `url(${listing.images[0]}) center/cover` : '#222', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{duration} hr session window</div>
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

                  {paymentStep === 'payment' && (
                    <div style={{ marginBottom: '2.5rem', animation: 'fadeIn 0.4s ease' }}>
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '1px', marginBottom: '1.25rem' }}>Select Payment Method</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div 
                          onClick={() => setPaymentMethod('BANK_TRANSFER')}
                          style={{ padding: '1rem', borderRadius: '16px', border: paymentMethod === 'BANK_TRANSFER' ? '2px solid var(--brand-green)' : '1px solid var(--border-color)', background: paymentMethod === 'BANK_TRANSFER' ? 'rgba(0, 210, 106, 0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px' }}
                        >
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--brand-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {paymentMethod === 'BANK_TRANSFER' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-green)' }} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Bank Transfer</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Submit screenshot after transfer</div>
                          </div>
                        </div>

                        <div 
                          onClick={() => setPaymentMethod('PAY_AFTER_CHARGING')}
                          style={{ padding: '1rem', borderRadius: '16px', border: paymentMethod === 'PAY_AFTER_CHARGING' ? '2px solid var(--brand-cyan)' : '1px solid var(--border-color)', background: paymentMethod === 'PAY_AFTER_CHARGING' ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px' }}
                        >
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--brand-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {paymentMethod === 'PAY_AFTER_CHARGING' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-cyan)' }} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Pay After Charging</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pay once the session ends</div>
                          </div>
                        </div>
                      </div>

                      {paymentMethod === 'BANK_TRANSFER' ? (
                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                          <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#fff' }}>EV-Net Bank Details</h5>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>Bank: <strong>Meezan Bank Ltd.</strong></div>
                            <div>Name: <strong>EV-Net Solutions</strong></div>
                            <div>Account: <strong>0210-0104678901</strong></div>
                            <div>IBAN: <strong>PK21 MEZN 0002 1001 0467 8901</strong></div>
                          </div>
                          <div style={{ marginTop: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--brand-green)' }}>UPLOAD PROOF</label>
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={e => setProofFile(e.target.files[0])}
                              style={{ width: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                            />
                            {proofFile && <div style={{ marginTop: '5px', fontSize: '0.75rem', color: 'var(--brand-green)' }}>✓ {proofFile.name} attached</div>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                           <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--brand-cyan)', lineHeight: 1.4 }}>
                             <strong>Note:</strong> You can pay after your charging session. Payment proof will be required after completion.
                           </p>
                        </div>
                      )}
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
                    {processing ? 'Processing...' : paymentStep === 'summary' ? 'Confirm Session' : paymentMethod === 'BANK_TRANSFER' ? 'Reserve & Submit Proof' : 'Reserve Now'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} color="var(--brand-green)" /> Secure Manual Payment Verification
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
