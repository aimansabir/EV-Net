import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import logoUrl from '../assets/logo.png';
import './Navbar.css';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role, isInitialized } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogoClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className={`navbar ${scrolled ? 'nav-scrolled' : ''}`}>
      <div className="container nav-container">
        <Link
          to="/"
          onClick={handleLogoClick}
          className="logo"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', cursor: 'pointer' }}
        >
          <img src={logoUrl} alt="EV-Net Logo" style={{ width: '170px', height: '60px' }} />
          <div>

          </div>
        </Link>

        <ul className="nav-links">
          <li><a href="#problem">Problem</a></li>
          <li><a href="#solution">Solution</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#impact">Impact</a></li>
          <li><a href="#network">Network</a></li>
        </ul>

        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '200px', justifyContent: 'flex-end' }}>
          {/* Prevent flicker: only render CTAs after auth initialization */}
          {!isInitialized ? (
            <div style={{ width: '100px', height: '40px' }} /> /* Stable placeholder */
          ) : isAuthenticated ? (
            <button
              className="btn btn-primary"
              onClick={() => navigate(role === 'host' ? '/host/dashboard' : role === 'admin' ? '/admin' : '/app/explore')}
              style={{ fontSize: '0.9rem' }}
            >
              {role === 'host' ? 'Host Dashboard' : role === 'admin' ? 'Admin Dashboard' : 'Explore'}
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '0.9rem', border: '1px solid var(--border-color)', background: 'transparent' }}>
                Log In
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/signup/user')} style={{ fontSize: '0.9rem' }}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
