import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, Download, Loader2 } from 'lucide-react';

/**
 * ReviewActionModal
 * 
 * Admin tool for viewing submitted documents and submitting a
 * moderation status change (Approve or Reject).
 */
const ReviewActionModal = ({ isOpen, onClose, user, targetType = 'evType', submission, onSubmit, readOnly = false }) => {
  const [action, setAction] = useState(null); // 'APPROVED' | 'REJECTED'
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setAction(null);
    setNotes('');
    setIsSubmitting(false);
    setSubmitError(null);
    setValidationError(null);
  }, [isOpen, submission?.id]);
  
  if (!isOpen || !user) return null;

  // Map real document paths from the submission object
  const realDocs = [];
  if (submission?.cnic_path) {
    realDocs.push({ id: 'cnic', name: 'CNIC Front', path: submission.cnic_path, url: submission.documentUrls?.cnic_path });
  }
  if (submission?.cnic_back_path) {
    realDocs.push({ id: 'cnic_back', name: 'CNIC Back', path: submission.cnic_back_path, url: submission.documentUrls?.cnic_back_path });
  }
  if (submission?.ev_proof_path) {
    realDocs.push({ id: 'ev', name: 'EV Ownership Proof', path: submission.ev_proof_path, url: submission.documentUrls?.ev_proof_path });
  }
  if (submission?.property_proof_path) {
    realDocs.push({ id: 'property', name: 'Property Proof', path: submission.property_proof_path, url: submission.documentUrls?.property_proof_path });
  }
  if (submission?.charger_proof_path) {
    realDocs.push({ id: 'charger', name: 'Charger Spec Proof', path: submission.charger_proof_path, url: submission.documentUrls?.charger_proof_path });
  }

  const getDocUrl = (doc) => doc?.url || null;
  const normalizedStatus = (submission?.currentStatus || submission?.status || '').toLowerCase();
  const decisionNotes = submission?.moderationNotes || submission?.reviewer_notes || submission?.admin_notes;
  const reviewedAt = submission?.reviewed_at || submission?.reviewedAt || submission?.verified_at;

  const handleSubmit = async () => {
    console.log('[Admin] ReviewActionModal submit clicked', {
      action,
      notes,
      targetType,
      submission,
      hasOnSubmit: typeof onSubmit === 'function',
    });

    // reset previous errors
    setValidationError(null);
    setSubmitError(null);

    if (isSubmitting) {
      console.warn('[Admin] ReviewActionModal submit ignored: already submitting');
      return;
    }

    // client-side validation
    if (!action) {
      setValidationError('Please select Approve or Reject before submitting.');
      return;
    }
    if (action === 'REJECTED' && notes.trim() === '') {
      setValidationError('Moderator notes are required when rejecting.');
      return;
    }

    if (typeof onSubmit !== 'function') {
      setSubmitError('No submit handler provided.');
      console.error('[Admin] ReviewActionModal missing onSubmit callback');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('[Admin] ReviewActionModal calling parent onSubmit...');
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Review submit timed out. Please retry.')), 15000);
      });
      const result = await Promise.race([
        onSubmit({
          action,
          notes: notes.trim(),
          targetType,
          submission,
          user,
        }),
        timeout
      ]).finally(() => clearTimeout(timeoutId));
      console.log('[Admin] ReviewActionModal parent onSubmit resolved:', result);
      if (result?.success === false) {
        throw new Error(result.error || 'Review failed.');
      }
    } catch (err) {
      console.error('[Admin] ReviewActionModal submit failed:', err);
      setSubmitError(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNotesRequired = action === 'REJECTED';
  const isSubmitDisabled = !action || (isNotesRequired && notes.trim() === '');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#111822', border: '1px solid var(--border-color)', borderRadius: '16px',
        width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>{readOnly ? 'Review Decision' : 'Verification Review'}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Reviewing {(targetType === 'hostType') ? 'Host' : targetType === 'payment' ? 'Payment' : 'EV User'} submission for: <strong style={{ color: '#fff' }}>{user.name}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          
          {targetType === 'payment' ? (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Method: <strong style={{ color: 'var(--brand-cyan)' }}>{submission?.method?.replace('_', ' ')}</strong></p>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Amount: <strong style={{ color: 'var(--brand-green)' }}>PKR {submission?.amount}</strong></p>
              </div>
              
              {submission?.screenshot_path && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  {submission.receiptUrl ? (
                    <img 
                      src={submission.receiptUrl}
                      alt="Payment Proof" 
                      style={{ width: '100%', display: 'block' }} 
                    />
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Payment receipt preview unavailable.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <h4 style={{ margin: '0 0 1rem 0' }}>Submitted Documents</h4>
              {realDocs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)', marginBottom: '2rem' }}>
                  <AlertTriangle size={24} color="#fbbf24" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No document paths found in this submission record.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                   {realDocs.map(doc => (
                       <div key={doc.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                          <div style={{ minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <img 
                                src={getDocUrl(doc)} 
                                alt={doc.name} 
                                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} 
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div style={{ display: 'none', height: '120px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '10px' }}>
                                <FileText size={48} opacity={0.3} />
                                <span style={{ fontSize: '0.8rem' }}>Preview unavailable</span>
                              </div>
                          </div>
                          <div style={{ padding: '0.8rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a222e' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{doc.name}</span>
                              {getDocUrl(doc) && (
                                <a href={getDocUrl(doc)} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-cyan)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.8rem' }}>
                                  <Download size={16} /> Full View
                                </a>
                              )}
                          </div>
                       </div>
                   ))}
                </div>
              )}
            </>
          )}

          {readOnly ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {normalizedStatus === 'approved' || normalizedStatus === 'verified' ? <CheckCircle size={20} color="var(--brand-green)" /> : <AlertTriangle size={20} color="#ef4444" />}
                Review Decision
              </h4>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                Status: <strong style={{ color: normalizedStatus === 'approved' || normalizedStatus === 'verified' ? 'var(--brand-green)' : '#ef4444' }}>{(submission?.currentStatus || submission?.status || '').toUpperCase()}</strong>
              </p>
              {reviewedAt && (
                 <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                   Reviewed On: {new Date(reviewedAt).toLocaleString()}
                 </p>
              )}
              {decisionNotes && (
                <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Notes:</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{decisionNotes}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <h4 style={{ margin: '0 0 1rem 0' }}>Moderation Action</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  type="button"
                  onClick={() => { setAction('APPROVED'); setValidationError(null); console.log('[Admin] action=APPROVED'); }}
                    style={{ 
                        flex: 1, padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                        border: action === 'APPROVED' ? '2px solid var(--brand-green)' : '1px solid var(--border-color)',
                        background: action === 'APPROVED' ? 'rgba(0,210,106,0.1)' : 'transparent',
                        color: action === 'APPROVED' ? 'var(--brand-green)' : '#fff', transition: 'all 0.2s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <CheckCircle size={24} />
                    <span style={{ fontWeight: 600 }}>{targetType === 'payment' ? 'Approve Payment' : 'Approve Account'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => { setAction('REJECTED'); setValidationError(null); console.log('[Admin] action=REJECTED'); }}
                    style={{ 
                        flex: 1, padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                        border: action === 'REJECTED' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                        background: action === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'transparent',
                        color: action === 'REJECTED' ? '#ef4444' : '#fff', transition: 'all 0.2s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <AlertTriangle size={24} />
                    <span style={{ fontWeight: 600 }}>{targetType === 'payment' ? 'Reject Payment' : 'Reject Account'}</span>
                </button>
              </div>

              {action && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px' }}>
                        Moderator Notes {isNotesRequired && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <textarea 
                        className="auth-input" 
                        rows={3} 
                        placeholder={isNotesRequired ? "You must explain exactly what needs fixing so the user can correct it." : "Optional internal notes..."}
                        value={notes}
                        onChange={(e) => { setNotes(e.target.value); if (validationError) setValidationError(null); }}
                        style={{ resize: 'vertical' }}
                    />
                </div>
              )}

              {(validationError || submitError) && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', color: '#ffb6b6' }}>
                  {validationError || submitError}
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
          <button className="btn btn-secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
          {!readOnly && (
            <button className="btn btn-primary" disabled={isSubmitDisabled || isSubmitting} onClick={handleSubmit}>
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Decision'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReviewActionModal;
