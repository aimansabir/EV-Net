import React from 'react';

const createMockScreen = (title, icon) => () => (
  <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="text-center">
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{icon}</div>
      <h2 style={{ marginBottom: '1rem' }}>{title}</h2>
      <p className="text-secondary" style={{ maxWidth: '400px', margin: '0 auto' }}>
        This module is currently in development. It will be fully functional in the next MVP phase.
      </p>
    </div>
  </div>
);

export const UserBookings = createMockScreen('My Bookings', '📅');
export const UserFavorites = createMockScreen('Saved Chargers', '❤️');
export const UserProfile = createMockScreen('User Profile', '👤');

export const HostListings = createMockScreen('Manage Listings', '🔌');
export const HostEarnings = createMockScreen('Earnings & Payouts', '💰');
export const HostAvailability = createMockScreen('Availability Calendar', '📆');
export const HostBookings = createMockScreen('Host Bookings', '🔖');
export const AdminDashboard = createMockScreen('Admin Control Panel', '🛡️');
