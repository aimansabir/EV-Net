import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * Role-based route guard.
 * 
 * @param {Object} props
 * @param {string[]} props.allowedRoles - Roles that can access (e.g. ['user', 'admin'])
 * @param {React.ReactNode} props.children
 */
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, role, isAuthHydrating, isInitialized, initAuth } = useAuthStore();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (isInitialized && !isAuthHydrating) {
      setShowRetry(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      console.warn('[EV-Net][Auth] timeout/fallback');
      setShowRetry(true);
    }, 9000);

    return () => clearTimeout(timeoutId);
  }, [isInitialized, isAuthHydrating]);

  // If auth is still checking initial session, or re-hydrating profile in bg,
  // don't redirect yet as the role might be about to change.
  if (!isInitialized || isAuthHydrating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--brand-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '12px' }}></div>
          Verifying secure access...
        </div>
        {showRetry && (
          <div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Still loading?</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowRetry(false);
                initAuth();
              }}
            >
              Retry
            </button>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect unauthorized roles to their appropriate home
    switch (role) {
      case 'host': return <Navigate to="/host/dashboard" replace />;
      case 'admin': return <Navigate to="/admin" replace />;
      default: return <Navigate to="/app/explore" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
