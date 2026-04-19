import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/auth/AuthShell';
import useAuthStore from '../../store/authStore';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login, demoLogin, loginWithGoogle, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    try {
      const { role } = await login(email, password);
      navigateByRole(role);
    } catch (err) {
      // error is set in store
    }
  };

  const handleDemoLogin = async (role) => {
    clearError();
    try {
      await demoLogin(role);
      navigateByRole(role);
    } catch (err) {
      // error is set in store
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    try {
      await loginWithGoogle();
    } catch (err) {
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
      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="btn" style={{ width: '100%', background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <img src="https://www.google.com/favicon.ico" width="16" height="16" alt="Google" />
            Continue with Google
          </button>
          <div className="auth-divider">
            <span>or log in with email</span>
          </div>
        </div>

        <div className="auth-field">
          <label>Email</label>
          <input
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label>Password</label>
          <div className="password-input-wrapper">
            <input
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

      {/* Demo Quick Login — always available on login page for convenience */}
      <div className="demo-section">
        <h4>Quick Demo Access</h4>
        <div className="demo-buttons">
          <button className="demo-btn" onClick={() => handleDemoLogin('user')} disabled={isLoading}>
            <span className="demo-icon">🚗</span>
            EV User
          </button>
          <button className="demo-btn" onClick={() => handleDemoLogin('verified')} disabled={isLoading}>
            <span className="demo-icon">✅</span>
            Verified
          </button>
          <button className="demo-btn" onClick={() => handleDemoLogin('tester')} disabled={isLoading}>
            <span className="demo-icon">🧪</span>
            Test User
          </button>
          <button className="demo-btn" onClick={() => handleDemoLogin('host')} disabled={isLoading}>
            <span className="demo-icon">🏠</span>
            Host
          </button>
          <button className="demo-btn" onClick={() => handleDemoLogin('admin')} disabled={isLoading}>
            <span className="demo-icon">🛡️</span>
            Admin
          </button>
        </div>
      </div>
    </AuthShell>
  );
};

export default Login;
