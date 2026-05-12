import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, RefreshCw } from 'lucide-react';
import useAppStore from '../../store/appStore';
import { listingService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { PAGE_CACHE_TTL, useCachedPageData } from '../../store/pageCacheStore';

const Favorites = () => {
  const navigate = useNavigate();
  const { favorites, loadFavorites, toggleFavorite } = useAppStore();

  const fetchListings = useCallback(() => (
    listingService.getAll({ isActive: true, isApproved: true, force: true })
  ), []);
  const {
    data: cachedListings,
    isLoading: loading,
    isRefreshing,
    error,
    refresh: refreshListings,
  } = useCachedPageData('listings:active-approved', fetchListings, {
    ttl: PAGE_CACHE_TTL.MEDIUM,
  });
  const listings = cachedListings || [];

  useEffect(() => {
    loadFavorites().catch(err => {
      console.warn('[EV-Net] Favorites load skipped:', err.message);
    });
  }, [loadFavorites]);

  const refreshSavedChargers = useCallback(async () => {
    await Promise.all([
      loadFavorites({ force: true }),
      refreshListings({ force: true }),
    ]);
  }, [loadFavorites, refreshListings]);

  const favoriteListings = listings.filter(l => favorites.has(l.id));

  const handleRemove = async (e, listingId) => {
    e.stopPropagation();
    await toggleFavorite(listingId);
  };

  if (loading) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem', opacity: 0.1 }}>Saved Chargers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && listings.length === 0) {
    return (
      <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠ {error.message || 'Failed to load saved chargers'}</div>
          <button className="btn btn-primary" onClick={refreshSavedChargers}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0 }}>Saved Chargers</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={refreshSavedChargers}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        {(isRefreshing || error) && favoriteListings.length > 0 && (
          <div style={{ color: error ? '#fbbf24' : 'var(--brand-cyan)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error ? 'Could not refresh. Showing cached saved chargers.' : 'Refreshing saved chargers...'}
          </div>
        )}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--brand-green)', fontWeight: 700, fontSize: '1.05rem', lineHeight: 1 }}>
                        {formatPKR(listing.priceDay)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.7rem' }}>/ kWh (Day)</span>
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.8rem' }}>
                        {formatPKR(listing.priceNight)} <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>/ kWh (Night)</span>
                      </span>
                    </div>
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
