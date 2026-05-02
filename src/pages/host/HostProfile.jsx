import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { hostService, profileService } from '../../data/api';
import { Check, Camera, Loader2 } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';

const HostProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const load = async () => {
      const p = await hostService.getProfile(user?.id || 'host_ahsan');
      setProfile(p);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    setUploadError('');
    try {
      await profileService.uploadAvatar(user.id, file, 'HOST');
      const { reloadUser } = useAuthStore.getState();
      await reloadUser();
    } catch (err) {
      console.error("Host avatar upload failed:", err);
      setUploadError('Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const statusConfig = {
    draft: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', label: 'Draft', desc: 'Complete your profile to get verified.' },
    pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', label: 'Pending Review', desc: 'Our team is reviewing your profile. This usually takes 1-2 business days.' },
    approved: { color: '#00D26A', bg: 'rgba(0,210,106,0.15)', label: 'Verified ✓', desc: 'Your profile is verified. You can list and manage chargers.' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Rejected', desc: 'Your profile was not approved. Please contact support.' },
  };

  statusConfig.under_review = statusConfig.pending;
  statusConfig.approved = { color: '#00D26A', bg: 'rgba(0,210,106,0.15)', label: 'Verified', desc: 'You are verified. You can list and manage chargers.' };
  statusConfig.rejected = { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Rejected', desc: 'Your host application was rejected. Please update your details and resubmit.' };

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;

  const verificationStatus = (profile?.verificationStatus || 'draft').toLowerCase();
  const status = statusConfig[verificationStatus] || statusConfig.draft;
  const checks = [
    { label: 'Phone Verified', done: profile?.phoneVerified },
    { label: 'Identity Verified', done: profile?.identityVerified },
    { label: 'Property Proof Uploaded', done: profile?.propertyProofUploaded },
    { label: 'Charger Proof Uploaded', done: profile?.chargerProofUploaded },
    { label: 'Payout Setup Complete', done: profile?.payoutSetupComplete },
  ];
  const completedChecks = checks.filter(c => c.done).length;

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>Host Profile</h2>

        {/* Avatar & Info */}
        <div className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1.25rem' }}>
            <Avatar 
              src={user?.avatar} 
              name={user?.name} 
              size="120px" 
              style={{ 
                border: profile?.verificationStatus === 'approved' ? '4px solid var(--brand-green)' : '4px solid var(--border-color)',
                boxShadow: profile?.verificationStatus === 'approved' ? '0 8px 24px rgba(0,210,106,0.2)' : '0 4px 12px rgba(0,0,0,0.2)',
                cursor: 'pointer'
              }}
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

          <h3 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'var(--font-heading)' }}>{user?.name}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.3rem 0' }}>{user?.email}</p>
          <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, background: status.bg, color: status.color }}>
            {status.label}
          </span>
          
          {uploadError && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '1rem' }}>{uploadError}</p>}
        </div>

        {/* Verification Progress */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>Verification Progress</h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{completedChecks}/{checks.length}</span>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
            <div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, var(--brand-green), var(--brand-cyan))', width: `${(completedChecks / checks.length) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {checks.map((check, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: check.done ? 'var(--brand-green)' : 'rgba(255,255,255,0.05)',
                  border: check.done ? 'none' : '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#000', fontSize: '0.7rem', fontWeight: 'bold',
                }}>
                  {check.done ? <Check size={14} strokeWidth={3} /> : ''}
                </div>
                <span style={{ color: check.done ? '#fff' : 'var(--text-secondary)', fontSize: '0.9rem' }}>{check.label}</span>
              </div>
            ))}
          </div>
          
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{status.desc}</p>

          {verificationStatus !== 'approved' && (
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/host/onboarding')}
              style={{ width: '100%', fontSize: '0.9rem' }}
            >
              {verificationStatus === 'rejected' ? 'Edit & Resubmit' : ['pending', 'under_review'].includes(verificationStatus) ? 'View Status' : 'Complete Verification'}
            </button>
          )}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{
          width: '100%', padding: '0.75rem', borderRadius: '8px',
          border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
          color: '#f87171', cursor: 'pointer', fontWeight: 500, fontSize: '0.95rem', fontFamily: 'var(--font-body)',
        }}>Log Out</button>
      </div>
    </div>
  );
};

export default HostProfile;
