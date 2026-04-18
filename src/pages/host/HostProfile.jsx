import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { hostService } from '../../data/api';
import { Check } from 'lucide-react';

const HostProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const p = await hostService.getProfile(user?.id || 'host_ahsan');
      setProfile(p);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleLogout = () => { logout(); navigate('/'); };

  const statusConfig = {
    draft: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', label: 'Draft', desc: 'Complete your profile to get verified.' },
    pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', label: 'Pending Review', desc: 'Our team is reviewing your profile. This usually takes 1-2 business days.' },
    approved: { color: '#00D26A', bg: 'rgba(0,210,106,0.15)', label: 'Verified ✓', desc: 'Your profile is verified. You can list and manage chargers.' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Rejected', desc: 'Your profile was not approved. Please contact support.' },
  };

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;

  const status = statusConfig[profile?.verificationStatus] || statusConfig.draft;
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
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1rem',
            background: user?.avatar ? `url(${user.avatar}) center/cover` : 'var(--brand-cyan)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 'bold', fontSize: '2rem',
            border: profile?.verificationStatus === 'approved' ? '3px solid var(--brand-green)' : '3px solid var(--border-color)',
          }}>
            {!user?.avatar && (user?.name?.[0] || 'H')}
          </div>
          <h3 style={{ margin: 0 }}>{user?.name}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.3rem 0' }}>{user?.email}</p>
          <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, background: status.bg, color: status.color }}>
            {status.label}
          </span>
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
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{status.desc}</p>
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
