/**
 * EV-Net — Navigation Helpers
 * 
 * Centralized logic for role-aware routing.
 */

/**
 * Returns the correct home path based on user role and authentication state.
 * @param {Object} user - The user object from auth store
 * @returns {string} - The destination route
 */
export const getHomeRouteByRole = (user) => {
  if (!user) return '/';
  
  const role = user.role?.toLowerCase();
  
  switch (role) {
    case 'admin':
      return '/admin';
    case 'host':
      return '/host/dashboard';
    case 'user':
    case 'ev_user':
      return '/app/explore';
    default:
      return '/';
  }
};
