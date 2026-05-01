import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, Clock, Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { messagingService } from '../../data/api';
import '../app/Messages.css';

const HostMessages = () => {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeConvId = searchParams.get('conversation');

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const endOfMessagesRef = useRef(null);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await messagingService.getConversations(user.id);
      setConversations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async (convId) => {
    try {
      const msgs = await messagingService.getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadConversations();
  }, [user?.id, loadConversations]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    if (!activeConvId || !messagingService.subscribeToMessages) return undefined;

    return messagingService.subscribeToMessages(activeConvId, (message) => {
      setMessages(prev => {
        if (prev.some(existing => existing.id === message.id)) return prev;
        return [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
      loadConversations();
    });
  }, [activeConvId, loadConversations]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    setError(null);
    try {
      await messagingService.sendMessage(activeConvId, user.id, inputText.trim());
      setInputText('');
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      setError("Unable to send reply. Please try again.");
      console.error("[Host Messaging Error]", err.message);
    } finally {
      setSending(false);
    }
  };

  const handleApproveExtension = async () => {
    setSending(true);
    setError(null);
    try {
      await messagingService.approveExtension(activeConvId);
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      setError("Unable to approve extension. Please try again.");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  if (isLoading) return <div className="messages-loading"><div className="spinner"></div></div>;

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 100px)', padding: '0.75rem 0' }}>
      <div className="container" style={{ padding: 0 }}>
        <div className="messages-layout" style={{ marginTop: 0 }}>
          {/* Sidebar ListView */}
          <div className={`messages-sidebar ${activeConvId ? 'hide-on-mobile' : ''}`}>
            <h2 className="sidebar-header">Inbox</h2>
            <div className="conversation-list">
              {conversations.length === 0 ? (
                <div className="sidebar-empty-block">
                  <h4>No guest threads yet</h4>
                  <p>Guest inquiries and booking conversations will appear here when users contact you.</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`}
                    onClick={() => navigate(`/host/messages?conversation=${conv.id}`)}
                  >
                    <div className="conv-avatar">
                      {conv.user?.avatar ? <img src={conv.user.avatar} alt="Guest" /> : (conv.user?.name?.[0] || 'G')}
                    </div>
                    <div className="conv-preview">
                      <div className="conv-name">{conv.user?.name || 'Guest'}</div>
                      <div className="conv-listing">{conv.listing?.title}</div>
                      <div className="conv-last-msg">
                        {conv.lastMessage?.type === 'SYSTEM' ? '[System Notice]' : conv.lastMessage?.content || 'No messages'}
                      </div>
                    </div>
                    {conv.status === 'LOCKED' && <Lock size={14} className="status-icon locked" />}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Chat View */}
          <div className={`messages-main ${!activeConvId ? 'hide-on-mobile' : ''}`}>
            {activeConv ? (
              <>
                <div className="chat-header">
                  <button className="back-btn mobile-only" onClick={() => navigate('/host/messages')}>
                    <ArrowLeft size={20} />
                  </button>
                  <div className="chat-header-info">
                    <h3>{activeConv.user?.name || 'Guest'}</h3>
                    <div className="chat-subtitle">Re: {activeConv.listing?.title}</div>
                  </div>
                  <div className="chat-type-badge">
                    {activeConv.type === 'INQUIRY' ? 'Pre-Booking Inquiry' : 'Booking Chat'}
                  </div>
                </div>

                <div className="chat-messages">
                  {activeConv.type === 'INQUIRY' && (
                    <div className="safety-notice">
                      <ShieldAlert size={14} />
                      <span>Do not share exact address or phone before booking.</span>
                    </div>
                  )}

                  {messages.map((msg, index) => {
                    const currentDate = new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                    const prevDate = index > 0 ? new Date(messages[index - 1].createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : null;
                    const showDate = currentDate !== prevDate;

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div style={{ textAlign: 'center', margin: '1.5rem 0 1rem 0' }}>
                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {currentDate}
                            </span>
                          </div>
                        )}
                        {msg.type === 'SYSTEM' ? (
                          <div className="message system-message">
                            <span>{msg.content}</span>
                          </div>
                        ) : (
                          <div className={`message ${msg.senderId === user.id ? 'mine' : 'theirs'}`}>
                            <div className="message-content">{msg.content}</div>
                            <div className="message-time">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <div ref={endOfMessagesRef} />
                </div>

                {/* Input Area */}
                <div className="chat-input-area">
                  {error && <div className="chat-error">{error}</div>}

                  {activeConv.extensionRequested && !activeConv.extensionApproved && (
                    <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid var(--brand-green)', background: 'rgba(0, 210, 106, 0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Guest requested to continue this inquiry.</span>
                        <button className="btn btn-primary btn-sm" onClick={handleApproveExtension} disabled={sending}>
                          {sending ? 'Approving...' : 'Approve 3 More Messages'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeConv.status === 'ARCHIVED' || activeConv.status === 'FLAGGED' || activeConv.status === 'CLOSED' ? (
                    <div className="chat-locked-notice">
                      <Lock size={16} />
                      <span>This conversation is {activeConv.status.toLowerCase()}. Replies are disabled.</span>
                    </div>
                  ) : (
                    <>
                      {activeConv.status === 'LOCKED' && !activeConv.extensionApproved && (
                        <div className="locked-badge-subtle" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', opacity: 0.7 }}>
                          <Lock size={12} style={{ marginRight: '4px' }} />
                          Guest reached limit. You can still reply to help them decide.
                        </div>
                      )}
                      <form onSubmit={handleSend} className="chat-input-form">
                        <input
                          type="text"
                          placeholder="Type your reply..."
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          disabled={sending}
                        />
                        <button type="submit" disabled={!inputText.trim() || sending} className="btn-send">
                          <Send size={18} />
                        </button>
                      </form>
                    </>
                  )}

                  {activeConv.type === 'INQUIRY' && (
                    <div className="inquiry-progress">
                      <Clock size={12} />
                      <span>Guests have a limited message count for inquiries. Your replies are always unlimited.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="chat-empty-state">
                <div className="empty-icon-wrapper">
                  <Send size={40} />
                </div>
                <h3>Your guest conversations</h3>
                <p>
                  Select a guest thread to reply. Pre-booking inquiries stay limited
                  until a booking is confirmed to protect host privacy.
                </p>
                <button className="empty-cta-subtle" onClick={() => navigate('/host/listings')}>
                  View Listings
                </button>
                <div className="empty-help-link" style={{ cursor: 'default' }}>
                  Conversations appear when guests ask questions or book
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostMessages;
