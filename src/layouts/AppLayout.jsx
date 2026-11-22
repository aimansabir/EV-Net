import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import logoUrl from '../assets/logo.webp';
import NotificationCenter from '../components/NotificationCenter';
import Avatar from '../components/ui/Avatar';
import MobileNavStrip from './MobileNavStrip';
import { isNavItemActive } from './navUtils';
import '../components/Navbar.css';
import './layouts.css';

const AppLayout = ({ children }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: '/app/explore', label: 'Explore' },
    { path: '/app/bookings', label: 'Bookings' },
    { path: '/app/favorites', label: 'Favorites' },
    { path: '/app/messages', label: 'Messages' },
    { path: '/app/verification', label: user?.verificationStatus === 'approved' ? 'Verified ✓' : 'Verification' },
    { path: '/app/profile', label: 'Profile' },
  ];

  return (
    <div className="layout-shell">
      <nav className="navbar nav-scrolled layout-header" style={{ position: 'relative', background: 'var(--bg-main)' }} aria-label="Main">
        <div className="container nav-container">
          <Link to="/" className="logo layout-logo" aria-label="EV-Net home">
            <img src={logoUrl} alt="EV-Net" />
          </Link>

          <ul className="nav-links">
            {navItems.map(item => {
              const active = isNavItemActive(location.pathname, item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    style={{ color: active ? 'var(--brand-green)' : undefined }}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="nav-actions" style={{ gap: '1.25rem' }}>
            <NotificationCenter />
            <Link to="/app/profile" className="layout-avatar-link" aria-label="Your profile">
              <Avatar
                src={user?.avatar}
                name={user?.name}
                size="36px"
                style={{ border: '2px solid var(--brand-green)' }}
              />
            </Link>
          </div>
        </div>
      </nav>

      <MobileNavStrip items={navItems} accent="var(--brand-green)" />

      <main className="layout-main">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
