import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import logoUrl from '../assets/logo.png';
import { getHomeRouteByRole } from '../utils/navigation';
import NotificationCenter from '../components/NotificationCenter';
import '../components/Navbar.css';

const AppLayout = ({ children }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: '/app/explore', label: 'Explore' },
    { path: '/app/bookings', label: 'Bookings' },
    { path: '/app/favorites', label: 'Saved' },
    { path: '/app/messages', label: 'Messages' },
    { path: '/app/profile', label: 'Profile' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="navbar nav-scrolled" style={{ position: 'relative', background: 'var(--bg-main)' }}>
        <div className="container nav-container" style={{ maxWidth: '100%' }}>
          <Link to="/" className="logo" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src={logoUrl} alt="EV-Net Logo" style={{ height: '32px', width: 'auto' }} />
          </Link>

          <ul className="nav-links">
            {navItems.map(item => (
              <li key={item.path}>
                <Link to={item.path} style={{ color: location.pathname === item.path ? 'var(--brand-green)' : undefined }}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <NotificationCenter />
            
            <Link to="/app/profile" style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: user?.avatar ? `url(${user.avatar}) center/cover` : 'var(--brand-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#000', fontWeight: 'bold', fontSize: '0.9rem',
              border: '2px solid var(--brand-green)',
            }}>
              {!user?.avatar && (user?.name?.[0] || 'U')}
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
