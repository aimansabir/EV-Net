import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { listingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { Plug, Star, Image as ImageIcon, X, Plus, Loader2 } from 'lucide-react';
import FileUploadDropzone from '../../components/ui/FileUploadDropzone';

const HostListings = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isUpdatingPhotos, setIsUpdatingPhotos] = useState(false);

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
    const setupFeePaid = listing.setupFeePaid ?? listing.setup_fee_paid;
    const isApproved = listing.isApproved ?? listing.is_approved;
    const isActive = listing.isActive ?? listing.is_active;

    if (!setupFeePaid) return { bg: 'rgba(156,163,175,0.15)', color: '#9CA3AF', label: 'Draft' };
    if (!isApproved) return { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending Review' };
    if (!isActive) return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Offline' };
    return { bg: 'rgba(0,210,106,0.15)', color: '#00D26A', label: 'Active' };
  };

  const handleUpdatePhotos = async (listingId) => {
    const data = await listingService.getByHost(user?.id);
    setListings(data);
    const updated = data.find(l => l.id === listingId);
    if (updated) setSelectedListing(updated);
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
                  <div style={{ width: '120px', height: '90px', borderRadius: '10px', flexShrink: 0, background: listing.images?.[0] ? `url(${listing.images[0]}) center/cover` : '#222', backgroundColor: '#222' }} />
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        setSelectedListing(listing);
                        setShowPhotoModal(true);
                      }}
                    >
                      <ImageIcon size={14} /> Edit Photos
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPhotoModal && selectedListing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '2rem', position: 'relative' }}>
            <button 
              onClick={() => setShowPhotoModal(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>

            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem' }}>Manage Listing Photos</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {(selectedListing.listing_photos || []).map((photo, idx) => (
                <div key={photo.id} style={{ position: 'relative', aspectRatio: '4/3', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <img src={listingService.resolveListingPhotoUrl(photo.storage_path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '4px', fontSize: '0.65rem', color: '#fff', textAlign: 'center', fontWeight: 600 }}>
                    {idx === 0 ? 'SETUP PHOTO' : `PHOTO ${idx + 1}`}
                  </div>
                  {idx > 0 && (
                    <button 
                      onClick={async () => {
                        if (confirm('Delete this photo?')) {
                          setIsUpdatingPhotos(true);
                          await listingService.deleteListingPhoto(photo.id);
                          await handleUpdatePhotos(selectedListing.id);
                          setIsUpdatingPhotos(false);
                        }
                      }}
                      style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(239, 68, 68, 0.9)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              
              <div style={{ aspectRatio: '4/3', borderRadius: '12px', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-cyan)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                <div style={{ textAlign: 'center' }}>
                   <FileUploadDropzone 
                     mode="image" 
                     label="" 
                     multiple={true}
                     files={[]} 
                     onChange={async (files) => {
                       if (files.length > 0) {
                         setIsUpdatingPhotos(true);
                         await listingService.uploadListingPhotos(selectedListing.id, user.id, files);
                         await handleUpdatePhotos(selectedListing.id);
                         setIsUpdatingPhotos(false);
                       }
                     }} 
                   />
                </div>
              </div>
            </div>

            {isUpdatingPhotos && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px', zIndex: 10 }}>
                <Loader2 className="animate-spin" size={48} color="var(--brand-cyan)" />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowPhotoModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostListings;
