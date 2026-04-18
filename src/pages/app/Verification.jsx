import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertTriangle, FileText, UploadCloud, PartyPopper } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { authService } from '../../data/api';
import { VerificationStatus } from '../../data/schema';

const Verification = () => {
  const { user, reloadUser } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Auto-redirect if they are not a real user or not logged in
  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const isUnderReview = user?.verificationStatus === VerificationStatus.UNDER_REVIEW;
  const isApproved = user?.verificationStatus === VerificationStatus.APPROVED;
  const isRejected = user?.verificationStatus === VerificationStatus.REJECTED;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.submitUserVerification(user.id);
      await reloadUser();
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to submit verification.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      id: 'account',
      title: 'Account Created',
      description: 'Your fundamental account profile exists.',
      status: 'completed',
    },
    {
      id: 'email',
      title: 'Email Verification',
      description: 'Check your inbox for a magic link.',
      status: user?.emailVerified ? 'completed' : 'pending',
    },
    {
      id: 'phone',
      title: 'Phone Verification',
      description: 'We will send a 6-digit OTP code to your registered mobile.',
      status: user?.phoneVerified ? 'completed' : 'pending',
    },
    {
      id: 'identity',
      title: 'Identity (CNIC) Upload',
      description: 'Upload the front picture of your CNIC.',
      status: user?.cnicSubmitted ? 'completed' : 'action_required',
    },
    {
      id: 'ev',
      title: 'EV Ownership Proof',
      description: 'Upload your vehicle registration linking your EV Brand and Model.',
      status: user?.evProofSubmitted ? 'completed' : 'action_required',
    },
  ];

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '700px' }}>
        
        {/* Header Block */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>Trust & Verification</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
            EV-Net is a private community. To unlock charger addresses and booking privileges, please verify your identity and EV ownership.
          </p>
        </div>

        {/* Status Banner */}
        {isApproved && (
          <div style={{ background: 'rgba(0, 210, 106, 0.1)', border: '1px solid var(--brand-green)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--brand-green)' }}><CheckCircle size={24} /></div>
            <div>
              <h4 style={{ margin: 0, color: 'var(--brand-green)' }}>Account Verified</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You have full booking access to the EV-Net network.</p>
            </div>
          </div>
        )}

        {isUnderReview && !success && (
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: '#fbbf24' }}><Clock size={24} /></div>
            <div>
              <h4 style={{ margin: 0, color: '#fbbf24' }}>Verification Under Review</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Our team is reviewing your documents. This usually takes under 2 hours.</p>
            </div>
          </div>
        )}

        {isRejected && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--brand-red, #ef4444)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: '#ef4444' }}><AlertTriangle size={24} /></div>
            <div>
              <h4 style={{ margin: 0, color: '#ef4444' }}>Verification Rejected</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Please review your documents and resubmit.</p>
            </div>
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(0, 210, 106, 0.1)', border: '1px solid var(--brand-green)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--brand-green)' }}><PartyPopper size={24} /></div>
            <div>
              <h4 style={{ margin: 0, color: 'var(--brand-green)' }}>Documents Submitted!</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Thank you. Your verification is now under review by our admin team.</p>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <h3 style={{ marginBottom: '2rem', fontFamily: 'var(--font-heading)' }}>Verification Checklist</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {steps.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              
              return (
                <div key={step.id} style={{ display: 'flex', gap: '1rem', opacity: (isUnderReview || isApproved) && !isCompleted ? 0.6 : 1 }}>
                  
                  {/* Icon Node */}
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCompleted ? 'rgba(0, 210, 106, 0.15)' : 'var(--bg-secondary)',
                    border: isCompleted ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                    color: isCompleted ? 'var(--brand-green)' : 'var(--text-secondary)'
                  }}>
                    {isCompleted ? '✓' : (idx + 1)}
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: '1.5rem', borderBottom: idx !== steps.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.3rem 0', color: isCompleted ? '#fff' : 'var(--text-primary)' }}>{step.title}</h4>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>{step.description}</p>
                      </div>
                      
                      {/* Action Triggers */}
                      {!isCompleted && !isUnderReview && !isApproved && step.status === 'action_required' && (
                        <div style={{
                          padding: '2rem', width: '100%', marginTop: '1rem',
                          background: 'rgba(11, 15, 25, 0.5)', border: '1px dashed var(--border-color)', borderRadius: '8px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
                        }}
                        onClick={() => {
                          alert('Mock Upload Dialog Opened. Document simulated as attached.');
                        }}
                        >
                          <UploadCloud size={24} style={{ color: 'var(--brand-cyan)' }} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--brand-cyan)' }}>Click to Upload Document</span>
                        </div>
                      )}
                      {!isCompleted && !isUnderReview && !isApproved && step.status === 'pending' && (
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => alert('Mock Verification Link/OTP Sent')}>Verify Now</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Action */}
          {!isUnderReview && !isApproved && (
            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Verification for Review'}
              </button>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '1rem' }}>
                By submitting, you confirm that these documents belong to you.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Verification;
