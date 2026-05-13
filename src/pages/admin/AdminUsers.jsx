import React, { useCallback, useState } from 'react';
import { adminService } from '../../data/api';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { invalidatePageCaches, PAGE_CACHE_TTL, useCachedPageData } from '../../store/pageCacheStore';

const AdminUsers = () => {
  const [filter, setFilter] = useState('all');
  const [togglingTest, setTogglingTest] = useState(null); // userId being toggled

  const fetchUsers = useCallback(() => adminService.getUsers(), []);
  const {
    data: cachedUsers,
    isLoading: loading,
    isRefreshing,
    error: loadError,
    refresh: refreshUsers,
    setData: setUsers,
  } = useCachedPageData('admin-users', fetchUsers, {
    ttl: PAGE_CACHE_TTL.SHORT,
  });
  const users = cachedUsers || [];

  const loadUsers = useCallback(() => refreshUsers({ force: true }), [refreshUsers]);

  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter.toUpperCase());

  const handleAction = async (userId, role, approved) => {
    try {
      if (role === 'HOST') {
        await adminService.verifyHost(userId, { approved, notes: approved ? 'Approved by admin.' : 'Rejected — documentation incomplete.' });
      } else {
        await adminService.verifyUser(userId, { approved, notes: approved ? 'Approved by admin.' : 'Rejected — documentation incomplete.' });
      }
      const nextStatus = approved ? 'approved' : 'rejected';
      const applyReviewedUser = () => setUsers(prev => (prev || []).map(user =>
        user.id === userId ? { ...user, verificationStatus: nextStatus } : user
      ));
      applyReviewedUser();
      invalidatePageCaches(['admin-users', 'admin-verification', 'admin-dashboard', 'host-dashboard']);
      refreshUsers({ force: true, silent: true }).finally(applyReviewedUser);
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  const handleToggleTest = async (userId, currentlyTest) => {
    const newState = !currentlyTest;
    const action = newState ? 'mark as test account' : 'remove test account flag from';
    const userName = users.find(u => u.id === userId)?.name || 'this user';
    if (!confirm(`Are you sure you want to ${action} "${userName}"?\n\n${newState ? 'Their bookings and payments will be excluded from financials.' : 'Their bookings and payments will be included in financials again.'}`)) {
      return;
    }
    setTogglingTest(userId);
    try {
      await adminService.toggleTestAccount(userId, newState);
      const applyTestFlag = () => setUsers(prev => (prev || []).map(user =>
        user.id === userId ? { ...user, isTestAccount: newState } : user
      ));
      applyTestFlag();
      invalidatePageCaches([
        'admin-users',
        'admin-dashboard',
        'admin-bookings',
        'host-dashboard',
        'host-earnings',
        'host-bookings',
        'user-bookings',
        'booking-detail',
      ]);
      refreshUsers({ force: true, silent: true }).finally(applyTestFlag);
    } catch (err) {
      alert('Failed to toggle test account: ' + err.message);
    } finally {
      setTogglingTest(null);
    }
  };

  const roleBadge = (role) => {
    const config = { USER: { color: '#00D26A', label: 'User' }, HOST: { color: '#00F0FF', label: 'Host' }, ADMIN: { color: '#fb7185', label: 'Admin' } };
    const c = config[role] || config.USER;
    return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: `${c.color}20`, color: c.color }}>{c.label}</span>;
  };

  const verificationBadge = (status, role) => {
    if (role === 'ADMIN') return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(251,113,133,0.15)', color: '#fb7185' }}>Admin</span>;
    if (!status) return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(156,163,175,0.15)', color: '#9CA3AF' }}>Not Started</span>;
    const normalized = String(status).toLowerCase();
    const config = {
      draft: { color: '#9CA3AF', label: 'Draft' },
      pending: { color: '#fbbf24', label: 'Pending' },
      pending_docs: { color: '#fbbf24', label: 'Pending Docs' },
      under_review: { color: '#f97316', label: 'Under Review' },
      approved: { color: '#00D26A', label: 'Verified' },
      verified: { color: '#00D26A', label: 'Verified' },
      rejected: { color: '#ef4444', label: 'Rejected' },
    };
    const c = config[normalized] || { color: '#9CA3AF', label: status };
    return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: `${c.color}20`, color: c.color }}>{c.label}</span>;
  };

  // Show actions for users/hosts who are pending or under review
  const canShowActions = (u) => {
    const vs = String(u.verificationStatus || '').toLowerCase();
    return ['pending', 'under_review', 'pending_docs'].includes(vs);
  };

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0 }}>User Management</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadUsers}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        {(isRefreshing || loadError) && users.length > 0 && (
          <div style={{ color: loadError ? '#fbbf24' : 'var(--brand-cyan)', fontSize: '0.85rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
            {loadError ? 'Could not refresh. Showing cached users.' : 'Refreshing users...'}
          </div>
        )}
        {loadError && users.length === 0 && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>
            {loadError.message || 'Could not load users.'}
            <button className="btn btn-secondary" onClick={loadUsers} style={{ marginLeft: '1rem', padding: '0.35rem 0.7rem' }}>Retry</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All' }, { key: 'user', label: 'EV Users' }, { key: 'host', label: 'Hosts' }, { key: 'admin', label: 'Admins' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: filter === f.key ? '1px solid #fb7185' : '1px solid var(--border-color)', background: filter === f.key ? 'rgba(225,29,72,0.15)' : 'transparent', color: filter === f.key ? '#fb7185' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading && users.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Loading users...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['User', 'Email', 'Role', 'Verification', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: u.isTestAccount ? 'rgba(251,191,36,0.04)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.avatar ? `url(${u.avatar}) center/cover` : '#333', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#fff' }}>
                          {!u.avatar && (u.name || 'U')[0].toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{u.name}</span>
                          {u.isTestAccount && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', letterSpacing: '0.03em', width: 'fit-content' }}>
                              <FlaskConical size={9} /> TEST
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem' }}>{roleBadge(u.role)}</td>
                    <td style={{ padding: '0.75rem' }}>{verificationBadge(u.verificationStatus, u.role)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {canShowActions(u) && (
                          <>
                            <button onClick={() => handleAction(u.id, u.role, true)} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.1)', color: 'var(--brand-green)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>Approve</button>
                            <button onClick={() => handleAction(u.id, u.role, false)} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>Reject</button>
                          </>
                        )}
                        {u.is_suspended && (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Suspended</span>
                        )}
                        {u.role !== 'ADMIN' && (
                          <button
                            onClick={() => handleToggleTest(u.id, u.isTestAccount)}
                            disabled={togglingTest === u.id}
                            title={u.isTestAccount ? 'Remove test flag — include in financials' : 'Mark as test — exclude from financials'}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              border: u.isTestAccount ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border-color)',
                              background: u.isTestAccount ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                              color: u.isTestAccount ? '#fbbf24' : 'var(--text-secondary)',
                              cursor: togglingTest === u.id ? 'wait' : 'pointer',
                              fontSize: '0.72rem',
                              fontFamily: 'var(--font-body)',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: togglingTest === u.id ? 0.5 : 1,
                              transition: 'all 0.2s'
                            }}
                          >
                            <FlaskConical size={12} />
                            {togglingTest === u.id ? '...' : u.isTestAccount ? 'Test ✓' : 'Test'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
