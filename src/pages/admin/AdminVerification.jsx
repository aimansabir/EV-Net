import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Home, Clock, AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import ReviewActionModal from '../../components/ui/ReviewActionModal';
import StatusBadge from '../../components/ui/StatusBadge';
import { adminService } from '../../data/api';
const isPendingStatus = (status) => ['pending', 'under_review'].includes((status || '').toLowerCase());
const isApprovedStatus = (status) => ['approved', 'verified'].includes((status || '').toLowerCase());
const isRejectedStatus = (status) => (status || '').toLowerCase() === 'rejected';
const isReviewedStatus = (status) => isApprovedStatus(status) || isRejectedStatus(status);

const AdminVerification = () => {
  const [activeTab, setActiveTab] = useState('Pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [payments, setPayments] = useState([]);

  const tabs = ['All', 'EV Users', 'Hosts', 'Payments', 'Pending', 'Rejected'];

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    setSuccessMessage(null);
    try {
      const [subResult, payResult] = await Promise.allSettled([
        adminService.getVerificationSubmissions(),
        adminService.getOnboardingPayments()
      ]);

      if (subResult.status === 'fulfilled') {
        setSubmissions(subResult.value);
        subResult.value.filter(s => (s.type || s.profile_type) === 'EV_USER').forEach(s => {
          console.log('[EV-Net] normalized admin EV submission', {
            email: s.user?.email,
            evProfileStatus: s.evProfileStatus,
            documentStatuses: s.documentRows?.map(dr => dr.status),
            finalStatus: s.status
          });
        });
      } else {
        console.error('[EV-Net] Verification queue load failed:', subResult.reason);
        setSubmissions([]);
        setError(`Verification queue error: ${subResult.reason?.message || subResult.reason}`);
      }

      if (payResult.status === 'fulfilled') {
        setPayments(payResult.value);
      } else {
        console.warn('[EV-Net] Payment queue load failed:', payResult.reason);
        setPayments([]);
        setWarning(`Payment queue error: ${payResult.reason?.message || payResult.reason}`);
      }
    } catch (err) {
      console.error('[EV-Net] Failed to load queue:', err);
      setError(`Could not load verification queue: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Pending Total', value: submissions.filter(s => isPendingStatus(s.status)).length + payments.filter(p => isPendingStatus(p.status)).length, icon: Clock, color: '#fbbf24' },
    { label: 'Payments', value: payments.filter(p => isPendingStatus(p.status)).length, icon: ShieldCheck, color: '#00F0FF' },
    { label: 'Host Proofs', value: submissions.filter(s => (s.type || s.profile_type) === 'HOST').length, icon: Home, color: '#a78bfa' },
  ];

  const filteredSubmissions = activeTab === 'Payments' 
    ? payments.filter(p => isPendingStatus(p.status))
    : submissions.filter(s => {
        const type = (s.type || s.profile_type || '').toUpperCase();
        if (activeTab === 'All') return true;
        if (activeTab === 'Pending') return isPendingStatus(s.status);
        if (activeTab === 'Hosts') return type === 'HOST';
        if (activeTab === 'EV Users') return type === 'EV_USER';
        if (activeTab === 'Rejected') return isRejectedStatus(s.status);
        return true;
    });

  const handleReviewClick = (submission) => {
      setSelectedSubmission(submission);
      setModalOpen(true);
  };

  const handleModerationSubmit = async ({ action, notes }) => {
    if (!selectedSubmission) {
      console.warn('[Admin] No selected submission on submit');
      return { success: false, error: 'No submission selected' };
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    console.log('[EV-Net] Admin approve/reject started', { id: selectedSubmission.id, action, notes });
    try {
      const decision = { approved: action === 'APPROVED', notes };
      const userId = selectedSubmission.user_id;
      const withReviewTimeout = (promise) => {
        let timeoutId;
        const timeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Review submit timed out. Please retry; no page reload should be needed.')), 15000);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
      };

      if (activeTab === 'Payments' || selectedSubmission.method) {
        await withReviewTimeout(adminService.verifyOnboardingPayment(selectedSubmission.id, decision.approved, notes));
      } else if ((selectedSubmission.type || selectedSubmission.profile_type) === 'HOST') {
        await withReviewTimeout(adminService.verifyHost(userId, decision));
      } else {
        await withReviewTimeout(adminService.verifyUser(userId, decision));
      }

      await loadSubmissions(); // Refresh list
      setModalOpen(false);
      setSelectedSubmission(null);
      setSuccessMessage(`Review ${decision.approved ? 'approved' : 'rejected'} successfully.`);
      console.log('[EV-Net] Admin decision complete', selectedSubmission.id);
      return { success: true };
    } catch (err) {
      console.error('[EV-Net] Review failed:', err);
      setError('Failed to process review: ' + (err.message || err));
      return { success: false, error: err?.message || String(err) };
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={32} className="text-secondary" />
            Verification Queue
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Review and approve identity documents for EV drivers and charging hosts.</p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                  <Icon size={24} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{stat.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stat.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters & Content */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {warning && (
            <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.08)', color: '#fbbf24', fontSize: '0.85rem' }}>
              {warning}
            </div>
          )}
          {successMessage && (
            <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(0,210,106,0.2)', background: 'rgba(0,210,106,0.08)', color: 'var(--brand-green)', fontSize: '0.85rem' }}>
              {successMessage}
            </div>
          )}
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid transparent',
                    background: activeTab === tab ? 'rgba(225, 29, 72, 0.1)' : 'transparent',
                    color: activeTab === tab ? '#fb7185' : 'var(--text-secondary)',
                    fontWeight: activeTab === tab ? 600 : 400,
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Search user..." 
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem 0.5rem 2.5rem',
                  color: '#fff',
                  fontSize: '0.85rem',
                  width: '240px'
                }}
              />
            </div>
          </div>

          <div style={{ minHeight: '300px', position: 'relative' }}>
            {loading && !modalOpen ? (
               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10, 11, 14, 0.5)', zIndex: 5 }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-cyan)' }} />
               </div>
            ) : null}

            {error ? (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--brand-red)' }}>
                <AlertCircle size={40} style={{ marginBottom: '1rem' }} />
                <p>{error}</p>
                <button onClick={loadSubmissions} style={{ marginTop: '1rem', color: '#fff', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}>Try again</button>
              </div>
            ) : filteredSubmissions.length === 0 ? (
               <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <CheckCircle2 size={40} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                  </div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Queue is clear!</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                    No {activeTab === 'All' ? 'pending' : activeTab.toLowerCase()} verifications awaiting review.
                  </p>
              </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredSubmissions.map((sub, idx) => (
                      <div key={sub.id} 
                           onClick={() => handleReviewClick(sub)}
                           style={{ 
                               padding: '1.5rem', borderBottom: idx !== filteredSubmissions.length -1 ? '1px solid var(--border-color)' : 'none',
                               display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                               cursor: 'pointer', transition: 'background 0.2s'
                           }}
                           onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                           onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            { (sub.user?.avatar || sub.user?.avatar_url) ? (
                              <img src={sub.user.avatar || sub.user.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                  {sub.user?.name?.[0] || 'U'}
                              </div>
                            )}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{sub.user?.name || 'Unknown User'}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {(sub.type || sub.profile_type) === 'EV_USER' ? 'EV User' : 'Host'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {sub.user?.email} • {sub.method ? `Payment: ${sub.method}` : sub.document_type?.replace(/_/g, ' ') || 'Grouped documents'} • {new Date(sub.submittedAt || sub.submitted_at || sub.created_at).toLocaleDateString()}
                                </div>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <StatusBadge status={sub.status} />
                            <ChevronRight size={20} color="var(--text-secondary)" />
                         </div>
                      </div>
                  ))}
               </div>
            )}

          </div>
        </div>
      </div>
      
      {/* Moderation Modal Render */}
      <ReviewActionModal 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)} 
          user={selectedSubmission?.user} 
          targetType={selectedSubmission?.method ? 'payment' : (selectedSubmission?.type || selectedSubmission?.profile_type) === 'HOST' ? 'hostType' : 'evType'} 
          submission={selectedSubmission}
          onSubmit={handleModerationSubmit}
          readOnly={selectedSubmission ? isReviewedStatus(selectedSubmission.status) : false}
      />
    </div>
  );
};

export default AdminVerification;
