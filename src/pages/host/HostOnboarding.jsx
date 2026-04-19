import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { hostService } from '../../data/api';
import { ChargerType, PakistanCities } from '../../data/schema';
import { getActivationFeeBreakdown, formatPKR } from '../../data/feeConfig';
import ValidatedInput from '../../components/ui/ValidatedInput';
import FileUploadDropzone from '../../components/ui/FileUploadDropzone';
import AreaComboBox from '../../components/ui/AreaComboBox';
import '../../styles/auth.css';

const HostOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const feeBreakdown = getActivationFeeBreakdown();

  const [profile, setProfile] = useState({
    phone: user?.phone || '', identityDoc: '', city: 'Lahore',
  });
  const [charger, setCharger] = useState({
    address: '', area: '', chargerType: '7kW AC Type 2', description: '',
  });
  const [pricing, setPricing] = useState({ pricePerHour: 500 });
  const [schedule, setSchedule] = useState({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false,
  });
  
  // File states
  const [chargerPhotos, setChargerPhotos] = useState([]);
  const [propertyProofs, setPropertyProofs] = useState([]);

  const handlePublish = async () => {
    try {
      // In a real app, we'd pass chargerPhotos[0].file and propertyProofs[0].file to hostService
      await hostService.submitVerification(user?.id);
    } catch (e) { /* ignore for MVP */ }
    navigate('/host/dashboard');
  };

  const stepNames = ['Profile', 'Charger Info', 'Proof Upload', 'Pricing', 'Availability', 'Review & Pay'];

  return (
    <div className="auth-page" style={{ background: 'var(--bg-main)' }}>
      <div style={{ margin: 'auto', maxWidth: '600px', width: '100%', padding: '2rem 1.5rem' }}>
        
        {/* Progress Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Host Onboarding
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Step {step} of {totalSteps}: {stepNames[step - 1]}
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} style={{ height: '4px', flex: 1, borderRadius: '2px', background: step > i ? 'var(--brand-green)' : step === i + 1 ? 'var(--brand-cyan)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          
          {/* Step 1: Profile */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Complete Your Profile</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Verify your identity to build trust with EV users.</p>
              
              <ValidatedInput label="Full Name" value={user?.name || ''} disabled onChange={() => {}} />
              <ValidatedInput label="Phone Number" format="phone" placeholder="03XXXXXXXXX" required value={profile.phone} onChange={v => setProfile({...profile, phone: v})} />
              <ValidatedInput label="CNIC Number" format="cnic" placeholder="XXXXX-XXXXXXX-X" required value={profile.identityDoc} onChange={v => setProfile({...profile, identityDoc: v})} />
              
              <button className="btn btn-primary" onClick={() => setStep(2)} style={{ marginTop: '0.5rem' }} disabled={!profile.phone || !profile.identityDoc}>Continue</button>
            </div>
          )}

          {/* Step 2: Charger Info */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1.5rem 0' }}>Charger Details</h3>
              
              <ValidatedInput label="Charger Location / Address" placeholder="e.g. House 42, Street 1" required value={charger.address} onChange={v => setCharger({...charger, address: v})} />
              
              <div className="auth-row" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                <div className="auth-field" style={{ flex: 1, marginBottom: '1.25rem' }}>
                  <label>City <span style={{ color: 'var(--brand-cyan)' }}>*</span></label>
                  <select className="auth-select" value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})}>
                    {PakistanCities.map(c => <option key={c.city}>{c.city}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <AreaComboBox label="Area" city={profile.city} required value={charger.area} onChange={v => setCharger({...charger, area: v})} />
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
                <textarea className="auth-input" rows={3} placeholder="Describe your setup, parking instructions..." value={charger.description} onChange={e => setCharger({...charger, description: e.target.value})} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)} style={{ flex: 1 }} disabled={!charger.address || !charger.area}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Proof Upload */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Upload Proof</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Help us verify your property and charger setup.</p>
              
              <FileUploadDropzone 
                label="Charger Setup Photo" 
                description="Clear photo of the charger unit installed at the indicated location."
                mode="image"
                accept="image/jpeg, image/png"
                files={chargerPhotos}
                onChange={setChargerPhotos}
              />

              <FileUploadDropzone 
                label="Property Proof" 
                description="Recent utility bill or deed showing the address matches your listing."
                accept="image/jpeg, image/png, application/pdf"
                files={propertyProofs}
                onChange={setPropertyProofs}
              />

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(4)} style={{ flex: 1 }} disabled={chargerPhotos.length === 0 || propertyProofs.length === 0}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 4: Pricing */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1.5rem 0' }}>Set Your Pricing</h3>
              
              <ValidatedInput 
                label="Price per Hour" 
                format="money" 
                min={100} max={5000} 
                required 
                value={pricing.pricePerHour} 
                onChange={v => setPricing({pricePerHour: v})} 
              />

              <div style={{ background: 'rgba(0,210,106,0.05)', border: '1px solid rgba(0,210,106,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#fff' }}>You'll earn ~85%</strong> of the base fee per booking. EV-Net takes a 15% platform commission. Your estimated hourly earning: <strong style={{ color: 'var(--brand-green)' }}>{formatPKR(Math.round((pricing.pricePerHour || 0) * 0.85))}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(5)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 5: Availability */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Set Availability</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Choose which days your charger is available.</p>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '2rem' }}>
                {Object.entries(schedule).map(([day, active]) => (
                  <div key={day} onClick={() => setSchedule({...schedule, [day]: !active})}
                    style={{ padding: '0.5rem 1rem', border: `1px solid ${active ? 'var(--brand-green)' : 'var(--border-color)'}`, background: active ? 'rgba(0,210,106,0.15)' : 'transparent', color: active ? 'var(--brand-green)' : 'var(--text-secondary)', borderRadius: '20px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>
                    {day}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(4)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(6)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 6: Review & Pay */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Review & Activate</h3>
              
              <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Host Verification / Listing Activation Fee</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  To maintain quality and safety, a one-time activation fee is required. This covers:
                </p>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1.5rem' }}>
                  <li>Profile and identity verification</li>
                  <li>Listing review and quality assessment</li>
                  <li>Platform onboarding and dedicated support</li>
                  <li>Trust & safety background checks</li>
                </ul>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Activation Fee</span>
                    <span>{formatPKR(feeBreakdown.baseFee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tax (16% GST)</span>
                    <span>{formatPKR(feeBreakdown.tax)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--brand-green)' }}>
                    <span>Total Payable</span>
                    <span>{formatPKR(feeBreakdown.total)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(5)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handlePublish} style={{ flex: 2 }}>Pay & Submit for Review</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default HostOnboarding;
