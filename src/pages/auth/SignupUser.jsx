import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Mail, Info } from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';
import useAuthStore from '../../store/authStore';
import { PakistanEVBrands, ConnectorType } from '../../data/schema';

const passwordRules = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const SignupUser = () => {
  const navigate = useNavigate();
  const { signupUser, loginWithGoogle, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    evBrand: '',
    evModel: '',
    connectorPreference: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);

  const handleBrandChange = (brand) => {
    setFormData({ ...formData, evBrand: brand, evModel: '' });
  };

  const modelsForBrand = PakistanEVBrands.find(b => b.brand === formData.evBrand)?.models || [];
  
  const formatPhone = (value) => {
    // If user deleted everything, keep it empty or reset to +92
    if (!value) return '';
    
    // Extract digits only
    const digits = value.replace(/\D/g, '');
    
    // Determine the main 10 digits
    let main = '';
    if (digits.startsWith('92')) {
      main = digits.slice(2);
    } else if (digits.startsWith('0')) {
      main = digits.slice(1);
    } else {
      main = digits;
    }
    
    // Limit to 10 digits
    main = main.slice(0, 10);
    
    // Build the format: +92-XXX-XXXXXXX
    let res = '+92';
    if (main.length > 0) res += '-' + main.slice(0, 3);
    if (main.length > 3) res += '-' + main.slice(3);
    
    return res;
  };

  const pwChecks = useMemo(() => {
    return passwordRules.map(r => ({ ...r, passed: r.test(formData.password) }));
  }, [formData.password]);

  const allPwPassed = pwChecks.every(c => c.passed);
  const pwTouched = formData.password.length > 0;
  const passwordsMatch = formData.password === formData.confirmPassword;
  const confirmTouched = formData.confirmPassword.length > 0;

  const handleSignup = async (e) => {
    e.preventDefault();
    clearError();
    setLocalError('');

    if (step === 1) {
      if (!allPwPassed || !passwordsMatch || !formData.name || !formData.email || !formData.phone) {
        setLocalError('Please fill all required fields, ensure password meets requirements, and passwords match.');
        return;
      }
      setStep(2);
      return;
    }

    if (!formData.evBrand || !formData.evModel || !formData.connectorPreference) {
      setLocalError('Please select your EV brand, model, and connector preference.');
      return;
    }

    try {
      const result = await signupUser({ ...formData, avatar: null });
      if (result?.verificationRequired) {
        setVerificationRequired(true);
        setIsSuccess(true);
      } else {
        navigate('/app/explore');
      }
    } catch {
      // error is set in store
    }
  };

  if (isSuccess && verificationRequired) {
    return (
      <AuthShell
        role="user"
        title="Check Your Email"
        subtitle="We've sent a verification link to your inbox"
      >
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ 
            fontSize: '3rem', 
            marginBottom: '1.5rem',
            background: 'rgba(6, 182, 212, 0.1)',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Mail size={40} color="var(--brand-cyan)" />
          </div>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Almost there!</h3>
          <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            To complete your registration, please click the link we just sent to <strong>{formData.email}</strong>.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Verification ensures a secure and trusted community for both drivers and hosts.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
            Go to Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  const handleGoogleLogin = async () => {
    clearError();
    setLocalError('');
    try {
      await loginWithGoogle();
    } catch {
      // error is set in store
    }
  };

  return (
    <AuthShell
      role="user"
      title="Create Your Account"
      subtitle="Join EV-Net to explore verified charging access"
    >
      {(error || localError) && <div className="auth-error">{localError || error}</div>}

      <form onSubmit={handleSignup} className="auth-form">
        {step === 1 ? (
          <div className="auth-step animate-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="btn" style={{ width: '100%', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <img src="https://www.google.com/favicon.ico" width="16" height="16" alt="Google" />
                Continue with Google
              </button>
              <div className="auth-divider">
                <span>or sign up with email</span>
              </div>
            </div>


            <div className="auth-field">
              <label>Full Name</label>
              <input
                type="text"
                className="auth-input"
                placeholder="Ali Raza"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="ali@example.com"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Create a strong password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    borderColor: pwTouched ? (allPwPassed ? 'rgba(0, 210, 106, 0.5)' : 'rgba(239, 68, 68, 0.4)') : undefined,
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {!showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Password Requirements Checklist */}
              {pwTouched && (
                <div className="pw-requirements">
                  {pwChecks.map(check => (
                    <div key={check.key} className={`pw-rule ${check.passed ? 'passed' : 'failed'}`}>
                      <span className="pw-icon">{check.passed ? '✓' : '✕'}</span>
                      <span>{check.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="auth-field">
              <label>Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Repeat your password"
                  required
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  style={{
                    borderColor: confirmTouched ? (passwordsMatch ? 'rgba(0, 210, 106, 0.5)' : 'rgba(239, 68, 68, 0.4)') : undefined,
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {!showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmTouched && !passwordsMatch && (
                <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.4rem' }}>Passwords do not match</p>
              )}
            </div>

            <div className="auth-field">
              <label>Phone Number</label>
              <input
                type="tel"
                className="auth-input"
                placeholder="+92-3XX-XXXXXXX"
                required
                maxLength={15}
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
              />
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={!allPwPassed || !passwordsMatch || !formData.name || !formData.email || !formData.phone} style={{ width: '100%', marginTop: '1rem' }}>
              Next Step &rarr;
            </button>
          </div>
        ) : (
          <div className="auth-step animate-in">
            <button type="button" onClick={() => setStep(1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem', padding: 0 }}>
              <ArrowLeft size={16} /> Back to Essentials
            </button>

            <div className="auth-divider" style={{ margin: '0 0 1.5rem 0' }}><span>Vehicle Details</span></div>

            <div className="auth-row" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: '1rem' }}>
              <div className="auth-field">
                <label>EV Brand</label>
                <select
                  className="auth-select"
                  value={formData.evBrand}
                  onChange={e => handleBrandChange(e.target.value)}
                >
                  <option value="">Select Brand</option>
                  {PakistanEVBrands.map(b => (
                    <option key={b.brand} value={b.brand}>{b.brand}</option>
                  ))}
                </select>
              </div>
              <div className="auth-field">
                <label>EV Model</label>
                <select
                  className="auth-select"
                  value={formData.evModel}
                  onChange={e => setFormData({ ...formData, evModel: e.target.value })}
                >
                  <option value="">{formData.evBrand ? 'Select Model' : 'Brand First'}</option>
                  {modelsForBrand.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="auth-field" style={{ marginTop: '1rem' }}>
              <label>Connector Preference</label>
              <select
                className="auth-select"
                value={formData.connectorPreference}
                onChange={e => setFormData({ ...formData, connectorPreference: e.target.value })}
              >
                <option value="">Select Connector Type</option>
                {Object.values(ConnectorType).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="auth-note">
              <p>
                <span className="note-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Info size={16} /></span>
                <span><strong>Signup is 100% free.</strong> Booking fees only apply when you reserve a charging session.</span>
              </p>
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading} style={{ width: '100%', marginTop: '1rem' }}>
              {isLoading ? 'Creating Account...' : 'Create Driver Account'}
            </button>
          </div>
        )}
      </form>

      <div className="auth-footer">
        <p>Already have an account? <Link to="/login">Log in</Link></p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Want to host a charger? <Link to="/signup/host">Sign up as Host</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default SignupUser;
