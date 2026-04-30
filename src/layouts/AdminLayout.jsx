import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  Zap, 
  CalendarDays, 
  Users, 
  AlertTriangle,
  ArrowLeft,
  MessageSquare, LogOut } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import useAuthStore from '../store/authStore';
import '../components/Navbar.css';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const { logout } = useAuthStore();

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/verifications', label: 'Verification Queue', icon: ShieldCheck },
    { path: '/admin/listings', label: 'Listings', icon: Zap },
    { path: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/reports', label: 'Reports / Disputes', icon: AlertTriangle },
    { path: '/admin/conversations', label: 'Conversations', icon: MessageSquare },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px', minWidth: '260px', background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
        padding: '1.5rem 0',
      }}>
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src={logoUrl} alt="EV-Net" style={{ height: '32px', width: 'auto', borderRadius: '8px', boxShadow: '0 0 15px rgba(225, 29, 72, 0.3)' }} />
          </Link>
        </div>

        <div style={{
          margin: '0 1.25rem 1.5rem', padding: '0.6rem', borderRadius: '8px',
          background: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.2)',
          textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.5px',
          textTransform: 'uppercase', color: '#fb7185',
        }}>
          Moderation Console
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 0.75rem' }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '0.75rem 1rem', borderRadius: '10px',
                background: isActive ? 'rgba(225, 29, 72, 0.12)' : 'transparent',
                color: isActive ? '#fb7185' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400, fontSize: '0.9rem',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                textDecoration: 'none',
                border: isActive ? '1px solid rgba(225, 29, 72, 0.2)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <button onClick={() => logout()} style={{ 
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.85rem', color: 'var(--text-secondary)', 
            textDecoration: 'none', transition: 'color 0.2s', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-main)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)' }} />
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;

