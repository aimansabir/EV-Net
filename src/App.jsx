import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Public Pages
import LandingPage from './pages/public/LandingPage';

// Auth Pages
import Login from './pages/auth/Login';
import SignupUser from './pages/auth/SignupUser';
import SignupHost from './pages/auth/SignupHost';

// App Pages (EV User)
import Explore from './pages/app/Explore';
import ChargerDetail from './pages/app/ChargerDetail';
import Checkout from './pages/app/Checkout';
import Bookings from './pages/app/Bookings';
import Favorites from './pages/app/Favorites';
import UserProfile from './pages/app/UserProfile';
import Verification from './pages/app/Verification';
import UserMessages from './pages/app/Messages';

// Host Pages
import HostOnboarding from './pages/host/HostOnboarding';
import HostDashboard from './pages/host/HostDashboard';
import HostListings from './pages/host/HostListings';
import CreateListing from './pages/host/CreateListing';
import HostBookings from './pages/host/HostBookings';
import HostEarnings from './pages/host/HostEarnings';
import HostAvailability from './pages/host/HostAvailability';
import HostProfile from './pages/host/HostProfile';
import HostMessages from './pages/host/HostMessages';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminListings from './pages/admin/AdminListings';
import AdminBookings from './pages/admin/AdminBookings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminVerification from './pages/admin/AdminVerification';
import AdminReports from './pages/admin/AdminReports';
import AdminConversations from './pages/admin/AdminConversations';

// Layouts
import AppLayout from './layouts/AppLayout';
import HostLayout from './layouts/HostLayout';
import AdminLayout from './layouts/AdminLayout';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import useAuthStore from './store/authStore';
import DemoSwitcher from './components/DemoSwitcher';

import './App.css';

function App() {
  const initAuth = useAuthStore(state => state.initAuth);

  React.useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* ═══ Public Routes ═══ */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup/user" element={<SignupUser />} />
        <Route path="/signup/host" element={<SignupHost />} />

        {/* ═══ EV User Routes ═══ */}
        <Route path="/app/explore" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><Explore /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/charger/:id" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><ChargerDetail /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/book/:chargerId" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><Checkout /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/bookings" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><Bookings /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/favorites" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><Favorites /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/profile" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><UserProfile /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/verification" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><Verification /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/app/messages" element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <AppLayout><UserMessages /></AppLayout>
          </ProtectedRoute>
        } />

        {/* ═══ Host Routes ═══ */}
        <Route path="/host/onboarding" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostOnboarding />
          </ProtectedRoute>
        } />
        <Route path="/host/dashboard" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostDashboard /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/listings" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostListings /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/listings/new" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><CreateListing /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/bookings" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostBookings /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/earnings" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostEarnings /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/availability" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostAvailability /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/profile" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostProfile /></HostLayout>
          </ProtectedRoute>
        } />
        <Route path="/host/messages" element={
          <ProtectedRoute allowedRoles={['host', 'admin']}>
            <HostLayout><HostMessages /></HostLayout>
          </ProtectedRoute>
        } />

        {/* ═══ Admin Routes ═══ */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminDashboard /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/verifications" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminVerification /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/listings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminListings /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/bookings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminBookings /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminUsers /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminReports /></AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/conversations" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout><AdminConversations /></AdminLayout>
          </ProtectedRoute>
        } />
      </Routes>

      {/* Demo Mode Switcher — dev-only or ?demo=1 */}
      <DemoSwitcher />
    </BrowserRouter>
  );
}

export default App;
