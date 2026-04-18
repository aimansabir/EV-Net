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
  const { isAuthenticated, role } = useAuthStore();

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
