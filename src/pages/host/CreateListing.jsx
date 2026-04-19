import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { listingService } from '../../data/api';
import { ChargerType, PakistanCities } from '../../data/schema';
import { Info } from 'lucide-react';
import AreaComboBox from '../../components/ui/AreaComboBox';
import PhotoGridManager from '../../components/ui/PhotoGridManager';
import '../../styles/auth.css';

const CreateListing = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [formData, setFormData] = useState({
    title: '', description: '', address: '', city: 'Lahore', area: '',
    chargerType: '7kW AC Type 2', chargerSpeed: '7kW', pricePerHour: 500,
    amenities: [], houseRules: '',
  });

  const amenityOptions = ['WiFi Available', 'CCTV Security', 'Covered Parking', 'Restroom Access', 'Drinking Water', 'Gated Community', 'Near Restaurants', 'Garden Seating', 'Overnight Available'];
  const totalSteps = 4;

  const handleSubmit = async () => {
    // Determine status based on photo rules: 3 for published/review, else draft
    const isDraft = photos.length < 3;
    
    await listingService.create({
      ...formData,
      hostId: user?.id || 'host_ahsan',
      images: ['https://images.unsplash.com/photo-1593941707882-a5bba14938cb?w=800&h=450&fit=crop'], // In production, map photos state here
      houseRules: formData.houseRules.split('\n').filter(r => r.trim()),
      lat: 31.5 + Math.random() * 0.05,
      lng: 74.3 + Math.random() * 0.05,
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
              <h3 style={{ margin: 0 }}>Location & Charger</h3>
              <div className="auth-field"><label>Listing Title</label><input className="auth-input" placeholder="e.g. DHA Phase 6 Fast Charger" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
              <div className="auth-field"><label>Address (Private)</label><input className="auth-input" placeholder="House 42, Street 7, DHA Phase 6" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div className="auth-row" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                <div className="auth-field" style={{ flex: 1, marginBottom: '1.25rem' }}>
                  <label>City <span style={{ color: 'var(--brand-cyan)' }}>*</span></label>
                  <select className="auth-select" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value, area: ''})}>
                    {PakistanCities.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <AreaComboBox label="Area (Public)" city={formData.city} required value={formData.area} onChange={v => setFormData({...formData, area: v})} />
                </div>
              </div>
              <div className="auth-row">
                <div className="auth-field"><label>Charger Type</label><select className="auth-select" value={formData.chargerType} onChange={e => setFormData({...formData, chargerType: e.target.value})}>{Object.values(ChargerType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="auth-field">
                  <label>Price / Hour (PKR)</label>
                  <div className="stepper-input">
                    <button type="button" onClick={() => setFormData({...formData, pricePerHour: Math.max(0, formData.pricePerHour - 50)})}>-</button>
                    <input type="number" className="auth-input" value={formData.pricePerHour} onChange={e => setFormData({...formData, pricePerHour: Number(e.target.value)})} />
                    <button type="button" onClick={() => setFormData({...formData, pricePerHour: formData.pricePerHour + 50})}>+</button>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Continue</button>
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
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)} style={{ flex: 1 }}>Continue</button>
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
                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(4)} style={{ flex: 1 }} disabled={photos.length === 0}>Continue</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Review & Submit</h3>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}><strong>{formData.title || 'Untitled'}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formData.address}, {formData.area}, {formData.city}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{formData.chargerType} • PKR {formData.pricePerHour}/hr</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--brand-cyan)', marginTop: '0.5rem' }}>{photos.length} Photos Attached (Min 3 required to publish)</p>
              </div>
              <div className="auth-note">
                <p><span className="note-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Info size={16} /></span><span>Your listing will be saved as a Draft if you have less than 3 photos. Otherwise, it will be submitted for Review.</span></p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 2 }}>{photos.length >= 3 ? 'Submit For Review' : 'Save as Draft'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
