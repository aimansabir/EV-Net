import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';
import logoUrl from '../assets/logo.webp';
import NotificationCenter from '../components/NotificationCenter';
import Avatar from '../components/ui/Avatar';
import MobileNavStrip from './MobileNavStrip';
import { isNavItemActive } from './navUtils';
import '../components/Navbar.css';
import './layouts.css';

const HostLayout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isHostVerified = user?.verificationStatus === 'approved';

  const navItems = [
    { path: '/host/dashboard', label: 'Dashboard' },
    { path: '/host/onboarding', label: isHostVerified ? 'Verified ✓' : 'Verification' },
    { path: '/host/listings', label: 'Listings' },
    { path: '/host/bookings', label: 'Bookings' },
    { path: '/host/availability', label: 'Availability' },
    { path: '/host/messages', label: 'Messages' },
    { path: '/host/earnings', label: 'Earnings' },
  ];

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="layout-shell">
      <nav className="navbar nav-scrolled layout-header" style={{ position: 'relative', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }} aria-label="Main">
        <div className="container nav-container">
          <Link to="/" className="logo layout-logo" style={{ gap: '10px' }} aria-label="EV-Net home">
            <img src={logoUrl} alt="EV-Net" />
            <span className="layout-role-badge">HOST</span>
          </Link>

          <ul className="nav-links">
            {navItems.map(item => {
              const active = isNavItemActive(location.pathname, item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    style={{ color: active ? 'var(--brand-cyan)' : undefined }}
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

            <button type="button" className="layout-signout" onClick={handleSignOut} aria-label="Sign out">
              <LogOut size={14} aria-hidden="true" />
              <span className="layout-signout-label">Sign Out</span>
            </button>
            <Link to="/host/profile" className="layout-avatar-link" aria-label="Your host profile">
              <Avatar
                src={user?.avatar}
                name={user?.name}
                size="36px"
                style={{ border: '2px solid var(--brand-cyan)' }}
              />
            </Link>
          </div>
        </div>
      </nav>

      <MobileNavStrip items={navItems} accent="var(--brand-cyan)" label="Host sections" />

      <main className="layout-main">
        {children}
      </main>
    </div>
  );
};

export default HostLayout;
