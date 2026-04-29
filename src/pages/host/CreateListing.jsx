import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { listingService } from '../../data/api';
import { ChargerType } from '../../data/schema';
import { PakistanCitiesSorted, normalizeCityName } from '../../data/pakistanLocations';
import { Info, Lock } from 'lucide-react';
import SearchableSelect from '../../components/ui/SearchableSelect';
import PhotoGridManager from '../../components/ui/PhotoGridManager';
import ListingLocationPicker from '../../components/ui/ListingLocationPicker';
import ValidatedInput from '../../components/ui/ValidatedInput';
import '../../styles/auth.css';

const CreateListing = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [formData, setFormData] = useState({
    title: '', description: '', address: '', city: 'Karachi', area: '',
    chargerType: '7kW AC Type 2', chargerSpeed: '7kW', priceDay: 40, priceNight: 60,
    amenities: [], houseRules: '',
    lat: null, lng: null
  });

  const [manualCity, setManualCity] = useState(false);
  const [manualArea, setManualArea] = useState(false);

  const amenityOptions = ['WiFi Available', 'CCTV Security', 'Covered Parking', 'Restroom Access', 'Drinking Water', 'Gated Community', 'Near Restaurants', 'Garden Seating', 'Overnight Available'];
  const totalSteps = 4;

  const isStepValid = (s) => {
    if (s === 1) return formData.title && formData.address && formData.city && formData.area && formData.lat && formData.lng;
    if (s === 2) return formData.description;
    if (s === 3) return photos.length >= 1;
    return true;
  };

  const handleContinue = () => {
    if (isStepValid(step)) {
      setStep(step + 1);
      setShowErrors(false);
    } else {
      setShowErrors(true);
    }
  };

  const handleCancel = () => {
    const hasInput = formData.title || formData.address || formData.description || photos.length > 0;
    if (hasInput) {
      if (window.confirm("Are you sure you want to discard your progress?")) {
        navigate('/host/dashboard');
      }
    } else {
      navigate('/host/dashboard');
    }
  };

  const verificationStatus = user?.verificationStatus || 'draft';
  const isVerified = verificationStatus === 'approved';

  const handleSubmit = async () => {
    if (!isStepValid(4)) {
       setShowErrors(true);
       return;
    }

    const isDraft = photos.length < 3;
    
    await listingService.create({
      ...formData,
      hostId: user?.id || 'host_ahsan',
      images: ['https://images.unsplash.com/photo-1593941707882-a5bba14938cb?w=800&h=450&fit=crop'],
      houseRules: formData.houseRules.split('\n').filter(r => r.trim()),
      lat: formData.lat,
      lng: formData.lng,
      isActive: !isDraft,
      isApproved: false,
    });
    navigate('/host/listings');
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '0.5rem' }}>Create New Listing</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => <div key={s} style={{ height: '4px', flex: 1, borderRadius: '2px', background: step >= s ? 'var(--brand-green)' : 'rgba(255,255,255,0.1)' }} />)}
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>Location & Charger</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem' }}>Identify where and what kind of charger you are listing.</p>
              </div>

              <ValidatedInput 
                label="Listing Title" 
                placeholder="e.g. DHA Phase 6 Fast Charger" 
                value={formData.title} 
                onChange={v => setFormData({...formData, title: v})} 
                forceError={showErrors}
                required
              />

              <ListingLocationPicker 
                initialValue={formData.address}
                initialLat={formData.lat || 31.5204}
                initialLng={formData.lng || 74.3587}
                onLocationChange={(loc) => {
                  const updates = { 
                    address: loc.address || formData.address,
                    lat: loc.lat, 
                    lng: loc.lng 
                  };
                  
                  if (!manualCity && loc.city) {
                    const normalized = normalizeCityName(loc.city);
                    setFormData(prev => ({ ...prev, city: normalized }));
                  }
                  if (!manualArea && loc.area) {
                    updates.area = loc.area;
                  }
                  
                  setFormData(prev => ({ ...prev, ...updates }));
                }}
              />
              {showErrors && (!formData.lat || !formData.lng) && (
                <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '-0.8rem' }}>Please select a valid location on the map.</p>
              )}

              <div className="auth-row" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect 
                    label="City" 
                    city={formData.city} 
                    required 
                    options={PakistanCitiesSorted.map(c => c.city)}
                    value={formData.city} 
                    onChange={v => {
                      setFormData({...formData, city: v, area: ''});
                      setManualCity(true);
                    }} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <SearchableSelect 
                    label="Area (Public)" required 
                    options={PakistanCitiesSorted.find(c => c.city === formData.city)?.areas || []}
                    placeholder={formData.city ? "Select area" : "Select city first"}
                    value={formData.area} 
                    onChange={v => {
                      setFormData({...formData, area: v});
                      setManualArea(true);
                    }} 
                    disabled={!formData.city}
                  />
                  {showErrors && !formData.area && <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '0.4rem' }}>Area is required</p>}
                </div>
              </div>

              <div className="auth-row">
                <div className="auth-field" style={{ flex: 1 }}>
                  <label>Charger Type</label>
                  <select className="auth-select" value={formData.chargerType} onChange={e => setFormData({...formData, chargerType: e.target.value})}>
                    {Object.values(ChargerType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="auth-field" style={{ flex: 1 }}>
                  <label>Day Rate (per kWh)</label>
                  <div className="stepper-input">
                    <button type="button" onClick={() => setFormData({...formData, priceDay: Math.max(0, formData.priceDay - 5)})}>-</button>
                    <input type="number" className="auth-input" value={formData.priceDay} onChange={e => setFormData({...formData, priceDay: Number(e.target.value)})} />
                    <button type="button" onClick={() => setFormData({...formData, priceDay: formData.priceDay + 5})}>+</button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>08:00 AM - 08:00 PM (Solar cheaper)</p>
                </div>
                <div className="auth-field" style={{ flex: 1 }}>
                  <label>Night Rate (per kWh)</label>
                  <div className="stepper-input">
                    <button type="button" onClick={() => setFormData({...formData, priceNight: Math.max(0, formData.priceNight - 5)})}>-</button>
                    <input type="number" className="auth-input" value={formData.priceNight} onChange={e => setFormData({...formData, priceNight: Number(e.target.value)})} />
                    <button type="button" onClick={() => setFormData({...formData, priceNight: formData.priceNight + 5})}>+</button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>08:00 PM - 08:00 AM (Grid only)</p>
                </div>
              </div>

              <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.1)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0 }}><Info size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> <strong>Solar-First:</strong> We recommend setting day rates ~30% lower to encourage charging during peak solar yield.</p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={handleCancel} style={{ flex: 1 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleContinue} style={{ flex: 2 }}>Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Details & Amenities</h3>
              <div className="auth-field"><label>Description</label><textarea className="auth-input" rows={4} placeholder="Describe your charging setup..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ resize: 'vertical' }} /></div>
              <div className="auth-field">
                <label>Amenities</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {amenityOptions.map(a => (
                    <button key={a} type="button" onClick={() => setFormData({...formData, amenities: formData.amenities.includes(a) ? formData.amenities.filter(x => x !== a) : [...formData.amenities, a]})}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', border: formData.amenities.includes(a) ? '1px solid var(--brand-green)' : '1px solid var(--border-color)', background: formData.amenities.includes(a) ? 'rgba(0,210,106,0.15)' : 'transparent', color: formData.amenities.includes(a) ? 'var(--brand-green)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="auth-field"><label>House Rules (one per line)</label><textarea className="auth-input" rows={3} placeholder="Park in designated spot only&#10;No overnight charging" value={formData.houseRules} onChange={e => setFormData({...formData, houseRules: e.target.value})} style={{ resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => { setStep(1); setShowErrors(false); }} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handleContinue} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1.5rem 0' }}>Listing Photos</h3>
              <PhotoGridManager 
                  files={photos}
                  onChange={setPhotos}
                  maxPhotos={5}
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => { setStep(2); setShowErrors(false); }} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handleContinue} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Review & Submit</h3>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}><strong>{formData.title || 'Untitled'}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formData.address}, {formData.area}, {formData.city}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{formData.chargerType} • Day: PKR {formData.priceDay}/kWh • Night: PKR {formData.priceNight}/kWh</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--brand-cyan)', marginTop: '0.5rem' }}>{photos.length} Photos Attached (Min 3 required to publish)</p>
              </div>
              {!isVerified && (
                <div className="auth-note" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                   <p><span className="note-icon" style={{ color: '#ef4444' }}><Lock size={16} /></span><span style={{ color: '#fca5a5' }}>Host account not yet verified. You can save this listing as a Draft, but it cannot be published until your profile is approved.</span></p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>Back</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSubmit} 
                  style={{ flex: 2 }}
                  disabled={!isVerified && photos.length >= 3}
                >
                  {photos.length >= 3 ? (isVerified ? 'Submit For Review' : 'Verification Required') : 'Save as Draft'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
