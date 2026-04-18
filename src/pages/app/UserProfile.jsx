import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { PakistanEVBrands, ConnectorType } from '../../data/schema';
import '../../styles/auth.css';

const UserProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    evBrand: user?.evBrand || '',
    evModel: user?.evModel || '',
    connectorPreference: user?.connectorPreference || '',
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSave = () => {
    // In MVP, just close edit mode (would call API in production)
    setEditing(false);
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>My Profile</h2>

        {/* Avatar & Name */}
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1rem',
            background: user?.avatar ? `url(${user.avatar}) center/cover` : 'var(--brand-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 'bold', fontSize: '2rem',
            border: '3px solid var(--brand-green)',
          }}>
            {!user?.avatar && (user?.name?.[0] || 'U')}
          </div>
          <h3 style={{ margin: 0 }}>{user?.name || 'User'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.3rem 0' }}>{user?.email}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.phone}</p>
        </div>

        {/* EV Details */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>EV Details</h4>
            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="auth-field">
                <label>EV Brand</label>
                <select className="auth-select" value={formData.evBrand} onChange={e => setFormData({ ...formData, evBrand: e.target.value, evModel: '' })}>
                  <option value="">Select Brand</option>
                  {PakistanEVBrands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>)}
                </select>
              </div>
              <div className="auth-field">
                <label>EV Model</label>
                <select 
                  className="auth-select" 
                  value={formData.evModel} 
                  onChange={e => setFormData({ ...formData, evModel: e.target.value })}
                  disabled={!formData.evBrand}
                >
                  <option value="">{formData.evBrand ? 'Select Model' : 'Select Brand First'}</option>
                  {(PakistanEVBrands.find(b => b.brand === formData.evBrand)?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="auth-field">
                <label>Connector Preference</label>
                <select className="auth-select" value={formData.connectorPreference} onChange={e => setFormData({ ...formData, connectorPreference: e.target.value })}>
                  <option value="">Select</option>
                  {Object.values(ConnectorType).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '0.5rem' }}>Save Changes</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Brand</span>
                <span>{user?.evBrand || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Model</span>
                <span>{user?.evModel || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Connector</span>
                <span>{user?.connectorPreference || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Verification Status */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: user?.verificationStatus === 'approved' ? 'rgba(0, 210, 106, 0.05)' : 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Trust & Verification</h4>
              {user?.verificationStatus === 'approved' ? (
                <p style={{ margin: 0, color: 'var(--brand-green)', fontSize: '0.85rem' }}>✅ Fully Verified EV User</p>
              ) : user?.verificationStatus === 'under_review' ? (
                <p style={{ margin: 0, color: '#fbbf24', fontSize: '0.85rem' }}>⏳ Documents Under Review</p>
              ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Action required to unlock booking</p>
              )}
            </div>
            {user?.verificationStatus !== 'approved' && (
              <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate('/app/verification')}>
                {user?.verificationStatus === 'under_review' ? 'View Status' : 'Complete Profile'}
              </button>
            )}
          </div>
        </div>

        {/* Account Actions */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Account</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Member Since</span>
            <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'long' }) : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Role</span>
            <span style={{ textTransform: 'capitalize' }}>{user?.role?.toLowerCase() || 'user'}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem',
              fontFamily: 'var(--font-body)', transition: 'all 0.2s',
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
