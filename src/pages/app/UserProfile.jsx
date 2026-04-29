import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { PakistanEVBrands, ConnectorType } from '../../data/schema';
import Avatar from '../../components/ui/Avatar';
import { profileService } from '../../data/api';
import { Camera, Loader2 } from 'lucide-react';
import '../../styles/auth.css';

const UserProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    evBrand: user?.evBrand || '',
    evModel: user?.evModel || '',
    connectorPreference: user?.connectorPreference || '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSave = () => {
    // In MVP, just close edit mode (would call API in production)
    setEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    setUploadError('');
    try {
      await profileService.uploadAvatar(user.id, file, 'USER');
      const { reloadUser } = useAuthStore.getState();
      await reloadUser();
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setUploadError('Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>My Profile</h2>

        {/* Avatar & Name */}
        <div className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1.5rem' }}>
            <Avatar 
              src={user?.avatar} 
              name={user?.name} 
              size="120px" 
              style={{ border: '4px solid var(--brand-green)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', cursor: 'pointer' }}
              onClick={handleAvatarClick}
            />
            {/* Hidden Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/jpeg, image/png" 
              style={{ display: 'none' }} 
            />
            
            {/* Premium Camera FAB */}
            <button 
              onClick={handleAvatarClick}
              disabled={isUploading}
              style={{
                position: 'absolute', bottom: '4px', right: '4px',
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--brand-green)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#000', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} strokeWidth={2.5} />}
            </button>
          </div>

          <h3 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-heading)' }}>{user?.name || 'User'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.3rem 0' }}>{user?.email}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.phone}</p>
          
          {uploadError && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.5rem' }}>{uploadError}</p>}
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
