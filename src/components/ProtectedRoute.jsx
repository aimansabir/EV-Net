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
  const { isAuthenticated, role, isAuthHydrating, isInitialized, initAuth, hydrationError } = useAuthStore();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (isInitialized && !isAuthHydrating) {
      return undefined;
    }

    const resetId = setTimeout(() => setShowRetry(false), 0);
    const timeoutId = setTimeout(() => {
      setShowRetry(true);
    }, 8000);

    return () => {
      clearTimeout(resetId);
      clearTimeout(timeoutId);
    };
  }, [isInitialized, isAuthHydrating]);

  // If auth is totally uninitialized and we aren't even authenticated, show full blocker.
  // BUT if we ARE authenticated and know the role (from session metadata), allow rendering.
  // This prevents the black loading screen loop on normal route changes.
  const isInitialLoadBlock = !isInitialized && !isAuthenticated;

  if (isInitialLoadBlock) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--brand-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '12px' }}></div>
          Verifying secure access...
        </div>
        {(showRetry || hydrationError) && (
          <div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
              {hydrationError || 'Still checking your session. You can retry without refreshing the page.'}
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowRetry(false);
                initAuth({ force: true });
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
    if (isAuthHydrating) {
      // Show loader instead of redirecting immediately if we are still hydrating the profile
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-secondary)', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--brand-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          Verifying role...
          {showRetry && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowRetry(false);
                initAuth({ force: true });
              }}
            >
              Retry
            </button>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

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
