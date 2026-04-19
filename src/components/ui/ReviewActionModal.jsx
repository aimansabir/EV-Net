import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, Download } from 'lucide-react';
import ValidatedInput from './ValidatedInput';

/**
 * ReviewActionModal
 * 
 * Admin tool for viewing submitted documents and submitting a
 * moderation status change (Approve, Reject, or Resubmit).
 */
const ReviewActionModal = ({ isOpen, onClose, user, targetType = 'evType', onSubmit }) => {
  const [action, setAction] = useState(null); // 'APPROVED' | 'REJECTED' | 'RESUBMISSION'
  const [notes, setNotes] = useState('');
  
  if (!isOpen || !user) return null;

  // Mock document placeholders based on targetType
  const mockDocs = targetType === 'evType' ? [
     { id: 1, name: 'CNIC_Front.jpg', type: 'image' },
     { id: 2, name: 'Vehicle_Registration.pdf', type: 'doc' },
  ] : [
     { id: 1, name: 'CNIC_Front.jpg', type: 'image' },
     { id: 2, name: 'Property_Deed.pdf', type: 'doc' },
     { id: 3, name: 'Charger_Unit.jpg', type: 'image' },
  ];

  const handleSubmit = () => {
    onSubmit({ action, notes });
  };

  const isNotesRequired = action === 'REJECTED' || action === 'RESUBMISSION';
  const isSubmitDisabled = !action || (isNotesRequired && notes.trim() === '');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#111822', border: '1px solid var(--border-color)', borderRadius: '16px',
        width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Verification Review</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Reviewing {targetType === 'evType' ? 'EV User' : 'Host'} submission for: <strong style={{ color: '#fff' }}>{user.name}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          
          <h4 style={{ margin: '0 0 1rem 0' }}>Submitted Documents</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
             {mockDocs.map(doc => (
                 <div key={doc.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ height: '120px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        {doc.type === 'image' ? <FileText size={32} /> : <FileText size={32} />}
                    </div>
                    <div style={{ padding: '0.8rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</span>
                        <Download size={16} color="var(--brand-cyan)" style={{ cursor: 'pointer', flexShrink: 0 }} />
                    </div>
                 </div>
             ))}
          </div>

          <h4 style={{ margin: '0 0 1rem 0' }}>Moderation Action</h4>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button 
                onClick={() => setAction('APPROVED')}
                style={{ 
                    flex: 1, padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                    border: action === 'APPROVED' ? '2px solid var(--brand-green)' : '1px solid var(--border-color)',
                    background: action === 'APPROVED' ? 'rgba(0,210,106,0.1)' : 'transparent',
                    color: action === 'APPROVED' ? 'var(--brand-green)' : '#fff', transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                }}>
                <CheckCircle size={24} />
                <span style={{ fontWeight: 600 }}>Approve</span>
            </button>
            <button 
                onClick={() => setAction('RESUBMISSION')}
                style={{ 
                    flex: 1, padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                    border: action === 'RESUBMISSION' ? '2px solid #fbbf24' : '1px solid var(--border-color)',
                    background: action === 'RESUBMISSION' ? 'rgba(251,191,36,0.1)' : 'transparent',
                    color: action === 'RESUBMISSION' ? '#fbbf24' : '#fff', transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                }}>
                <FileText size={24} />
                <span style={{ fontWeight: 600 }}>Request Fixed Docs</span>
            </button>
            <button 
                onClick={() => setAction('REJECTED')}
                style={{ 
                    flex: 1, padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                    border: action === 'REJECTED' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    background: action === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'transparent',
                    color: action === 'REJECTED' ? '#ef4444' : '#fff', transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
                }}>
                <AlertTriangle size={24} />
                <span style={{ fontWeight: 600 }}>Reject Account</span>
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
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                />
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isSubmitDisabled} onClick={handleSubmit}>
              Submit Decision
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReviewActionModal;
