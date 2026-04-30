import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, CheckCircle } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { hostService, listingService, verificationService } from '../../data/api';
import { ChargerType } from '../../data/schema';
import { PakistanCitiesSorted, normalizeCityName } from '../../data/pakistanLocations';
import { getActivationFeeBreakdown, formatPKR } from '../../data/feeConfig';
import ValidatedInput from '../../components/ui/ValidatedInput';
import FileUploadDropzone from '../../components/ui/FileUploadDropzone';
import SearchableSelect from '../../components/ui/SearchableSelect';
import TimePickerModal from '../../components/ui/TimePickerModal';
import ListingLocationPicker from '../../components/ui/ListingLocationPicker';
import { AlertCircle as ErrorIcon } from 'lucide-react';
import '../../styles/auth.css';

const ErrorMessage = ({ message, centered = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    color: '#fb7185', fontSize: '0.85rem',
    background: 'rgba(251, 113, 133, 0.08)', padding: '0.75rem 1rem',
    borderRadius: '10px', border: '1px solid rgba(251, 113, 133, 0.15)',
    marginBottom: '1.25rem',
    justifyContent: centered ? 'center' : 'flex-start',
    animation: 'shake 0.4s ease-in-out'
  }}>
    <ErrorIcon size={16} />
    <span style={{ fontWeight: 500 }}>{message}</span>
  </div>
);

const HostOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [publishStatus, setPublishStatus] = useState('');
  const totalSteps = 8;
  const feeBreakdown = getActivationFeeBreakdown();

  const [profile, setProfile] = useState({
    phone: user?.phone || '', identityDoc: '', city: 'Karachi',
  });
  const [charger, setCharger] = useState({
    address: '', houseNo: '', area: '', chargerType: '7kW AC Type 2', description: '',
    amenities: [], houseRules: '',
    lat: null, lng: null
  });
  


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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payment, setPayment] = useState({
    method: 'BANK_TRANSFER', // default
    screenshot: null,
    card: { number: '', expiry: '', cvc: '' }
  });

  const [chargerPhotos, setChargerPhotos] = useState([]);
  const [additionalPhotos, setAdditionalPhotos] = useState([]);
  const [propertyProofs, setPropertyProofs] = useState([]);
  const [onboardingListingId, setOnboardingListingId] = useState('');

  const amenityOptions = ['WiFi Available', 'CCTV Security', 'Covered Parking', 'Restroom Access', 'Drinking Water', 'Gated Community', 'Near Restaurants', 'Garden Seating', 'Overnight Available'];

  const handleSaveAndExit = () => {
    const draft = {
      profile,
      charger: { ...charger, listingId: onboardingListingId || charger.listingId },
      pricing,
      timeState,
      schedule,
      step
    };
    localStorage.setItem(`host_onboarding_draft_${user?.id}`, JSON.stringify(draft));
    navigate('/host/dashboard');
  };

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`host_onboarding_draft_${user.id}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.profile) setProfile(data.profile);
          if (data.charger) {
            setCharger(data.charger);
            if (data.charger.listingId) {
              setOnboardingListingId(data.charger.listingId);
              localStorage.setItem('currentHostOnboardingListingId', data.charger.listingId);
            }
          }
          if (data.pricing) setPricing(data.pricing);
          if (data.timeState) setTimeState(data.timeState);
          if (data.schedule) setSchedule(data.schedule);
          if (data.step) setStep(data.step);
        } catch (e) {
          console.error("Failed to restore draft:", e);
        }
      }
      const storedListingId = localStorage.getItem('currentHostOnboardingListingId');
      if (storedListingId) {
        setOnboardingListingId(storedListingId);
        setCharger(prev => ({ ...prev, listingId: prev.listingId || storedListingId }));
      }
    }
  }, [user?.id]);

  const handlePublish = async () => {
    if (isSubmitting) return;
    
    // Final validation check for Step 8
    if (!validateStep(8)) {
      console.warn("[EV-Net] handlePublish: Step 8 validation failed.");
      setShowErrors(true);
      return;
    }

    // Requirement 6: Validate payment screenshot (image type check)
    const screenshotFile = payment.screenshot?.file || payment.screenshot;
    if (screenshotFile && !screenshotFile.type?.startsWith('image/') && !screenshotFile.name?.toLowerCase().endsWith('.pdf')) {
      console.error("[EV-Net] Invalid screenshot file type:", screenshotFile.type);
      setSubmissionError("Payment proof must be an image or PDF.");
      setShowErrors(true);
      return;
    }

    setIsSubmitting(true);
    setSubmissionError('');
    setPublishStatus('Initializing...');
    console.log("[EV-Net] Starting submission flow");

    try {
      if (!user?.id) {
        throw new Error('Your session is not ready. Please refresh and log in again.');
      }

      console.log("[EV-Net] User loaded", user.id);
      setPublishStatus('Initializing host profile...');
      console.log("[EV-Net] Promoting user to host");
      await hostService.promote(user.id);
      console.log("[EV-Net] Host promotion successful");

      // Build full address: prepend house/unit number if provided
      const fullAddress = charger.houseNo
        ? `${charger.houseNo}, ${charger.address}`
        : charger.address;
      const listingTitle = `${charger.chargerType} in ${charger.area}`;
      const listingPayload = {
        hostId: user.id,
        title: listingTitle,
        description: charger.description,
        city: profile.city,
        area: charger.area,
        chargerType: charger.chargerType,
        priceDay: pricing.priceDay,
        priceNight: pricing.priceNight,
        amenities: charger.amenities,
        houseRules: charger.houseRules.split('\n').filter(r => r.trim()),
        address: fullAddress,
        lat: charger.lat,
        lng: charger.lng
      };

      // 1. Create or Reuse the listing
      console.log("[EV-Net] Checking for existing onboarding listing");
      setPublishStatus('Checking for existing listing...');
      let listingId = onboardingListingId || charger.listingId || localStorage.getItem('currentHostOnboardingListingId');
      
      if (listingId) {
        const storedListing = await listingService.getOwnedById(listingId, user.id);
        if (storedListing && !storedListing.isApproved) {
          console.log(`[EV-Net] Reusing existing listing: ${storedListing.id}`);
          listingId = storedListing.id;
        } else {
          if (storedListing?.isApproved) {
            console.warn("[EV-Net] Stored onboarding listing is already approved; ignoring for new submission.", listingId);
          }
          localStorage.removeItem('currentHostOnboardingListingId');
          listingId = null;
        }
      }

      if (!listingId) {
        const existingListing = await listingService.findExistingOnboardingListing({
          hostId: user.id,
          title: listingTitle,
          city: profile.city,
          area: charger.area,
          chargerType: charger.chargerType
        });
        if (existingListing) {
          listingId = existingListing.id;
          console.log(`[EV-Net] Reusing existing listing: ${listingId}`);
        }
      }

      if (listingId) {
        setPublishStatus('Updating listing...');
        await listingService.update(listingId, listingPayload);
      } else {
        console.log("[EV-Net] Creating new listing");
        setPublishStatus('Creating listing...');
        const newListing = await listingService.create({
          ...listingPayload,
          images: []
        });
        listingId = newListing.id;
        console.log(`[EV-Net] Created listing: ${listingId}`);
      }
      
      // Persist listingId in local state
      setOnboardingListingId(listingId);
      setCharger(prev => ({ ...prev, listingId }));
      localStorage.setItem('currentHostOnboardingListingId', listingId);
      await listingService.demoteDuplicateOnboardingListings({
        hostId: user.id,
        keepId: listingId,
        title: listingTitle,
        city: profile.city,
        area: charger.area,
        chargerType: charger.chargerType
      });

      // 2. Upload listing photos without duplicating existing rows on retry
      console.log("[EV-Net] Uploading listing photos");
      setPublishStatus('Uploading listing photos...');
      await listingService.ensureOnboardingPhotos(listingId, user.id, [
        ...chargerPhotos,
        ...additionalPhotos
      ]);

      // 3. Handle payment submission before finalizing host profile
      console.log("[EV-Net] Uploading payment proof");
      setPublishStatus('Recording payment proof...');
      const paymentResult = await hostService.submitOnboardingPayment(user.id, {
        method: 'BANK_TRANSFER',
        amount: feeBreakdown.total,
        screenshot: payment.screenshot,
        listingId
      });
      console.log("[EV-Net] Payment record created", paymentResult?.payment?.id || paymentResult);

      await listingService.markOnboardingSubmitted(listingId, user.id);

      // 4. Upload verification proofs. The RPC below owns host profile finalization.
      console.log("[EV-Net] Uploading verification documents");
      setPublishStatus('Uploading verification documents...');
      if (propertyProofs[0]?.file) {
        console.log("[EV-Net] Uploading property proof...");
        await verificationService.uploadDocument(user.id, 'HOST', 'PROPERTY_PROOF', propertyProofs[0].file, {
          updateProfileFlags: false
        });
      }
      if (chargerPhotos[0]?.file) {
        console.log("[EV-Net] Uploading charger setup photo...");
        await verificationService.uploadDocument(user.id, 'HOST', 'CHARGER_PROOF', chargerPhotos[0].file, {
          updateProfileFlags: false
        });
      }
      console.log("[EV-Net] Documents uploaded");

      console.log("[EV-Net] Finalizing onboarding");
      setPublishStatus('Finalizing onboarding...');
      await hostService.finalizeOnboarding();
      console.log("[EV-Net] Submission complete");
      
      // Clear draft on successful submit
      console.log("[EV-Net] Clearing draft and showing success step.");
      localStorage.removeItem(`host_onboarding_draft_${user.id}`);
      setPublishStatus('Your host application has been submitted and is pending admin review.');
      
      setStep(9); // Show success screen
    } catch (e) {
      console.error("[EV-Net] handlePublish failed at some step:", e);
      setSubmissionError(e.message || "Failed to save listing details. Please check your connection and try again.");
    } finally {
      console.log("[EV-Net] handlePublish finished (success or failure). Resetting loading state.");
      setIsSubmitting(false);
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
      return payment.screenshot;
    }
    if (s === 9) return true;
    return true;
  };

  const handleContinue = (nextStep) => {
    if (validateStep(step)) {
      // Save draft on every successful step continue
      const draft = {
        profile,
        charger: { ...charger, listingId: onboardingListingId || charger.listingId },
        pricing,
        timeState,
        schedule,
        step: nextStep
      };
      localStorage.setItem(`host_onboarding_draft_${user?.id}`, JSON.stringify(draft));
      
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
                  
                  // Update city/area when pin moves
                  if (loc.city) {
                    const normalized = normalizeCityName(loc.city);
                    setProfile(p => ({ ...p, city: normalized }));
                  }
                  if (loc.area) {
                    updates.area = loc.area;
                  }
                  
                  setCharger(prev => ({ ...prev, ...updates }));
                }}
                forceError={showErrors}
              />

              {/* House / Unit Number */}
              <div className="auth-field" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>House / Flat / Unit No.</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Optional</span>
                </label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. House 42, Street 5 or Flat 3B, Block C"
                  value={charger.houseNo}
                  onChange={e => setCharger({ ...charger, houseNo: e.target.value })}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  This is shared with confirmed bookings only — not shown publicly.
                </p>
              </div>

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
                    }} 
                    disabled={!profile.city} 
                  />
                  {showErrors && !charger.area && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '0.4rem' }}>Area is required</p>}
                </div>
              </div>

              <div className="auth-field" style={{ marginBottom: '1.25rem' }}>
                <label>Description</label>
                <textarea className="auth-input" rows={3} placeholder="Describe your setup..." value={charger.description} onChange={e => setCharger({...charger, description: e.target.value})} style={{ resize: 'vertical' }} />
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
              <FileUploadDropzone 
                label="Charger Setup Photo (Mandatory)" 
                mode="image" 
                files={chargerPhotos} 
                onChange={setChargerPhotos} 
                error={showErrors && chargerPhotos.length === 0 ? "Charger setup photo is required" : ""}
              />
              
              <FileUploadDropzone 
                label="Additional Photos (Optional - Socket, Driveway, etc.)" 
                mode="image" 
                multiple={true} 
                files={additionalPhotos} 
                onChange={setAdditionalPhotos} 
              />

              <FileUploadDropzone 
                label="Property Proof (Bill/Deed)" 
                files={propertyProofs} 
                onChange={setPropertyProofs} 
                error={showErrors && propertyProofs.length === 0 ? "Property ownership proof is required" : ""}
              />
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-start' }}>
                <div className="auth-field">
                  <label style={{ display: 'block', marginBottom: '0.8rem', opacity: 0.8, fontSize: '0.9rem' }}>Charger Type <span style={{ color: 'var(--brand-cyan)' }}>*</span></label>
                  <select className="auth-select" value={charger.chargerType} onChange={e => setCharger({...charger, chargerType: e.target.value})} style={{ height: '44px' }}>
                    {Object.values(ChargerType).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                
                <div>
                  <ValidatedInput 
                    label="Day Rate" 
                    format="money" 
                    min={5} max={500} 
                    required 
                    compact
                    value={pricing.priceDay} 
                    onChange={v => setPricing({...pricing, priceDay: v})} 
                    forceError={showErrors}
                  />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '-0.8rem', textAlign: 'center' }}>08:00 AM - 08:00 PM</p>
                </div>

                <div>
                  <ValidatedInput 
                    label="Night Rate" 
                    format="money" 
                    min={5} max={500} 
                    required 
                    compact
                    value={pricing.priceNight} 
                    onChange={v => setPricing({...pricing, priceNight: v})} 
                    forceError={showErrors}
                  />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '-0.8rem', textAlign: 'center' }}>08:00 PM - 08:00 AM</p>
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

              {showErrors && !Object.values(schedule.days).some(d => d) && (
                <div style={{ marginTop: '-1.5rem' }}>
                  <ErrorMessage message="Please select at least one day" centered />
                </div>
              )}

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
                <div style={{ marginTop: '-1.5rem' }}>
                  <ErrorMessage message="End time must be after start time" centered />
                </div>
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
                {charger.houseNo && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--brand-cyan)', margin: '0 0 0.25rem 0' }}>
                    📍 {charger.houseNo}
                  </p>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                  {charger.houseNo ? `${charger.houseNo}, ` : ''}{charger.address}
                </p>
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
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-1rem' }}>
                Pay the one-time activation fee of <strong>{formatPKR(feeBreakdown.total)}</strong>. Bank transfer is active for this beta.
              </p>

              {/* Method Tabs */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  className={`btn ${payment.method === 'BANK_TRANSFER' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPayment({ ...payment, method: 'BANK_TRANSFER' })}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                >
                  Bank Transfer
                </button>
                <button
                  className="btn btn-secondary"
                  disabled
                  style={{ flex: 1, fontSize: '0.85rem', opacity: 0.55, cursor: 'not-allowed' }}
                >
                  Pay Online (Coming Soon)
                </button>
              </div>

              {/* Bank Transfer */}
              {payment.method === 'BANK_TRANSFER' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Transfer <strong>{formatPKR(feeBreakdown.total)}</strong> to:
                  </p>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                    <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-main)' }}>Bank:</strong> Meezan Bank Ltd.</p>
                    <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-main)' }}>Account Name:</strong> EV-Net Solutions</p>
                    <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-main)' }}>Account #:</strong> 0210-XXXXXXXXXX</p>
                    <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-main)' }}>IBAN:</strong> PK21MEZNXXXXXXXXXXXXXXXX</p>
                  </div>
                  </div>
              )}

              {/* Common Screenshot Upload for both methods */}
              <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <FileUploadDropzone
                  label="Upload Payment / Transfer Screenshot"
                  mode="image"
                  files={payment.screenshot ? [payment.screenshot] : []}
                  onChange={(files) => setPayment({ ...payment, screenshot: files[0] })}
                  error={showErrors && !payment.screenshot ? "Payment proof screenshot is required" : ""}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Please upload an image or PDF receipt from your bank transfer.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(7)} style={{ flex: 1 }}>Back</button>
                <button
                  className="btn btn-primary"
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  style={{ flex: 2 }}
                >
                  {isSubmitting ? (publishStatus || 'Submitting...') : 'Pay & Submit'}
                </button>
              </div>
            </div>
          )}

          {/* Step 9: Success Message */}
          {step === 9 && (
            <div className="animate-in" style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,210,106,0.1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                border: '1px solid rgba(0,210,106,0.2)'
              }}>
                <div style={{ fontSize: '2.5rem' }}>✅</div>
              </div>
              <h2 style={{ marginBottom: '1rem' }}>Onboarding Submitted!</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                Your host application has been submitted and is pending admin review.<br />
                Your charger listing has been created and will be visible once your profile is approved.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/host/dashboard')} style={{ width: '100%', maxWidth: '300px' }}>
                Go to Dashboard
              </button>
            </div>
          )}
          {showErrors && !validateStep(step) && (
            <ErrorMessage message="Please complete all required fields correctly before proceeding." centered />
          )}

          {submissionError && (
            <ErrorMessage message={submissionError} centered />
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
