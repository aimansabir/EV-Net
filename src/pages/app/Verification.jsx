import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertTriangle, FileText, UploadCloud, PartyPopper } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { authService, verificationService } from '../../data/api';
import { VerificationStatus } from '../../data/schema';
import FileUploadDropzone from '../../components/ui/FileUploadDropzone';

const Verification = () => {
  const { user, reloadUser } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState({ cnic: false, ev: false, property: false, charger: false, email: false, phone: false });
  const [uploadFeedback, setUploadFeedback] = useState({ cnic: null, ev: null, property: null, charger: null, email: null, phone: null });
  const [replacing, setReplacing] = useState({ cnic: false, ev: false, property: false, charger: false });
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Auto-redirect if they are not a real user or not logged in
  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const isUnderReview = user?.verificationStatus === VerificationStatus.UNDER_REVIEW;
  const isApproved = user?.verificationStatus === VerificationStatus.APPROVED;
  const isRejected = user?.verificationStatus === VerificationStatus.REJECTED;

  const handleFileUpload = async (type, files) => {
    if (!files || files.length === 0) return;
    
    const docMap = {
      cnic: 'CNIC_FRONT',
      ev: 'EV_PROOF',
      property: 'PROPERTY_PROOF',
      charger: 'CHARGER_PROOF'
    };
    
    const docType = docMap[type];
    const profileType = user?.role === 'HOST' ? 'HOST' : 'EV_USER';
    
    setUploading(prev => ({ ...prev, [type]: true }));
    setUploadFeedback(prev => ({ ...prev, [type]: null }));

    try {
      console.log(`[EV-Net] handleFileUpload triggered for ${type}`, files);
      // files[0] is an object { file, id, preview, isImage } from FileUploadDropzone
      const actualFile = files[0]?.file;
      if (!actualFile) throw new Error("No file object found in dropzone response.");
      
      console.log(`[EV-Net] Calling verificationService.uploadDocument...`);
      await verificationService.uploadDocument(user.id, profileType, docType, actualFile);
      console.log(`[EV-Net] uploadDocument resolved.`);
      
      // Update local feedback
      setUploadFeedback(prev => ({ ...prev, [type]: 'success' }));
      
      // Reset replacing state (Check both cnic and identity keys to be safe)
      setReplacing(prev => ({ ...prev, [type]: false, identity: type === 'cnic' ? false : prev.identity }));
      
      await reloadUser();
    } catch (err) {
      setUploadFeedback(prev => ({ ...prev, [type]: err.message || 'Upload failed.' }));
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleEmailVerify = async () => {
    setUploading(prev => ({ ...prev, email: true }));
    setUploadFeedback(prev => ({ ...prev, email: null }));
    try {
      await authService.sendVerificationEmail(user.email);
      setUploadFeedback(prev => ({ ...prev, email: 'Verification email sent! Please check your inbox (and spam folder).' }));
    } catch (err) {
      setUploadFeedback(prev => ({ ...prev, email: err.message || 'Failed to send verification email.' }));
    } finally {
      setUploading(prev => ({ ...prev, email: false }));
    }
  };

  const handlePhoneVerifySend = async () => {
    if (!user?.phone) {
      setUploadFeedback(prev => ({ ...prev, phone: 'No phone number found in profile. Please add one in Settings.' }));
      return;
    }
    setUploading(prev => ({ ...prev, phone: true }));
    setUploadFeedback(prev => ({ ...prev, phone: null }));
    try {
      await authService.sendPhoneOTP(user.phone);
      setOtpSent(true);
      setUploadFeedback(prev => ({ ...prev, phone: 'OTP sent to WhatsApp!' }));
    } catch (err) {
      setUploadFeedback(prev => ({ ...prev, phone: err.message || 'Failed to send OTP.' }));
    } finally {
      setUploading(prev => ({ ...prev, phone: false }));
    }
  };

  const handlePhoneVerifySubmit = async () => {
    if (!otpCode || otpCode.length < 6) {
      setUploadFeedback(prev => ({ ...prev, phone: 'Please enter a valid 6-digit code.' }));
      return;
    }
    setUploading(prev => ({ ...prev, phone: true }));
    setUploadFeedback(prev => ({ ...prev, phone: null }));
    try {
      await authService.verifyPhoneOTP(user.phone, otpCode, user.role);
      setUploadFeedback(prev => ({ ...prev, phone: 'Phone verified successfully!' }));
      setOtpSent(false);
      setOtpCode('');
      await reloadUser();
    } catch (err) {
      setUploadFeedback(prev => ({ ...prev, phone: err.message || 'Invalid OTP code.' }));
    } finally {
      setUploading(prev => ({ ...prev, phone: false }));
    }
  };

  const handleSubmit = async () => {
    // Role-specific validation (Phone is now optional)
    if (user?.role === 'HOST') {
      if (!user.cnicSubmitted || !user.propertyProofUploaded || !user.chargerProofUploaded) {
        setError('Please upload all required host documents before submitting for review.');
        return;
      }
    } else {
      if (!user.cnicSubmitted || !user.evProofSubmitted) {
        setError('Please upload both CNIC and EV ownership proof before submitting for review.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const profileType = user?.role === 'HOST' ? 'HOST' : 'EV_USER';
      await authService.submitUserVerification(user.id, profileType);
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
      description: user?.authProvider === 'google' 
        ? 'Verified through Google sign-in' 
        : `Check your inbox (${user?.email}) for a magic link.`,
      status: user?.emailVerified ? 'completed' : 'pending',
    },
    {
      id: 'phone',
      title: 'Phone Verification (Optional)',
      description: 'We will send a 6-digit OTP code to your registered mobile.',
      status: user?.phoneVerified ? 'completed' : 'pending',
    },
    {
      id: 'identity',
      title: 'Identity (CNIC) Upload',
      description: 'Upload the front picture of your CNIC.',
      status: user?.cnicSubmitted ? 'completed' : 'action_required',
      path: user?.cnicPath,
      canEdit: true
    },
    ...(user?.role === 'HOST' ? [
      {
        id: 'property',
        title: 'Property Proof',
        description: 'Upload a utility bill or registry doc for your charging location.',
        status: user?.propertyProofUploaded ? 'completed' : 'action_required',
        path: user?.propertyProofPath,
        canEdit: true
      },
      {
        id: 'charger',
        title: 'Charger Spec Proof',
        description: 'Upload a photo of your charger nameplate or spec sheet.',
        status: user?.chargerProofUploaded ? 'completed' : 'action_required',
        path: user?.chargerProofPath,
        canEdit: true
      }
    ] : [
      {
        id: 'ev',
        title: 'EV Ownership Proof',
        description: 'Upload your vehicle registration linking your EV Brand and Model.',
        status: user?.evProofSubmitted ? 'completed' : 'action_required',
        path: user?.evProofPath,
        canEdit: true
      }
    ])
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 0.3rem 0', color: isCompleted ? '#fff' : 'var(--text-primary)' }}>{step.title}</h4>
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>{step.description}</p>
                        </div>
                        
                        {!isCompleted && !isUnderReview && !isApproved && step.status === 'pending' && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} 
                              disabled={uploading[step.id]}
                              onClick={() => {
                                if (step.id === 'email') {
                                  handleEmailVerify();
                                } else if (step.id === 'phone') {
                                  handlePhoneVerifySend();
                                } else {
                                  setUploadFeedback(prev => ({ ...prev, [step.id]: 'Verification request sent. Check your device.' }));
                                }
                              }}
                            >
                              {uploading[step.id] ? 'Sending...' : 'Verify Now'}
                            </button>
                            {uploadFeedback[step.id] && (
                              <span style={{ 
                                fontSize: '0.7rem', 
                                color: (uploadFeedback[step.id].includes('sent') || uploadFeedback[step.id].includes('verified')) ? 'var(--brand-green)' : '#f87171' 
                              }}>
                                {uploadFeedback[step.id]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Phone OTP Input */}
                      {step.id === 'phone' && otpSent && !isCompleted && !isUnderReview && !isApproved && (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '250px', alignSelf: 'flex-end' }}>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="6-digit OTP" 
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', padding: '0.6rem' }}
                          />
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.6rem' }}
                            onClick={handlePhoneVerifySubmit}
                            disabled={uploading.phone}
                          >
                            {uploading.phone ? 'Verifying...' : 'Submit OTP'}
                          </button>
                          <button 
                            className="btn-text" 
                            style={{ fontSize: '0.75rem', color: 'var(--brand-cyan)' }}
                            onClick={handlePhoneVerifySend}
                            disabled={uploading.phone}
                          >
                            Resend Code
                          </button>
                        </div>
                      )}
                      {/* Document Preview & Replace UI (Only for actual document steps) */}
                      {!isUnderReview && !isApproved && !success && step.status === 'completed' && !replacing[step.id] && 
                       ['identity', 'ev', 'property', 'charger'].includes(step.id) && (
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <div style={{ width: '80px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {step.path ? (
                              <img 
                                src={verificationService.getPublicUrl(step.path)} 
                                alt="Preview" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                onError={(e) => { e.target.src = ''; e.target.parentElement.innerHTML = '<span style="font-size: 0.6rem; color: var(--text-secondary)">PDF / Doc</span>'; }}
                              />
                            ) : (
                              <FileText size={20} color="var(--text-secondary)" />
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Document Uploaded</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click change to replace with a new file.</p>
                          </div>
                          <button 
                            onClick={() => setReplacing(prev => ({ ...prev, [step.id]: true }))}
                            style={{ 
                              background: 'rgba(0, 240, 255, 0.1)', 
                              border: '1px solid var(--brand-cyan)', 
                              color: 'var(--brand-cyan)', 
                              padding: '0.5rem 1rem', 
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(0, 240, 255, 0.2)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(0, 240, 255, 0.1)'}
                          >
                            Change Picture
                          </button>
                        </div>
                      )}

                      {/* Action Triggers for Uploads */}
                      {!isUnderReview && !isApproved && !success && (step.status === 'action_required' || replacing[step.id]) && step.id !== 'email' && step.id !== 'phone' && step.id !== 'account' && (
                         <div style={{ marginTop: '1rem' }}>
                           <FileUploadDropzone 
                             accept="image/jpeg, image/png, application/pdf"
                             files={[]}
                             onChange={(files) => handleFileUpload(step.id === 'identity' ? 'cnic' : step.id, files)}
                             mode="document"
                             disabled={uploading[step.id === 'identity' ? 'cnic' : step.id]}
                           />
                           {uploading[step.id === 'identity' ? 'cnic' : step.id] && <p style={{ fontSize: '0.8rem', color: 'var(--brand-cyan)', marginTop: '0.5rem' }}>Uploading document...</p>}
                           
                           {replacing[step.id] && (
                             <button 
                               onClick={() => setReplacing(prev => ({ ...prev, [step.id]: false }))}
                               style={{ 
                                 background: 'rgba(255, 255, 255, 0.05)', 
                                 border: '1px solid var(--border-color)', 
                                 color: 'var(--text-secondary)', 
                                 padding: '0.4rem 0.8rem', 
                                 borderRadius: '6px',
                                 fontSize: '0.75rem',
                                 fontWeight: 500,
                                 marginTop: '0.75rem',
                                 cursor: 'pointer',
                                 transition: 'all 0.2s'
                               }}
                               onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                               onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                             >
                               Cancel Change
                             </button>
                           )}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Action */}
          {!isUnderReview && !isApproved && !success && (
            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, marginTop: '1rem' }}
                onClick={handleSubmit}
                disabled={loading || isUnderReview || isApproved || success}
              >
                {loading ? 'Submitting...' : (isUnderReview || isApproved || success) ? 'Verification Submitted' : 'Submit Verification for Review'}
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
