import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import useAuthStore from '../store/authStore';
import Avatar from './ui/Avatar';
import { getHomeRouteByRole } from '../utils/navigation';
import logoUrl from '../assets/logo.webp';
import './Navbar.css';

const SECTION_LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#solution', label: 'Solution' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#impact', label: 'Impact' },
  { href: '#network', label: 'Network' },
];

const DASHBOARD_LABELS = {
  host: 'Host Dashboard',
  admin: 'Admin Dashboard',
};

const PROFILE_ROUTES = {
  host: '/host/profile',
  admin: '/admin',
};

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isAuthenticated, role, isInitialized } = useAuthStore();

  const normalizedRole = role?.toLowerCase();
  const dashboardRoute = getHomeRouteByRole({ role: normalizedRole }) || '/app/explore';
  const dashboardLabel = DASHBOARD_LABELS[normalizedRole] || 'Explore';
  const profileRoute = PROFILE_ROUTES[normalizedRole] || '/app/profile';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogoClick = (e) => {
    setMenuOpen(false);
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={`navbar ${scrolled || menuOpen ? 'nav-scrolled' : ''} ${menuOpen ? 'nav-menu-open' : ''}`} aria-label="Main">
      <div className="container nav-container">
        <Link to="/" onClick={handleLogoClick} className="logo" aria-label="EV-Net home">
          <img src={logoUrl} alt="EV-Net" className="nav-logo-img" width="170" height="59" />
        </Link>

        <ul className="nav-links">
          {SECTION_LINKS.map(link => (
            <li key={link.href}><a href={link.href}>{link.label}</a></li>
          ))}
        </ul>

        <div className="nav-actions">
          {/* Prevent flicker: only render CTAs after auth initialization */}
          {!isInitialized ? (
            <div className="nav-actions-placeholder" aria-hidden="true" />
          ) : isAuthenticated ? (
            <>
              <Link to={dashboardRoute} className="btn btn-primary nav-btn">
                {dashboardLabel}
              </Link>
              <Link to={profileRoute} className="nav-avatar" aria-label="Your profile">
                <Avatar src={user?.avatar} name={user?.name} size="38px" />
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary nav-btn nav-btn-ghost">
                Log In
              </Link>
              <Link to="/signup/user" className="btn btn-primary nav-btn">
                Sign Up
              </Link>
            </>
          )}

          <button
            type="button"
            className="nav-menu-toggle"
            onClick={() => setMenuOpen(open => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="nav-mobile-menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="nav-mobile-menu" className="nav-mobile-menu container">
          <ul>
            {SECTION_LINKS.map(link => (
              <li key={link.href}>
                <a href={link.href} onClick={closeMenu}>{link.label}</a>
              </li>
            ))}
          </ul>
          {isInitialized && !isAuthenticated && (
            <div className="nav-mobile-actions">
              <Link to="/login" className="btn btn-secondary nav-mobile-login" onClick={closeMenu}>
                Log In
              </Link>
              <Link to="/signup/host" className="btn btn-secondary" onClick={closeMenu}>
                Become a Host
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
