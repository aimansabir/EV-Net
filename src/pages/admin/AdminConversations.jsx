import React, { useState, useEffect } from 'react';
import { adminService, messagingService } from '../../data/api';
import { MessageSquare, ShieldAlert, Lock, Unlock, Eye, MapPin, XCircle, AlertTriangle, ShieldX } from 'lucide-react';
import '../app/Messages.css'; // Reuse core chat structures

const AdminConversations = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await adminService.getConversations();
      setConversations(data.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConv = async (conv) => {
    setSelectedConv(conv);
    try {
      const msgs = await messagingService.getMessages(conv.id);
      setMessages(msgs);
    } catch(err) {
      console.error(err);
    }
  };

  const handleModerate = async (action) => {
    if (!selectedConv) return;
    if (window.confirm(`Are you sure you want to apply action: ${action}?`)) {
      try {
        await adminService.moderateConversation(selectedConv.id, action);
        alert(`Action ${action} applied successfully.`);
        await loadConversations();
        setSelectedConv(null);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) {
    return <div className="section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <div className="section" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1400px' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MessageSquare size={32} style={{ color: '#fb7185' }} />
            Conversation Moderation
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Review reported messages and take appropriate actions against policy violations.</p>
        </div>

        <div className="messages-layout" style={{ height: '700px', marginTop: 0 }}>
          {/* List View */}
          <div className="messages-sidebar glass-card" style={{ width: '400px', minWidth: '400px' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
               <select className="input-field" style={{ padding: '0.6rem', width: '100%' }}>
                  <option value="ALL">All Conversations</option>
                  <option value="FLAGGED">Flagged Only</option>
                  <option value="INQUIRY">Inquiries</option>
                  <option value="BOOKING">Booking Chats</option>
               </select>
            </div>
            <div className="conversation-list">
              {conversations.map(conv => (
                <div 
                  key={conv.id} 
                  className={`conv-item ${conv.id === selectedConv?.id ? 'active' : ''}`}
                  onClick={() => handleSelectConv(conv)}
                  style={{ borderLeft: conv.status === 'FLAGGED' ? '3px solid #ef4444' : '' }}
                >
                  <div className="conv-preview" style={{ opacity: conv.status === 'CLOSED' || conv.status === 'ARCHIVED' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="conv-name">{conv.user?.name} ↔ {conv.host?.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="conv-listing" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {conv.type === 'INQUIRY' ? <MessageSquare size={12}/> : <ShieldAlert size={12} color="var(--brand-green)"/>}
                      {conv.listing?.title}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                       <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }}>{conv.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit View */}
          <div className="messages-main glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            {selectedConv ? (
              <>
                <div className="chat-header" style={{ borderBottom: '1px solid rgba(225, 29, 72, 0.3)', background: 'rgba(225, 29, 72, 0.02)' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Audit Log: {selectedConv.id}
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--bg-main)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                         Type: {selectedConv.type}
                      </span>
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                       Participants: <span style={{ color: '#fff' }}>{selectedConv.user?.name}</span> (User) & <span style={{ color: '#fff' }}>{selectedConv.host?.name}</span> (Host)
                    </div>
                  </div>
                </div>

                <div className="chat-messages" style={{ flex: 1, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.2))' }}>
                  {messages.map(msg => {
                    const isSystem = msg.type === 'SYSTEM';
                    const isUser = msg.senderId === selectedConv.userId;
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="message system-message" style={{ alignSelf: 'center', opacity: 0.6 }}>
                          <span>{msg.content}</span>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={msg.id} className={`message ${isUser ? 'mine' : 'theirs'}`} style={{ 
                         alignSelf: isUser ? 'flex-start' : 'flex-end',
                         background: isUser ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                         padding: '1rem',
                         borderRadius: '8px',
                         maxWidth: '80%',
                         border: isUser ? '1px solid rgba(0, 240, 255, 0.2)' : '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                           <span>{isUser ? selectedConv.user?.name : selectedConv.host?.name}</span>
                           <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
                           {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="chat-input-area" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ marginBottom: '1rem', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={18} /> Moderation Actions
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => handleModerate('WARN_USER')} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                       ⚠️ Warn User
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleModerate('RESTRICT_INQUIRY')} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                       <Lock size={14} style={{display: 'inline', marginRight: '4px'}}/> Restrict Inquiry Access
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleModerate('CLOSE_THREAD')} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                       <XCircle size={14} style={{display: 'inline', marginRight: '4px'}}/> Close Thread
                    </button>
                    <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
                    <button className="btn" onClick={() => handleModerate('ESCALATE_TO_DISPUTE')} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                       <AlertTriangle size={14} style={{display: 'inline', marginRight: '4px'}}/> Escalate & Refund
                    </button>
                    <button className="btn" onClick={() => handleModerate('SUSPEND_ACCOUNT')} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                       <ShieldX size={14} style={{display: 'inline', marginRight: '4px'}}/> Suspend Account
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <Eye size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <h3>Select a conversation</h3>
                <p>Click on an item in the queue to load the chat audit log.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConversations;
