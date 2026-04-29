import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, CheckCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { hostService, listingService, profileService } from '../../data/api';
import Avatar from '../../components/ui/Avatar';
import { ChargerType } from '../../data/schema';
import { PakistanCitiesSorted, normalizeCityName } from '../../data/pakistanLocations';
import { getActivationFeeBreakdown, formatPKR } from '../../data/feeConfig';
import ValidatedInput from '../../components/ui/ValidatedInput';
import FileUploadDropzone from '../../components/ui/FileUploadDropzone';
import SearchableSelect from '../../components/ui/SearchableSelect';
import TimePickerModal from '../../components/ui/TimePickerModal';
import ListingLocationPicker from '../../components/ui/ListingLocationPicker';
import '../../styles/auth.css';

const HostOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const totalSteps = 8;
  const feeBreakdown = getActivationFeeBreakdown();

  const [profile, setProfile] = useState({
    phone: user?.phone || '', identityDoc: '', city: 'Karachi',
  });
  const [charger, setCharger] = useState({
    address: '', area: '', chargerType: '7kW AC Type 2', description: '',
    amenities: [], houseRules: '',
    lat: null, lng: null
  });
  
  // Track if user manually changed city/area to prevent reverse-geocoding overrides
  const [manualCity, setManualCity] = useState(false);
  const [manualArea, setManualArea] = useState(false);

  const [pricing, setPricing] = useState({ priceDay: 40, priceNight: 60 });
  
  // Refined Time State: Store as HH:mm internally
  const [timeState, setTimeState] = useState({
    start: '09:00',
    end: '18:00'
  });

  // Modal State for Time Picker
  const [modalOpen, setModalOpen] = useState(false);
  const [activePicker, setActivePicker] = useState('start');

  const [schedule, setSchedule] = useState({
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false },
  });
  
  // File states
  const [isUploading, setIsUploading] = useState(false);
  const [payment, setPayment] = useState({
    method: 'BANK_TRANSFER', // default
    screenshot: null,
    card: { number: '', expiry: '', cvc: '' }
  });

  const [chargerPhotos, setChargerPhotos] = useState([]);
  const [propertyProofs, setPropertyProofs] = useState([]);

  const amenityOptions = ['WiFi Available', 'CCTV Security', 'Covered Parking', 'Restroom Access', 'Drinking Water', 'Gated Community', 'Near Restaurants', 'Garden Seating', 'Overnight Available'];

  const handleSaveAndExit = () => {
    navigate('/host/dashboard');
  };

  const handlePublish = async () => {
    try {
      // 1. Create the listing
      const listing = await listingService.create({
        hostId: user?.id,
        title: `${charger.chargerType} in ${charger.area}`,
        description: charger.description,
        city: profile.city,
        area: charger.area,
        chargerType: charger.chargerType,
        priceDay: pricing.priceDay,
        priceNight: pricing.priceNight,
        amenities: charger.amenities,
        houseRules: charger.houseRules.split('\n').filter(r => r.trim()),
        address: charger.address,
        lat: charger.lat,
        lng: charger.lng,
        images: chargerPhotos // Now passing photos to creation
      });

      // 2. Handle Payment Submission
      await hostService.submitOnboardingPayment(user?.id, {
        method: payment.method,
        amount: feeBreakdown.total,
        screenshot: payment.screenshot,
        card: payment.card
      });

      // 3. Submit overall verification
      await hostService.submitVerification(user?.id);
      
      navigate('/host/dashboard');
    } catch (e) {
      console.error("Failed to publish listing:", e);
      alert("Failed to save listing details. Please check your connection and try again.");
    }
  };

  const stepNames = ['Profile', 'Charger Info', 'Amenities & Rules', 'Proof Upload', 'Pricing', 'Availability', 'Review', 'Payment'];

  const formatDisplayTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  // Manual step validation
  const validateStep = (s) => {
    if (s === 1) return profile.phone && profile.identityDoc && profile.identityDoc.length === 15;
    if (s === 2) return charger.address && charger.area && profile.city && charger.lat && charger.lng;
    if (s === 3) return true;
    if (s === 4) return chargerPhotos.length > 0 && propertyProofs.length > 0;
    if (s === 5) return pricing.priceDay >= 10 && pricing.priceNight >= 10;
    if (s === 6) {
      const anyDaySelected = Object.values(schedule.days).some(d => d);
      return anyDaySelected && timeState.start < timeState.end;
    }
    if (s === 7) return true;
    if (s === 8) {
      if (payment.method === 'BANK_TRANSFER') return payment.screenshot;
      if (payment.method === 'CARD') return payment.card.number && payment.card.expiry && payment.card.cvc;
      return false;
    }
    return true;
  };

  const handleContinue = (nextStep) => {
    if (validateStep(step)) {
      setStep(nextStep);
      setShowErrors(false);
      window.scrollTo(0, 0);
    } else {
      setShowErrors(true);
    }
  };

  return (
    <div className="auth-page" style={{ background: 'var(--bg-main)' }}>
      <div style={{ margin: 'auto', maxWidth: '600px', width: '100%', padding: '2rem 1.5rem' }}>
        
        {/* Progress Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.25rem' }}>
              Host Onboarding
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Step {step} of {totalSteps}: {stepNames[step - 1]}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={handleSaveAndExit} className="btn-exit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Save & Exit
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
              <CheckCircle size={10} color="var(--brand-green)" />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Draft saved</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '2.5rem' }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '2px', background: step > i ? 'var(--brand-green)' : step === i + 1 ? 'var(--brand-cyan)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div className="glass-card" style={{ padding: '2.5rem' }}>
          
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Complete Your Profile</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Verify your identity to build trust with EV users.</p>

              <ValidatedInput label="Full Name" value={user?.name || ''} disabled onChange={() => {}} />
              <ValidatedInput label="Phone Number" format="phone" placeholder="03XXXXXXXXX" required value={profile.phone} onChange={v => setProfile({...profile, phone: v})} forceError={showErrors} />
              <ValidatedInput label="CNIC Number" format="cnic" placeholder="XXXXX-XXXXXXX-X" required value={profile.identityDoc} onChange={v => setProfile({...profile, identityDoc: v})} forceError={showErrors} />
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={handleSaveAndExit} style={{ flex: 1 }}>Exit</button>
                <button className="btn btn-primary" onClick={() => handleContinue(2)} style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Charger Info */}
          {step === 2 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Charger Location</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Search for your address and drag the pin to your exact parking spot.</p>
              </div>

              <ListingLocationPicker 
                initialValue={charger.address}
                initialLat={charger.lat || 31.5204}
                initialLng={charger.lng || 74.3587}
                onLocationChange={(loc) => {
                  const updates = { 
                    address: loc.address || charger.address,
                    lat: loc.lat, 
                    lng: loc.lng 
                  };
                  
                  // Only update city/area if they haven't been manually touched
                  if (!manualCity && loc.city) {
                    const normalized = normalizeCityName(loc.city);
                    setProfile(p => ({ ...p, city: normalized }));
                  }
                  if (!manualArea && loc.area) {
                    updates.area = loc.area;
                  }
                  
                  setCharger(prev => ({ ...prev, ...updates }));
                }}
              />

              <div className="auth-row" style={{ display: 'flex', gap: '1rem', width: '100%', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect 
                    label="City" 
                    city={profile.city} 
                    required 
                    options={PakistanCitiesSorted.map(c => c.city)} 
                    value={profile.city} 
                    onChange={v => {
                      setProfile({...profile, city: v, area: ''});
                      setManualCity(true);
                    }} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <SearchableSelect 
                    label="Area" 
                    required 
                    options={PakistanCitiesSorted.find(c => c.city === profile.city)?.areas || []} 
                    placeholder={profile.city ? "Select area" : "Select city first"} 
                    value={charger.area} 
                    onChange={v => {
                      setCharger({...charger, area: v});
                      setManualArea(true);
                    }} 
                    disabled={!profile.city} 
                  />
                  {showErrors && !charger.area && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '0.4rem' }}>Area is required</p>}
                </div>
              </div>

              <div className="auth-field" style={{ marginBottom: '1.25rem' }}>
                <label>Charger Type / Speed <span style={{ color: 'var(--brand-cyan)' }}>*</span></label>
                <select className="auth-select" value={charger.chargerType} onChange={e => setCharger({...charger, chargerType: e.target.value})}>
                  {Object.values(ChargerType).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="auth-field" style={{ marginBottom: '1.25rem' }}>
                <label>Description</label>
                <textarea className="auth-input" rows={3} placeholder="Describe your setup..." value={charger.description} onChange={e => setCharger({...charger, description: e.target.value})} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => handleContinue(3)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Amenities & Rules */}
          {step === 3 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Details & Amenities</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Show drivers what makes your spot convenient.</p>
              </div>
              <div className="auth-field">
                <label style={{ marginBottom: '1rem', display: 'block' }}>Amenities</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {amenityOptions.map(a => {
                    const isSelected = charger.amenities.includes(a);
                    return (
                      <button key={a} type="button" onClick={() => setCharger({...charger, amenities: isSelected ? charger.amenities.filter(x => x !== a) : [...charger.amenities, a]})}
                        style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: isSelected ? '1px solid var(--brand-green)' : '1px solid var(--border-color)', background: isSelected ? 'rgba(0,210,106,0.15)' : 'transparent', color: isSelected ? 'var(--brand-green)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="auth-field">
                <label>House Rules (one per line)</label>
                <textarea className="auth-input" rows={3} placeholder="e.g. Park in designated spot" value={charger.houseRules} onChange={e => setCharger({...charger, houseRules: e.target.value})} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => handleContinue(4)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 4: Proof Upload */}
          {step === 4 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Upload Proof</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Maintain trust by verifying property ownership.</p>
              <FileUploadDropzone label="Charger Setup Photo" mode="image" files={chargerPhotos} onChange={setChargerPhotos} />
              {showErrors && chargerPhotos.length === 0 && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>Charger photo is required</p>}
              <FileUploadDropzone label="Property Proof (Bill/Deed)" files={propertyProofs} onChange={setPropertyProofs} />
              {showErrors && propertyProofs.length === 0 && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>Property proof is required</p>}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => handleContinue(5)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 5: Pricing */}
          {step === 5 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Set Your Pricing</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Choose fair rates per kWh. Solar availability makes day rates cheaper.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <ValidatedInput 
                    label="Day Rate (per kWh)" 
                    format="money" 
                    min={5} max={500} 
                    required 
                    compact
                    value={pricing.priceDay} 
                    onChange={v => setPricing({...pricing, priceDay: v})} 
                    forceError={showErrors}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>08:00 AM - 08:00 PM (Solar cheaper)</p>
                </div>
                <div style={{ flex: 1 }}>
                  <ValidatedInput 
                    label="Night Rate (per kWh)" 
                    format="money" 
                    min={5} max={500} 
                    required 
                    compact
                    value={pricing.priceNight} 
                    onChange={v => setPricing({...pricing, priceNight: v})} 
                    forceError={showErrors}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>08:00 PM - 08:00 AM (Grid only)</p>
                </div>
              </div>

              <div style={{ background: 'rgba(0,210,106,0.05)', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <strong style={{ color: '#fff' }}>Solar-First Network:</strong> Hosts typically set day rates ~30% lower to encourage daytime charging when solar yield is highest. 
                  <br />
                  <span style={{ display: 'block', marginTop: '0.5rem' }}>
                    <strong style={{ color: '#fff' }}>You'll earn ~85%</strong> of the energy fee. Estimated day payout: <strong style={{ color: 'var(--brand-green)', fontSize: '1.1rem' }}>{formatPKR(Math.round((pricing.priceDay || 0) * 0.85))}/kWh</strong>
                  </span>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(4)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => handleContinue(6)} style={{ flex: 2 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 6: Availability (REFINED - PILLS + MODAL) */}
          {step === 6 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Available Days</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Choose which days drivers can book your spot.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2.5rem' }}>
                {Object.entries(schedule.days).map(([day, active]) => (
                  <div key={day} onClick={() => setSchedule({...schedule, days: {...schedule.days, [day]: !active}})}
                    style={{ 
                      padding: '0.8rem 1.4rem', border: `1px solid ${active ? 'var(--brand-green)' : 'var(--border-color)'}`, 
                      background: active ? 'rgba(0,210,106,0.15)' : 'transparent', 
                      color: active ? 'var(--brand-green)' : 'var(--text-secondary)', 
                      borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontSize: '0.95rem' 
                    }}>
                    {day}
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <h3 style={{ margin: '0 0 1.5rem 0' }}>Service Hours</h3>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
                  <div 
                    onClick={() => { setActivePicker('start'); setModalOpen(true); }}
                    style={{ 
                      flex: 1, padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-cyan)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatDisplayTime(timeState.start)}</span>
                  </div>
                  
                  <div style={{ color: 'var(--border-color)', fontSize: '1.5rem', fontWeight: 300 }}>&mdash;</div>

                  <div 
                    onClick={() => { setActivePicker('end'); setModalOpen(true); }}
                    style={{ 
                      flex: 1, padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-cyan)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatDisplayTime(timeState.end)}</span>
                  </div>
                </div>
              </div>

              {showErrors && timeState.start >= timeState.end && (
                <p style={{ color: '#fb7185', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center', marginTop: '-1.5rem' }}>End time must be after start time</p>
              )}
              
              <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.1)', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
                <Info size={18} color="var(--brand-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
                  You can fine-tune these hours or set custom schedules for specific days later in your host dashboard.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(5)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => handleContinue(7)} style={{ flex: 2 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Final Review</h3>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold' }}>{charger.chargerType} in {charger.area}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Address: {charger.address}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pricing: PKR {pricing.priceDay}/kWh (Day) • PKR {pricing.priceNight}/kWh (Night)</p>
              </div>
              <div style={{ padding: '1.25rem', background: 'rgba(0,210,106,0.05)', borderRadius: '12px', border: '1px solid rgba(0,210,106,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Activation Fee</span>
                  <span>{formatPKR(feeBreakdown.total)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(6)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => handleContinue(8)} style={{ flex: 2 }}>Proceed to Payment</button>
              </div>
            </div>
          )}

          {/* Step 8: Payment */}
          {step === 8 && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Activation Payment</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-1rem' }}>Choose how you'd like to pay the one-time activation fee.</p>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className={`btn ${payment.method === 'BANK_TRANSFER' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setPayment({...payment, method: 'BANK_TRANSFER'})}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                >
                  Bank Transfer
                </button>
                <button 
                  className={`btn ${payment.method === 'CARD' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setPayment({...payment, method: 'CARD'})}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                >
                  Credit/Debit Card
                </button>
              </div>

              {payment.method === 'BANK_TRANSFER' ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Transfer <strong>{formatPKR(feeBreakdown.total)}</strong> to:</p>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                    <p style={{ margin: 0 }}><strong>Bank:</strong> Meezan Bank Ltd.</p>
                    <p style={{ margin: 0 }}><strong>Account:</strong> EV-Net Solutions</p>
                    <p style={{ margin: 0 }}><strong>Account #:</strong> 0210-XXXXXXXXXX</p>
                    <p style={{ margin: 0 }}><strong>IBAN:</strong> PK21MEZNXXXXXXXXXXXXXXXX</p>
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    <FileUploadDropzone 
                      label="Upload Payment Screenshot" 
                      mode="image" 
                      files={payment.screenshot ? [payment.screenshot] : []} 
                      onChange={(files) => setPayment({...payment, screenshot: files[0]})} 
                    />
                    {showErrors && !payment.screenshot && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '0.4rem' }}>Payment proof is required</p>}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <ValidatedInput 
                    label="Card Number" 
                    placeholder="4242 4242 4242 4242" 
                    value={payment.card.number} 
                    onChange={v => setPayment({...payment, card: {...payment.card, number: v}})}
                    forceError={showErrors}
                    required
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <ValidatedInput 
                        label="Expiry" 
                        placeholder="MM/YY" 
                        value={payment.card.expiry} 
                        onChange={v => setPayment({...payment, card: {...payment.card, expiry: v}})}
                        forceError={showErrors}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <ValidatedInput 
                        label="CVC" 
                        placeholder="123" 
                        type="password"
                        value={payment.card.cvc} 
                        onChange={v => setPayment({...payment, card: {...payment.card, cvc: v}})}
                        forceError={showErrors}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(7)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handlePublish} style={{ flex: 2 }}>Pay & Submit</button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <TimePickerModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        activeValue={timeState[activePicker]}
        onSelect={(val) => setTimeState({ ...timeState, [activePicker]: val })}
        label={activePicker === 'start' ? 'Start Availability' : 'End Availability'}
      />
    </div>
  );
};

export default HostOnboarding;
