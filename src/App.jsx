import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

// Landing page is the most common entry point — keep it in the main bundle.
import LandingPage from './pages/public/LandingPage';

// Layouts & shell components
import AppLayout from './layouts/AppLayout';
import HostLayout from './layouts/HostLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import DemoSwitcher from './components/DemoSwitcher';
import useAuthStore from './store/authStore';


// Every other screen is code-split so visitors only download what they use.

// Auth
const Login = lazy(() => import('./pages/auth/Login'));
const SignupUser = lazy(() => import('./pages/auth/SignupUser'));
const SignupHost = lazy(() => import('./pages/auth/SignupHost'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));

// EV User
const Explore = lazy(() => import('./pages/app/Explore'));
const ChargerDetail = lazy(() => import('./pages/app/ChargerDetail'));
const Checkout = lazy(() => import('./pages/app/Checkout'));
const Bookings = lazy(() => import('./pages/app/Bookings'));
const BookingDetail = lazy(() => import('./pages/app/BookingDetail'));
const Favorites = lazy(() => import('./pages/app/Favorites'));
const UserProfile = lazy(() => import('./pages/app/UserProfile'));
const Verification = lazy(() => import('./pages/app/Verification'));
const UserMessages = lazy(() => import('./pages/app/Messages'));

// Host
const HostOnboarding = lazy(() => import('./pages/host/HostOnboarding'));
const HostDashboard = lazy(() => import('./pages/host/HostDashboard'));
const HostListings = lazy(() => import('./pages/host/HostListings'));
const CreateListing = lazy(() => import('./pages/host/CreateListing'));
const HostBookings = lazy(() => import('./pages/host/HostBookings'));
const HostEarnings = lazy(() => import('./pages/host/HostEarnings'));
const HostAvailability = lazy(() => import('./pages/host/HostAvailability'));
const HostProfile = lazy(() => import('./pages/host/HostProfile'));
const HostMessages = lazy(() => import('./pages/host/HostMessages'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminVerification = lazy(() => import('./pages/admin/AdminVerification'));
const AdminListings = lazy(() => import('./pages/admin/AdminListings'));
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminConversations = lazy(() => import('./pages/admin/AdminConversations'));

const NotFound = lazy(() => import('./pages/shared/NotFound'));

const USER_ROLES = ['user', 'admin'];
const HOST_ROLES = ['host', 'admin'];
const ADMIN_ROLES = ['admin'];

const userRoutes = [
  ['/app/explore', Explore],
  ['/app/charger/:id', ChargerDetail],
  ['/app/book/:chargerId', Checkout],
  ['/app/bookings', Bookings],
  ['/app/bookings/:bookingId', BookingDetail],
  ['/app/favorites', Favorites],
  ['/app/profile', UserProfile],
  ['/app/verification', Verification],
  ['/app/messages', UserMessages],
];

const hostRoutes = [
  ['/host/dashboard', HostDashboard],
  ['/host/listings', HostListings],
  ['/host/listings/new', CreateListing],
  ['/host/bookings', HostBookings],
  ['/host/earnings', HostEarnings],
  ['/host/availability', HostAvailability],
  ['/host/profile', HostProfile],
  ['/host/messages', HostMessages],
];

const adminRoutes = [
  ['/admin', AdminDashboard],
  ['/admin/verifications', AdminVerification],
  ['/admin/listings', AdminListings],
  ['/admin/bookings', AdminBookings],
  ['/admin/users', AdminUsers],
  ['/admin/reports', AdminReports],
  ['/admin/conversations', AdminConversations],
];

const PageLoader = () => (
  <div className="page-loader" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <span>Loading…</span>
  </div>
);

/**
 * Keeps the layout (sidebar / nav) mounted while the page chunk loads, so
 * navigating between sections doesn't flash a blank screen.
 */
const guarded = (roles, Layout, Page) => (
  <ProtectedRoute allowedRoles={roles}>
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Page />
      </Suspense>
    </Layout>
  </ProtectedRoute>
);

function AppRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ═══ Public ═══ */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup/user" element={<SignupUser />} />
          <Route path="/signup/host" element={<SignupHost />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* ═══ EV User ═══ */}
          {userRoutes.map(([path, Page]) => (
            <Route key={path} path={path} element={guarded(USER_ROLES, AppLayout, Page)} />
          ))}

          {/* ═══ Host ═══ */}
          <Route
            path="/host/onboarding"
            element={
              <ProtectedRoute allowedRoles={HOST_ROLES}>
                <HostOnboarding />
              </ProtectedRoute>
            }
          />
          {hostRoutes.map(([path, Page]) => (
            <Route key={path} path={path} element={guarded(HOST_ROLES, HostLayout, Page)} />
          ))}

          {/* ═══ Admin ═══ */}
          {adminRoutes.map(([path, Page]) => (
            <Route key={path} path={path} element={guarded(ADMIN_ROLES, AdminLayout, Page)} />
          ))}

          {/* ═══ Fallback ═══ */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const initAuth = useAuthStore(state => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />

      {/* Demo Mode Switcher — mock mode only, in dev or with ?demo=1 */}
      <DemoSwitcher />
    </BrowserRouter>
  );
}

export default App;
