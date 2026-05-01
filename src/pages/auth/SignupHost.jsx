import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/auth/AuthShell';
import useAuthStore from '../../store/authStore';
import { Eye, EyeOff, Home, Mail } from 'lucide-react';
import { normalizePersonName } from '../../utils/text';


const passwordRules = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const SignupHost = () => {
  const navigate = useNavigate();
  const { signupHost, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  
  const formatPhone = (value) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    let main = '';
    if (digits.startsWith('92')) {
      main = digits.slice(2);
    } else if (digits.startsWith('0')) {
      main = digits.slice(1);
    } else {
      main = digits;
    }
    main = main.slice(0, 10);
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
    const normalizedName = normalizePersonName(formData.name);

    if (!normalizedName || !formData.email || !formData.phone || !allPwPassed || !passwordsMatch) {
      setLocalError('Please fill all required fields and make sure the password meets all requirements.');
      return;
    }

    try {
      const result = await signupHost({ ...formData, name: normalizedName, avatar: null });
      if (result?.verificationRequired) {
        setVerificationRequired(true);
        setIsSuccess(true);
      } else {
        navigate('/host/onboarding');
      }
    } catch {
      // error is set in store
    }
  };

  if (isSuccess && verificationRequired) {
    return (
      <AuthShell
        role="host"
        title="Check Your Inbox"
        subtitle="If this is a new account, use the verification link to finish signup"
      >
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '1.5rem',
            background: 'rgba(0, 210, 106, 0.1)',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Mail size={40} color="var(--brand-green)" />
          </div>
          <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            If this is a new account, Supabase will send a verification link to <strong>{formData.email}</strong>.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            If this email already has an account, please log in or reset your password.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
            Go to Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      role="host"
      title="Become a Host"
      subtitle="List your charger and start earning with EV-Net"
    >

      {(error || localError) && (
        <div className="auth-error">
          <div>{localError || error}</div>
          {(String(error || localError || '')).toLowerCase().includes('already exists') && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <Link to="/login" className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                Go to Login
              </Link>
              <button 
                type="button" 
                onClick={() => navigate('/login', { state: { email: formData.email, triggerReset: true } })}
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              >
                Reset Password
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSignup} className="auth-form">
        <div className="auth-field">
          <label>Full Name</label>
          <input
            type="text"
            className="auth-input"
            placeholder="Ahsan Qureshi"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            onBlur={e => {
              const capitalized = normalizePersonName(e.target.value);
              setFormData({ ...formData, name: capitalized });
            }}
          />
        </div>

        <div className="auth-field">
          <label>Email</label>
          <input
            type="email"
            className="auth-input"
            placeholder="ahsan@example.com"
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

        <div className="auth-note">
          <p>
            <span className="note-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Home size={16} /></span>
            <span><strong>Signup is free.</strong> After joining, you'll complete onboarding. A one-time verification applies before your listing goes live.</span>
          </p>
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading || !normalizePersonName(formData.name) || !formData.email || !formData.phone || (pwTouched && !allPwPassed) || (confirmTouched && !passwordsMatch)} style={{ width: '100%' }}>
          {isLoading ? 'Creating Account...' : 'Create Host Account'}
        </button>
      </form>

      <div className="auth-footer">
        <p>Already have an account? <Link to="/login">Log in</Link></p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Looking to charge your EV? <Link to="/signup/user">Sign up as Driver</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default SignupHost;
