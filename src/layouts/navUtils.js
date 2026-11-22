/**
 * True when `pathname` is the nav item's page or one of its sub-pages,
 * e.g. /app/bookings/123 keeps "Bookings" highlighted.
 * Root-level dashboards (like /admin) only match exactly.
 */
export const isNavItemActive = (pathname, itemPath, { exact = false } = {}) => {
  if (pathname === itemPath) return true;
  if (exact) return false;
  return pathname.startsWith(`${itemPath}/`);
};
