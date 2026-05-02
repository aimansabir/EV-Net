import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { hostService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { Clock, AlertCircle, FileText, CheckCircle, Star, Zap, CalendarDays } from 'lucide-react';
import Skeleton, { ListSkeleton } from '../../components/ui/Skeleton';

const HostDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await hostService.getDashboard(user?.id || 'host_ahsan');
        setDashboard(data);
      } catch (err) {
        console.error("Failed to load generic framework for dashboard", err);
        setDashboard(null); // Wait, if dashboard is null, it displays "Loading dashboard...". 
        // We should set a blank dashboard if it fails, or handle it in UI.
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div>
              <Skeleton width="250px" height="2rem" style={{ marginBottom: '0.5rem' }} />
              <Skeleton width="180px" height="1rem" />
            </div>
            <Skeleton width="120px" height="40px" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height="100px" />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
            <ListSkeleton />
            <Skeleton height="300px" />
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} color="#f87171" style={{ marginBottom: '1rem' }} />
          <h3>Failed to load dashboard</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Please check your internet connection and try again.</p>
          <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const verificationStatus = (dashboard.profile?.verificationStatus || 'draft').toLowerCase();
  const isPendingVerification = ['pending', 'under_review'].includes(verificationStatus);
  const showVerificationBanner = verificationStatus && verificationStatus !== 'approved';
  const getListingStatus = (listing) => {
    if (!listing.setupFeePaid) return { label: 'Draft', bg: 'rgba(156,163,175,0.2)', color: '#9CA3AF' };
    if (!listing.isApproved) return { label: 'Pending Review', bg: 'rgba(251,191,36,0.16)', color: '#fbbf24' };
    if (!listing.isActive) return { label: 'Offline', bg: 'rgba(239,68,68,0.2)', color: '#ef4444' };
    return { label: 'Active', bg: 'rgba(0,210,106,0.2)', color: 'var(--brand-green)' };
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>

        {/* Verification Banner */}
        {showVerificationBanner && (
          <div style={{
            padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem',
            background: isPendingVerification ? 'rgba(251,191,36,0.1)' : verificationStatus === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(156,163,175,0.1)',
            border: `1px solid ${isPendingVerification ? 'rgba(251,191,36,0.3)' : verificationStatus === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(156,163,175,0.3)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.25rem', color: isPendingVerification ? '#fbbf24' : verificationStatus === 'rejected' ? '#f87171' : '#9CA3AF' }}>
                {isPendingVerification ? <><Clock size={16} /> Verification Pending</> : verificationStatus === 'rejected' ? <><AlertCircle size={16} /> Verification Rejected</> : <><FileText size={16} /> Complete Your Profile</>}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isPendingVerification ? 'Our team is reviewing your profile. This usually takes 1-2 business days.' : verificationStatus === 'rejected' ? 'Your host application was rejected. Please update your details and resubmit.' : 'Complete onboarding to start receiving bookings.'}
              </div>
            </div>
            {['draft', 'pending_docs', 'rejected'].includes(verificationStatus) && (
              <button className="btn btn-primary" style={{ fontSize: '0.85rem', flexShrink: 0 }} onClick={() => navigate('/host/onboarding')}>
                {verificationStatus === 'rejected' ? 'Edit & Resubmit' : 'Complete Setup'}
              </button>
            )}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '2rem' }}>
              Host Dashboard
              {verificationStatus === 'approved' && <span style={{ marginLeft: '10px', fontSize: '0.8rem', padding: '0.2rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,210,106,0.2)', color: 'var(--brand-green)', borderRadius: '20px', verticalAlign: 'middle' }}><CheckCircle size={14} /> Verified</span>}
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.3rem 0 0', fontSize: '0.9rem' }}>Welcome back, {user?.name || 'Host'}</p>
          </div>
          <Link to="/host/listings/new" className="btn btn-primary" style={{ fontSize: '0.9rem' }}>+ New Listing</Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Total Earnings</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--brand-green)' }}>{formatPKR(dashboard.totalEarnings)}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Active Bookings</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--brand-cyan)' }}>{dashboard.activeBookingCount}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Completed Sessions</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{dashboard.totalSessions}</div>
          </div>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Avg Rating</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{dashboard.avgRating.toFixed(1)} <span style={{ color: '#fbbf24' }}><Star size={20} fill="currentColor" style={{ display: 'inline', verticalAlign: 'text-top' }} /></span></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Listings */}
          <div>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Your Listings</h3>
            {dashboard.listings.length === 0 ? (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No listings yet. Create your first one!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {dashboard.listings.map(listing => {
                  const status = getListingStatus(listing);
                  return (
                  <div key={listing.id} className="glass-card" style={{ padding: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => navigate('/host/listings')}>
                    <div style={{ 
                      width: '80px', 
                      height: '60px', 
                      borderRadius: '8px', 
                      background: listing.images && listing.images[0] ? `url(${listing.images[0]}) center/cover` : '#222', 
                      backgroundColor: '#222', 
                      flexShrink: 0 
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>{listing.title}</h4>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
                          background: status.bg,
                          color: status.color,
                        }}>{status.label}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                        {listing.chargerType} • Day: {formatPKR(listing.priceDay)}/kWh • Night: {formatPKR(listing.priceNight)}/kWh
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* Upcoming Bookings */}
          <div>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Upcoming Bookings</h3>
            {dashboard.upcomingBookings.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No upcoming bookings.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dashboard.upcomingBookings.map(booking => (
                  <div key={booking.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--brand-cyan)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      {booking.date} • {booking.startTime} – {booking.endTime}
                    </div>
                    <div style={{ fontWeight: 500, marginBottom: '0.3rem' }}>
                      {booking.user?.name} {booking.user?.evModel && `(${booking.user.evModel})`}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--brand-green)' }}>+ {formatPKR(booking.baseFee)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostDashboard;
