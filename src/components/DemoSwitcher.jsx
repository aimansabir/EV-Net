import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * Dev-only Demo Mode switcher.
 * 
 * Visibility rules:
 * 1. Only renders in development (import.meta.env.DEV)
 * 2. OR when ?demo=1 query param is present
 * 3. NEVER included in production navigation
 * 
 * Labeled clearly as "Demo Mode" — non-production.
 */
const DemoSwitcher = () => {
  const navigate = useNavigate();
  const { role, isAuthenticated, switchRole, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Guard: only show in dev mode or with ?demo=1 param
  const isDev = import.meta.env.DEV;
  const hasDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  
  if (!isDev && !hasDemo) return null;

  const handleSwitch = async (newRole) => {
    if (switching) return;
    setSwitching(true);
    try {
      await switchRole(newRole);
      switch (newRole) {
        case 'user': navigate('/app/explore'); break;
        case 'host': navigate('/host/dashboard'); break;
        case 'admin': navigate('/admin'); break;
        default: break;
      }
    } catch (err) {
      console.error('Demo switch failed:', err);
    }
    setSwitching(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const roles = [
    { key: 'user', label: 'EV User', icon: '🚗', color: '#00D26A' },
    { key: 'host', label: 'Host', icon: '🏠', color: '#00F0FF' },
    { key: 'admin', label: 'Admin', icon: '🛡️', color: '#e11d48' },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 99999,
      fontFamily: 'var(--font-body)',
    }}>
      {isOpen && (
        <div style={{
          background: 'rgba(11, 15, 25, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '16px',
          padding: '1.2rem',
          marginBottom: '0.75rem',
          width: '220px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#f87171',
            fontWeight: 700,
            marginBottom: '0.75rem',
            textAlign: 'center',
          }}>
            ⚠️ Demo Mode Only
          </div>
          
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '0.5rem', textAlign: 'center' }}>
            Current: <strong style={{ color: '#fff' }}>{isAuthenticated ? role : 'Guest'}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {roles.map(r => (
              <button
                key={r.key}
                onClick={() => handleSwitch(r.key)}
                disabled={switching || role === r.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: role === r.key ? `1px solid ${r.color}` : '1px solid rgba(255,255,255,0.1)',
                  background: role === r.key ? `${r.color}15` : 'transparent',
                  color: role === r.key ? r.color : '#9CA3AF',
                  cursor: role === r.key ? 'default' : 'pointer',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                <span>{r.icon}</span>
                <span>{r.label}</span>
                {role === r.key && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>●</span>}
              </button>
            ))}
          </div>

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.4rem',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#9CA3AF',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
              }}
            >
              Logout → Guest
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.2)',
          background: 'rgba(11, 15, 25, 0.9)',
          backdropFilter: 'blur(8px)',
          color: '#f87171',
          cursor: 'pointer',
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
        }}
        title="Demo Mode Switcher"
      >
        {isOpen ? '✕' : '⚡'}
      </button>
    </div>
  );
};

export default DemoSwitcher;
