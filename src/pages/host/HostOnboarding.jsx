import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { hostService } from '../../data/api';
import { ChargerType, PakistanCities } from '../../data/schema';
import { getActivationFeeBreakdown, formatPKR } from '../../data/feeConfig';
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

  const handlePublish = async () => {
    try {
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Complete Your Profile</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Verify your identity to build trust with EV users.</p>
              <div className="auth-field"><label>Full Name</label><input className="auth-input" value={user?.name || ''} readOnly style={{ opacity: 0.7 }} /></div>
              <div className="auth-field"><label>Phone Number</label><input className="auth-input" placeholder="+92 3XX XXXXXXX" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} /></div>
              <div className="auth-field"><label>CNIC Number</label><input className="auth-input" placeholder="XXXXX-XXXXXXX-X" value={profile.identityDoc} onChange={e => setProfile({...profile, identityDoc: e.target.value})} /></div>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Continue</button>
            </div>
          )}

          {/* Step 2: Charger Info */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Charger Details</h3>
              <div className="auth-field"><label>Charger Location / Address</label><input className="auth-input" placeholder="e.g. House 42, DHA Phase 6" value={charger.address} onChange={e => setCharger({...charger, address: e.target.value})} /></div>
              <div className="auth-row">
                <div className="auth-field"><label>City</label><select className="auth-select" value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})}>{PakistanCities.map(c => <option key={c.city}>{c.city}</option>)}</select></div>
                <div className="auth-field"><label>Area</label><select className="auth-select" value={charger.area} onChange={e => setCharger({...charger, area: e.target.value})}><option value="">Select</option>{(PakistanCities.find(c => c.city === profile.city)?.areas || []).map(a => <option key={a}>{a}</option>)}</select></div>
              </div>
              <div className="auth-field"><label>Charger Type / Speed</label><select className="auth-select" value={charger.chargerType} onChange={e => setCharger({...charger, chargerType: e.target.value})}>{Object.values(ChargerType).map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="auth-field"><label>Description</label><textarea className="auth-input" rows={3} placeholder="Describe your setup..." value={charger.description} onChange={e => setCharger({...charger, description: e.target.value})} style={{ resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Proof Upload */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Upload Proof</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Help us verify your property and charger setup.</p>
              
              {[{ label: 'Charger Photo', desc: 'Clear photo of your EV charger setup' }, { label: 'Property Proof', desc: 'Utility bill or property document showing address' }].map((item, i) => (
                <div key={i} style={{ padding: '1.5rem', border: '2px dashed var(--border-color)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-green)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.desc}</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--brand-green)' }}>Click to upload (simulated)</div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(4)} style={{ flex: 1 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 4: Pricing */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Set Your Pricing</h3>
              <div className="auth-field">
                <label>Price per Hour (PKR)</label>
                <input type="number" className="auth-input" min={100} max={5000} step={50} value={pricing.pricePerHour} onChange={e => setPricing({pricePerHour: Number(e.target.value)})} />
              </div>
              <div style={{ background: 'rgba(0,210,106,0.05)', border: '1px solid rgba(0,210,106,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#fff' }}>You'll earn ~85%</strong> of the base fee per booking. EV-Net takes a 15% platform commission. Your estimated hourly earning: <strong style={{ color: 'var(--brand-green)' }}>{formatPKR(Math.round(pricing.pricePerHour * 0.85))}</strong>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Set Availability</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Choose which days your charger is available.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
