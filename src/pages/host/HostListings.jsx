import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { listingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { Plug, Star } from 'lucide-react';

const HostListings = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listingService.getByHost(user?.id || 'host_ahsan');
        setListings(data);
      } catch (err) {
        console.error("Failed to load listings:", err);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const statusBadge = (listing) => {
    if (!listing.setupFeePaid) return { bg: 'rgba(156,163,175,0.15)', color: '#9CA3AF', label: 'Draft' };
    if (!listing.isApproved) return { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending Review' };
    if (!listing.isActive) return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Offline' };
    return { bg: 'rgba(0,210,106,0.15)', color: '#00D26A', label: 'Active' };
  };

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0 }}>My Listings</h2>
          <button className="btn btn-primary" style={{ fontSize: '0.9rem' }} onClick={() => navigate('/host/listings/new')}>+ New Listing</button>
        </div>

        {listings.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center' }}><Plug size={48} strokeWidth={1.5} /></div>
            <h3 style={{ marginBottom: '0.5rem' }}>No listings yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Create your first charging listing to start earning.</p>
            <button className="btn btn-primary" onClick={() => navigate('/host/listings/new')}>Create Listing</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {listings.map(listing => {
              const status = statusBadge(listing);
              return (
                <div key={listing.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ width: '120px', height: '90px', borderRadius: '10px', flexShrink: 0, background: `url(${listing.images[0]}) center/cover`, backgroundColor: '#222' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{listing.title}</h4>
                      <span style={{ padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: status.bg, color: status.color, flexShrink: 0 }}>{status.label}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.3rem 0' }}>
                      {listing.chargerType} • Day: {formatPKR(listing.priceDay)}/kWh • Night: {formatPKR(listing.priceNight)}/kWh
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{listing.sessionsCompleted} sessions</span>
                      {listing.rating > 0 && <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={14} fill="currentColor" /> {listing.rating}</span>}
                      <span style={{ color: 'var(--text-secondary)' }}>{listing.reviewCount} reviews</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostListings;
