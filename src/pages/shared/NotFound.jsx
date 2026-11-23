import React from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getHomeRouteByRole } from '../../utils/navigation';

const NotFound = () => {
  const { isAuthenticated, user } = useAuthStore();
  const home = isAuthenticated ? getHomeRouteByRole(user) : '/';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        padding: '2rem 1rem',
        textAlign: 'center',
        background: 'var(--bg-main)',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 210, 106, 0.1)',
          border: '1px solid var(--border-glow)',
          color: 'var(--brand-green)',
        }}
      >
        <Zap size={28} aria-hidden="true" />
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--brand-cyan)' }}>
        Error 404
      </p>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}>
        This charger is <span className="text-gradient">off the grid</span>
      </h1>
      <p style={{ margin: 0, maxWidth: 440, color: 'var(--text-secondary)' }}>
        The page you're looking for doesn't exist or may have moved.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to={home} className="btn btn-primary">
          {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
        </Link>
        {!isAuthenticated && (
          <Link to="/login" className="btn btn-secondary">Log in</Link>
        )}
      </div>
    </main>
  );
};

export default NotFound;
