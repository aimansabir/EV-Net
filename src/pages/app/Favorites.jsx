import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { listingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';

const Favorites = () => {
  const navigate = useNavigate();
  const { favorites, loadFavorites, toggleFavorite } = useAppStore();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        await loadFavorites();
        const all = await listingService.getAll();
        setListings(all);
      } catch (err) {
        console.error("Failed to load favorites", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const favoriteListings = listings.filter(l => favorites.has(l.id));

  const handleRemove = async (e, listingId) => {
    e.stopPropagation();
    await toggleFavorite(listingId);
  };

  if (loading) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading saved chargers...</div>
      </div>
    );
  }

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>Saved Chargers</h2>

        {favoriteListings.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', marginBottom: '1.5rem', opacity: 0.8 }}>
              <Heart size={64} fill="#ef4444" strokeWidth={1.5} />
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>No saved chargers yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Explore the map and tap the heart icon to save your favorite charging spots!
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/app/explore')}>
              Explore Chargers
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {favoriteListings.map(listing => (
              <div key={listing.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => navigate(`/app/charger/${listing.id}`)}
              >
                <div style={{
                  height: '160px', position: 'relative',
                  background: `url(${listing.images[0]}) center/cover`,
                }}>
                  <button
                    onClick={(e) => handleRemove(e, listing.id)}
                    style={{
                      position: 'absolute', top: '10px', right: '10px',
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Heart size={18} fill={favorites.has(listing.id) ? "#ef4444" : "none"} strokeWidth={2.5} />
                  </button>
                  {listing.isApproved && (
                    <div style={{
                      position: 'absolute', bottom: '10px', left: '10px',
                      padding: '0.2rem 0.5rem', borderRadius: '4px',
                      background: 'rgba(0, 210, 106, 0.2)', color: 'var(--brand-green)',
                      fontSize: '0.7rem', fontWeight: 600, backdropFilter: 'blur(4px)',
                    }}>
                      ✓ Verified Host
                    </div>
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.3rem' }}>{listing.title}</h4>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    {listing.area}, {listing.city} • {listing.chargerType}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--brand-green)', fontWeight: 700 }}>
                      {formatPKR(listing.pricePerHour)} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>/ hr</span>
                    </span>
                    {listing.rating > 0 && (
                      <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>★ {listing.rating}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
