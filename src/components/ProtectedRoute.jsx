import React from 'react';
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
  const { isAuthenticated, role, isAuthHydrating, isInitialized } = useAuthStore();

  // If auth is still checking initial session, or re-hydrating profile in bg,
  // don't redirect yet as the role might be about to change.
  if (!isInitialized || isAuthHydrating) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--brand-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '12px' }}></div>
        Verifying secure access...
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
