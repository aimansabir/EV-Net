import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../data/api';
import { formatPKR } from '../../data/feeConfig';

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [verifyingId, setVerifyingId] = useState(null);
  const [payoutId, setPayoutId] = useState(null);

  const loadBookings = useCallback(async () => {
    const data = await adminService.getBookings();
    setBookings(data);
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter.toUpperCase());

  const statusColors = {
    PENDING: '#fbbf24', CONFIRMED: '#00D26A', ACCEPTED: '#00D26A', COMPLETED: '#00F0FF', CANCELLED: '#ef4444',
  };

  const paymentStatusLabel = {
    pay_later: 'Legacy Pay Later',
    payment_due: 'Payment Due',
    proof_submitted: 'Proof Submitted',
    unpaid: 'Unpaid',
    paid: 'Paid',
    rejected: 'Payment Rejected',
  };

  const getBookingStatusLabel = (booking) => {
    if (booking.status === 'PENDING' && booking.payment_status === 'paid') {
      return 'AWAITING HOST';
    }
    if (booking.status === 'PENDING' && booking.payment_status === 'proof_submitted') {
      return 'AWAITING PAYMENT';
    }
    return booking.status || 'PENDING';
  };

  const handleVerifyPayment = async (booking) => {
    if (verifyingId) return;
    if (booking.payment_status !== 'proof_submitted') {
      await loadBookings();
      return;
    }

    try {
      setVerifyingId(booking.id);
      await adminService.verifyPayment(booking.id);
      await loadBookings();
    } catch (err) {
      const message = err.message || '';
      if (message.includes('payment_status to be proof_submitted')) {
        await loadBookings();
      } else {
        alert(message || 'Could not verify payment.');
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleMarkPaid = async (bookingId) => {
    if (payoutId) return;

    try {
      setPayoutId(bookingId);
      await adminService.markPayoutPaid(bookingId);
      await loadBookings();
    } catch (err) {
      alert(err.message);
    } finally {
      setPayoutId(null);
    }
  };

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>All Bookings</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: filter === f ? '1px solid #fb7185' : '1px solid var(--border-color)', background: filter === f ? 'rgba(225,29,72,0.15)' : 'transparent', color: filter === f ? '#fb7185' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['User', 'Listing', 'Date', 'Time', 'User Paid', 'Platform Fee', 'Host Payout', 'Status', 'Payment', 'Payout Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem' }}>{b.user?.name || '—'}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{b.listing?.title || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>{b.date}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{b.startTime} – {b.endTime}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--brand-green)' }}>{formatPKR(b.total_user_price || b.totalFee || 0)}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{formatPKR((b.user_service_fee || 0) + (b.host_platform_fee || 0))}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--brand-cyan)' }}>{formatPKR(b.host_payout || 0)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: `${statusColors[b.status]}20`, color: statusColors[b.status] }}>{getBookingStatusLabel(b)}</span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {b.payment_method === 'PAY_AFTER_CHARGING' && (
                      <div style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>Legacy Pay Later</div>
                    )}
                    <div>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: b.payment_status === 'paid' ? 'rgba(0,210,106,0.15)' : 'rgba(251,191,36,0.15)', color: b.payment_status === 'paid' ? '#00D26A' : '#fbbf24' }}>
                        {paymentStatusLabel[b.payment_status] || b.payment_status || 'Unpaid'}
                      </span>
                    </div>
                    {b.paymentProofUrl ? (
                      <a href={b.paymentProofUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--brand-cyan)', textDecoration: 'none', borderBottom: '1px solid var(--brand-cyan)' }}>View Proof</a>
                    ) : b.payment_proof_path ? (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Proof unavailable</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: b.payout_status === 'paid_to_host' ? 'rgba(0,210,106,0.15)' : 'rgba(251,191,36,0.15)', color: b.payout_status === 'paid_to_host' ? '#00D26A' : '#fbbf24' }}>
                      {b.payout_status || 'pending'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {b.payment_status === 'proof_submitted' && (
                      <button
                        disabled={!!verifyingId}
                        onClick={() => handleVerifyPayment(b)}
                        style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--brand-cyan)', background: 'rgba(0,240,255,0.1)', color: 'var(--brand-cyan)', cursor: verifyingId ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600, opacity: verifyingId && verifyingId !== b.id ? 0.55 : 1 }}
                      >
                        {verifyingId === b.id ? 'Verifying...' : 'Verify Payment Received'}
                      </button>
                    )}
                    {b.status === 'COMPLETED' && b.payment_status === 'paid' && b.payout_status === 'pending' && (
                      <button
                        disabled={!!payoutId}
                        onClick={() => handleMarkPaid(b.id)}
                        style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: 'none', background: 'var(--brand-cyan)', color: '#000', cursor: payoutId ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600, opacity: payoutId && payoutId !== b.id ? 0.55 : 1 }}
                      >
                        {payoutId === b.id ? 'Marking...' : 'Mark Payout Paid'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;
