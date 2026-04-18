import React, { useState, useEffect } from 'react';
import { adminService } from '../../data/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { adminService.getUsers().then(setUsers); }, []);

  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter.toUpperCase());

  const handleVerify = async (userId, approved) => {
    await adminService.verifyHost(userId, { approved, notes: approved ? 'Approved by admin.' : 'Rejected — documentation incomplete.' });
    const updated = await adminService.getUsers();
    setUsers(updated);
  };

  const roleBadge = (role) => {
    const config = { USER: { color: '#00D26A', label: 'User' }, HOST: { color: '#00F0FF', label: 'Host' }, ADMIN: { color: '#fb7185', label: 'Admin' } };
    const c = config[role] || config.USER;
    return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: `${c.color}20`, color: c.color }}>{c.label}</span>;
  };

  const verificationBadge = (status) => {
    if (!status) return null;
    const config = { draft: '#9CA3AF', pending: '#fbbf24', approved: '#00D26A', rejected: '#ef4444' };
    const color = config[status] || '#9CA3AF';
    return <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: `${color}20`, color, textTransform: 'capitalize' }}>{status}</span>;
  };

  return (
    <div className="section" style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>User Management</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All' }, { key: 'user', label: 'EV Users' }, { key: 'host', label: 'Hosts' }, { key: 'admin', label: 'Admins' }].map(f => (
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
                {['User', 'Email', 'Role', 'Verification', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.avatar ? `url(${u.avatar}) center/cover` : '#333', flexShrink: 0 }} />
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '0.75rem' }}>{roleBadge(u.role)}</td>
                  <td style={{ padding: '0.75rem' }}>{u.hostProfile ? verificationBadge(u.hostProfile.verificationStatus) : '—'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {u.hostProfile?.verificationStatus === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleVerify(u.id, true)} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--brand-green)', background: 'rgba(0,210,106,0.1)', color: 'var(--brand-green)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>Approve</button>
                        <button onClick={() => handleVerify(u.id, false)} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }}>Reject</button>
                      </div>
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

export default AdminUsers;
