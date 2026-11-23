import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthShell from '../../components/auth/AuthShell';
import useAuthStore from '../../store/authStore';
import { Eye, EyeOff } from 'lucide-react';
import GoogleIcon from '../../components/ui/GoogleIcon';

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle, resetPassword, isLoading, error, clearError } = useAuthStore();
  const location = useLocation();
  const [email, setEmail] = useState(() => location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const [localError, setLocalError] = useState('');

  const requestPasswordReset = useCallback(async (targetEmail) => {
    clearError();
    setLocalError('');
    setLocalMessage('');

    const trimmed = (targetEmail || '').trim();
    if (!trimmed) {
      setLocalError('Enter your email address first, then use Forgot password.');
      return;
    }

    try {
      await resetPassword(trimmed);
      setLocalMessage('If this email has an account, a password reset link will be sent shortly.');
    } catch (err) {
      setLocalError(err.message || 'Could not start password reset.');
    }
  }, [clearError, resetPassword]);

  // One-shot "send reset link" trigger passed from signup when an email
  // already exists. Guarded by location.key so StrictMode double effects
  // don't send two emails, then consumed so a refresh doesn't resend.
  const handledResetKey = useRef(null);
  useEffect(() => {
    const state = location.state;
    if (!state?.email || !state.triggerReset) return;
    if (handledResetKey.current === location.key) return;
    handledResetKey.current = location.key;

    Promise.resolve().then(() => requestPasswordReset(state.email));
    navigate(location.pathname, { replace: true, state: { email: state.email } });
  }, [location.state, location.key, location.pathname, navigate, requestPasswordReset]);

  const handleForgotPassword = () => requestPasswordReset(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    setLocalMessage('');
    try {
      const { role } = await login(email, password);
      navigateByRole(role);
    } catch {
      // error is set in store
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    setLocalError('');
    setLocalMessage('');
    try {
      await loginWithGoogle();
    } catch {
      // error is set in store
    }
  };

  const navigateByRole = (role) => {
    switch (role) {
      case 'host': navigate('/host/dashboard'); break;
      case 'admin': navigate('/admin'); break;
      default: navigate('/app/explore');
    }
  };

  return (
    <AuthShell
      role="login"
      title="Welcome Back"
      subtitle="Log in to your EV-Net account"
    >
      {(error || localError) && <div className="auth-error">{localError || error}</div>}
      {localMessage && (
        <div style={{ background: 'rgba(0,210,106,0.1)', border: '1px solid rgba(0,210,106,0.25)', color: 'var(--brand-green)', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {localMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="btn" style={{ width: '100%', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <GoogleIcon size={16} />
            Continue with Google
          </button>
          <div className="auth-divider">
            <span>or log in with email</span>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <div className="password-input-wrapper">
            <input
              id="login-password"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {!showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--brand-cyan)', 
              cursor: 'pointer', 
              padding: '0.5rem 0 0', 
              fontSize: '0.85rem', 
              alignSelf: 'flex-start',
              fontWeight: 500 
            }}
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <div className="auth-footer">
        <p>Don't have an account?</p>
        <p style={{ marginTop: '0.5rem' }}>
          <Link to="/signup/user">Sign up as EV Driver</Link>
          {' '}&nbsp;•&nbsp;{' '}
          <Link to="/signup/host">Become a Host</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default Login;
