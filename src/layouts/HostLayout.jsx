import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import logoUrl from '../assets/logo.png';
import { getHomeRouteByRole } from '../utils/navigation';
import '../components/Navbar.css';

const HostLayout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/host/dashboard', label: 'Dashboard' },
    { path: '/host/listings', label: 'Listings' },
    { path: '/host/bookings', label: 'Bookings' },
    { path: '/host/availability', label: 'Availability' },
    { path: '/host/messages', label: 'Messages' },
    { path: '/host/earnings', label: 'Earnings' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="navbar nav-scrolled" style={{ position: 'relative', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container nav-container" style={{ maxWidth: '100%' }}>
          <Link to="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src={logoUrl} alt="EV-Net Logo" style={{ height: '32px', width: 'auto' }} />
            <div>
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', background: 'var(--brand-green)', color: '#000', borderRadius: '4px', fontWeight: 700 }}>HOST</span>
            </div>
          </Link>

          <ul className="nav-links">
            {navItems.map(item => (
              <li key={item.path}>
                <Link to={item.path} style={{ color: location.pathname === item.path ? 'var(--brand-cyan)' : undefined }}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => { logout(); navigate('/'); }}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Sign Out
            </button>
            <Link to="/host/profile" style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: user?.avatar ? `url(${user.avatar}) center/cover` : 'var(--brand-cyan)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#000', fontWeight: 'bold', fontSize: '0.9rem',
              border: '2px solid var(--brand-cyan)',
            }}>
              {!user?.avatar && (user?.name?.[0] || 'H')}
            </Link>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-main)' }}>
        {children}
      </main>
    </div>
  );
};

export default HostLayout;
