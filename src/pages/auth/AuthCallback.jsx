import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

/**
 * OAuth Callback Page
 * 
 * After Google OAuth redirects back, Supabase sets the session automatically.
 * This page waits for auth initialization, then routes by role.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role, isInitialized, initAuth } = useAuthStore();
  const [error, setError] = useState(null);

  useEffect(() => {
    // Ensure auth is initialized (it may already be from App.jsx)
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isInitialized) return;

    if (isAuthenticated && role) {
      // Route by role
      switch (role) {
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'host':
          navigate('/host/dashboard', { replace: true });
          break;
        case 'user':
        default:
          navigate('/app/explore', { replace: true });
          break;
      }
    } else {
      // Auth init completed but no session — something went wrong
      setError('Authentication failed. Please try again.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    }
  }, [isInitialized, isAuthenticated, role, navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-main, #0B0F19)',
      color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
    }}>
      <div style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#f87171' }}>⚠</div>
            <p style={{ color: '#f87171' }}>{error}</p>
            <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: '0.5rem' }}>Redirecting to login...</p>
          </>
        ) : (
          <>
            <div style={{
              width: '40px', height: '40px', margin: '0 auto 1rem',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--brand-green, #10b981)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#9CA3AF' }}>Completing sign-in...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
