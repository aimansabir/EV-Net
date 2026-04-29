import React, { useState, useEffect } from 'react';
import { adminService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';

const AdminListings = () => {
  const [listings, setListings] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { adminService.getListings().then(setListings); }, []);

  const filtered = filter === 'all' ? listings
    : filter === 'pending' ? listings.filter(l => !l.isApproved && l.setupFeePaid)
    : filter === 'approved' ? listings.filter(l => l.isApproved)
    : listings.filter(l => !l.setupFeePaid);

  const handleReview = async (listingId, approved) => {
    await adminService.reviewListing(listingId, { approved });
    const updated = await adminService.getListings();
    setListings(updated);
  };

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>Listing Moderation</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending Review' }, { key: 'approved', label: 'Approved' }, { key: 'draft', label: 'Draft' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: filter === f.key ? '1px solid #fb7185' : '1px solid var(--border-color)', background: filter === f.key ? 'rgba(225,29,72,0.15)' : 'transparent', color: filter === f.key ? '#fb7185' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
              {f.label}
            </button>
          ))}
        </div>

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
                const status = !listing.setupFeePaid ? { label: 'Draft', color: '#9CA3AF' }
                  : !listing.isApproved ? { label: 'Pending', color: '#fbbf24' }
                  : listing.isActive ? { label: 'Active', color: '#00D26A' }
                  : { label: 'Approved', color: '#00F0FF' };
                return (
                  <tr key={listing.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '40px', height: '30px', borderRadius: '4px', background: `url(${listing.images?.[0]}) center/cover`, backgroundColor: '#222', flexShrink: 0 }} />
                        <span>{listing.title}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{listing.host?.name}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{listing.chargerType}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.8rem' }}>D: {formatPKR(listing.priceDay)}</div>
                      <div style={{ fontSize: '0.8rem' }}>N: {formatPKR(listing.priceNight)}</div>
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
      </div>
    </div>
  );
};

export default AdminListings;
