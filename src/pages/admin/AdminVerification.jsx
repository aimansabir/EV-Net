import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, User, Home, Clock, AlertCircle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import ReviewActionModal from '../../components/ui/ReviewActionModal';
import StatusBadge from '../../components/ui/StatusBadge';

const AdminVerification = () => {
  const [activeTab, setActiveTab] = useState('Pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const tabs = ['All', 'EV Users', 'Hosts', 'Pending', 'Resubmission', 'Rejected'];

  const stats = [
    { label: 'Pending Total', value: 2, icon: Clock, color: '#fbbf24' },
    { label: 'EV Driver Proofs', value: 1, icon: User, color: '#00F0FF' },
    { label: 'Host Proofs', value: 1, icon: Home, color: '#a78bfa' },
  ];

  // Dummy data representing submissions
  const [submissions, setSubmissions] = useState([
    { id: 'sub_1', type: 'evType', user: { name: 'Ali Khan', email: 'ali@example.com' }, submittedAt: '2 hours ago', status: 'under_review' },
    { id: 'sub_2', type: 'hostType', user: { name: 'Ayesha Rahman', email: 'ayesha@example.com' }, submittedAt: '5 hours ago', status: 'under_review' }
  ]);

  const filteredSubmissions = submissions.filter(s => {
      if (activeTab === 'All') return true;
      if (activeTab === 'Pending') return s.status === 'under_review';
      if (activeTab === 'Hosts') return s.type === 'hostType';
      if (activeTab === 'EV Users') return s.type === 'evType';
      return true;
  });

  const handleReviewClick = (submission) => {
      setSelectedSubmission(submission);
      setModalOpen(true);
  };

  const handleModerationSubmit = ({ action, notes }) => {
      // In production, call adminService.moderateVerification
      setSubmissions(prev => prev.map(s => 
          s.id === selectedSubmission.id ? { ...s, status: action.toLowerCase() } : s
      ));
      setModalOpen(false);
      setSelectedSubmission(null);
      // alert(`Submitted ${action} with notes: ${notes}`);
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

          <div style={{ minHeight: '300px' }}>
            {filteredSubmissions.length === 0 ? (
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
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {sub.user.name[0]}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{sub.user.name}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {sub.type === 'evType' ? 'EV User' : 'Host'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {sub.user.email} • Submitted {sub.submittedAt}
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
          targetType={selectedSubmission?.type} 
          onSubmit={handleModerationSubmit}
      />
    </div>
  );
};

export default AdminVerification;
