import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertTriangle, FileText, PartyPopper } from 'lucide-react';
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
  const [uploading, setUploading] = useState({ cnic: false, cnic_back: false, ev: false, property: false, charger: false, email: false });
  const [uploadFeedback, setUploadFeedback] = useState({ cnic: null, cnic_back: null, ev: null, property: null, charger: null, email: null });
  const [replacing, setReplacing] = useState({ cnic: false, cnic_back: false, ev: false, property: false, charger: false });
  const [signedUrls, setSignedUrls] = useState({});

  // Auto-redirect if they are not a real user or not logged in
  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    let isMounted = true;
    const loadSignedUrls = async () => {
      const paths = {
        identity: user?.cnicPath,
        identity_back: user?.cnicBackPath,
        ev: user?.evProofPath,
        property: user?.propertyProofPath,
        charger: user?.chargerProofPath
      };

      const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [
        key,
        path ? await verificationService.getSignedUrl(path) : null
      ]));

      if (isMounted) {
        setSignedUrls(Object.fromEntries(entries));
      }
    };

    if (user) loadSignedUrls();
    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!user) return null;

  const isUnderReview = [VerificationStatus.UNDER_REVIEW, 'pending'].includes(user?.verificationStatus);
  const isApproved = user?.verificationStatus === VerificationStatus.APPROVED;
  const isRejected = user?.verificationStatus === VerificationStatus.REJECTED;
  const isHost = user?.role === 'HOST';

  const handleFileUpload = async (type, files) => {
    if (!files || files.length === 0) return;
    
    const docMap = {
      cnic: 'CNIC_FRONT',
      cnic_back: 'CNIC_BACK',
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

  const handleSubmit = async () => {
    // Role-specific validation (Phone is now optional)
    const missing = [];
    if (user?.role === 'HOST') {
      if (!user.cnicSubmitted) missing.push('CNIC front');
      if (!user.propertyProofUploaded) missing.push('property proof');
      if (!user.chargerProofUploaded) missing.push('charger proof');
    } else {
      if (!user.cnicSubmitted) missing.push('CNIC front');
      if (!user.cnicBackSubmitted) missing.push('CNIC back');
      if (!user.evProofSubmitted) missing.push('EV ownership proof');
    }

    if (missing.length > 0) {
      setError(`Please upload ${missing.join(', ')} before submitting for review.`);
      return;
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
      id: 'identity',
      title: 'Identity (CNIC) Front Side',
      description: 'Upload the front picture of your CNIC.',
      status: user?.cnicSubmitted ? 'completed' : 'action_required',
      path: user?.cnicPath,
      canEdit: true
    },
    {
      id: 'identity_back',
      title: 'Identity (CNIC) Back Side',
      description: 'Upload the back picture of your CNIC.',
      status: user?.cnicBackSubmitted ? 'completed' : 'action_required',
      path: user?.cnicBackPath,
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

  const missingRequirements = user?.role === 'HOST'
    ? [
        !user.cnicSubmitted && 'CNIC front',
        !user.cnicBackSubmitted && 'CNIC back',
        !user.propertyProofUploaded && 'property proof',
        !user.chargerProofUploaded && 'charger proof'
      ].filter(Boolean)
    : [
        !user.cnicSubmitted && 'CNIC front',
        !user.cnicBackSubmitted && 'CNIC back',
        !user.evProofSubmitted && 'EV ownership proof'
      ].filter(Boolean);
  const requiredDocumentsReady = missingRequirements.length === 0;

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
              <h4 style={{ margin: 0, color: 'var(--brand-green)' }}>{isHost ? 'Host verified' : 'You are verified.'}</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{isHost ? 'Your host account is verified.' : 'You have full booking access to the EV-Net network.'}</p>
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
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {isHost ? 'Your host application was rejected. Please update your details and resubmit.' : 'Please review your documents and resubmit.'}
              </p>
              {isHost && (
                <button className="btn btn-primary" style={{ marginTop: '0.75rem', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }} onClick={() => navigate('/host/onboarding')}>
                  Edit & Resubmit
                </button>
              )}
            </div>
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(0, 210, 106, 0.1)', border: '1px solid var(--brand-green)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: 'var(--brand-green)' }}><PartyPopper size={24} /></div>
            <div>
              <h4 style={{ margin: 0, color: 'var(--brand-green)' }}>Documents Submitted!</h4>

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
        {(!isApproved || success) && (
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
                                  } else {
                                    setUploadFeedback(prev => ({ ...prev, [step.id]: 'Verification request sent. Check your device.' }));
                                  }
                                }}
                              >
                                {uploading[step.id] ? 'Sending...' : 'Verify Now'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Document Preview & Replace UI */}
                        {!isUnderReview && !isApproved && !success && step.status === 'completed' && !replacing[step.id] && 
                         ['identity', 'identity_back', 'ev', 'property', 'charger'].includes(step.id) && (
                          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ width: '80px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {step.path ? (
                                <img 
                                  src={signedUrls[step.id] || verificationService.getPublicUrl(step.path)} 
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
                            <button onClick={() => setReplacing(prev => ({ ...prev, [step.id]: true }))} style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid var(--brand-cyan)', color: 'var(--brand-cyan)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                              Change Picture
                            </button>
                          </div>
                        )}

                        {/* Action Triggers for Uploads */}
                        {!isUnderReview && !isApproved && !success && (step.status === 'action_required' || replacing[step.id]) && step.id !== 'email' && step.id !== 'account' && (
                           <div style={{ marginTop: '1rem' }}>
                             <FileUploadDropzone 
                               accept="image/jpeg, image/png, application/pdf"
                               files={[]}
                               onChange={(files) => handleFileUpload(step.id === 'identity' ? 'cnic' : step.id === 'identity_back' ? 'cnic_back' : step.id, files)}
                               mode="document"
                               disabled={uploading[step.id === 'identity' ? 'cnic' : step.id === 'identity_back' ? 'cnic_back' : step.id]}
                             />
                             {uploading[step.id === 'identity' ? 'cnic' : step.id === 'identity_back' ? 'cnic_back' : step.id] && <p style={{ fontSize: '0.8rem', color: 'var(--brand-cyan)', marginTop: '0.5rem' }}>Uploading document...</p>}
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
                {!requiredDocumentsReady && (
                  <div className="auth-error" style={{ marginBottom: '1rem' }}>
                    Missing required document{missingRequirements.length > 1 ? 's' : ''}: {missingRequirements.join(', ')}.
                  </div>
                )}
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', fontWeight: 600, marginTop: '1rem' }}
                  onClick={handleSubmit}
                  disabled={loading || isUnderReview || isApproved || success || !requiredDocumentsReady}
                >
                  {loading ? 'Submitting...' : 'Submit Verification for Review'}
                </button>
              </div>
            )}
          </div>
        )}

        {isApproved && !success && (
          <div style={{ textAlign: 'center', marginTop: '4rem' }}>
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '50%', 
              background: 'rgba(0, 210, 106, 0.1)', border: '2px solid var(--brand-green)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 2rem', color: 'var(--brand-green)'
            }}>
              <CheckCircle size={48} />
            </div>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Verified Status</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Your account is fully verified. You can now use all features of the EV-Net network.
            </p>
            <button className="btn btn-secondary" onClick={() => navigate(isHost ? '/host/dashboard' : '/app/explore')}>
              Return to {isHost ? 'Dashboard' : 'Explore'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Verification;
