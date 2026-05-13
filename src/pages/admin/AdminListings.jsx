import React, { useCallback, useState } from 'react';
import { adminService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';
import { RefreshCw } from 'lucide-react';
import { invalidatePageCaches, PAGE_CACHE_TTL, useCachedPageData } from '../../store/pageCacheStore';

const AdminListings = () => {
  const [filter, setFilter] = useState('all');

  const fetchListings = useCallback(() => adminService.getListings(), []);
  const {
    data: cachedListings,
    isLoading: loading,
    isRefreshing,
    error: loadError,
    refresh: refreshListings,
  } = useCachedPageData('admin-listings', fetchListings, {
    ttl: PAGE_CACHE_TTL.MEDIUM,
  });
  const listings = cachedListings || [];

  const loadListings = useCallback(() => refreshListings({ force: true }), [refreshListings]);

  const filtered = filter === 'all' ? listings
    : filter === 'pending' ? listings.filter(l => !l.isApproved && l.setupFeePaid)
    : filter === 'approved' ? listings.filter(l => l.isApproved)
    : listings.filter(l => !l.setupFeePaid);

  const handleReview = async (listingId, approved) => {
    try {
      await adminService.reviewListing(listingId, { approved });
      invalidatePageCaches([
        'admin-dashboard',
        'admin-listings',
        'host-listings',
        'host-dashboard',
        'listings:active-approved',
        'charger-detail',
      ]);
      await loadListings();
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  const getStatus = (listing) => {
    if (!listing.setupFeePaid) return { label: 'Draft', color: '#9CA3AF' };
    if (!listing.isApproved) return { label: 'Pending', color: '#fbbf24' };
    if (listing.isActive) return { label: 'Active', color: '#00D26A' };
    return { label: 'Approved', color: '#00F0FF' };
  };

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0 }}>Listing Moderation</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadListings}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        {(isRefreshing || loadError) && listings.length > 0 && (
          <div style={{ color: loadError ? '#fbbf24' : 'var(--brand-cyan)', fontSize: '0.85rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
            {loadError ? 'Could not refresh. Showing cached listings.' : 'Refreshing listings...'}
          </div>
        )}
        {loadError && listings.length === 0 && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>
            {loadError.message || 'Could not load listings.'}
            <button className="btn btn-secondary" onClick={loadListings} style={{ marginLeft: '1rem', padding: '0.35rem 0.7rem' }}>Retry</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending Review' }, { key: 'approved', label: 'Approved' }, { key: 'draft', label: 'Draft' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: filter === f.key ? '1px solid #fb7185' : '1px solid var(--border-color)', background: filter === f.key ? 'rgba(225,29,72,0.15)' : 'transparent', color: filter === f.key ? '#fb7185' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading && listings.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Loading listings...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Listing', 'Host', 'Type', 'Rate (kWh)', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(listing => {
                  const status = getStatus(listing);
                  return (
                    <tr key={listing.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '30px', borderRadius: '4px', background: listing.images?.[0] ? `url(${listing.images[0]}) center/cover` : '#222', backgroundColor: '#222', flexShrink: 0 }} />
                          <span>{listing.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{listing.host?.name || 'Unknown'}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{listing.chargerType || listing.charger_type || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.8rem' }}>D: {formatPKR(listing.priceDay || listing.price_day_per_kwh || 0)}</div>
                        <div style={{ fontSize: '0.8rem' }}>N: {formatPKR(listing.priceNight || listing.price_night_per_kwh || 0)}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: `${status.color}20`, color: status.color }}>{status.label}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {!listing.isApproved && listing.setupFeePaid && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleReview(listing.id, true)} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.1)', color: 'var(--brand-green)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>Approve</button>
                            <button onClick={() => handleReview(listing.id, false)} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminListings;
