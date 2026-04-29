import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, Clock, Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import useAuthStore from '../../store/authStore';
import { messagingService } from '../../data/api';
import './Messages.css';

const UserMessages = () => {
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

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    // Auto-scroll to bottom of chat
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await messagingService.getConversations(user.id);
      setConversations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (convId) => {
    try {
      const msgs = await messagingService.getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  };

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
      // User-friendly error feedback
      if (err.message.includes('limit reached')) {
        setError("Inquiry limit reached. Please book to continue.");
      } else {
        setError("Unable to send message. Please try again.");
      }
      console.error("[Messaging Error]", err.message);
    } finally {
      setSending(false);
    }
  };

  const handleRequestContinue = async () => {
    setSending(true);
    setError(null);
    try {
      await messagingService.requestExtension(activeConvId);
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      setError("Unable to request to continue. Please try again.");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  if (isLoading) return <div className="messages-loading"><div className="spinner"></div></div>;

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 100px)', padding: '0.75rem 0' }}>
      <div className="messages-layout">
        {/* Sidebar ListView */}
        <div className={`messages-sidebar ${activeConvId ? 'hide-on-mobile' : ''}`}>
          <h2 className="sidebar-header">Inbox</h2>
          <div className="conversation-list">
            {conversations.length === 0 ? (
              <div className="sidebar-empty-block">
                <h4>No conversations yet</h4>
                <p>Use Ask Host on a charger listing to start a pre-booking inquiry. Booking chats will appear here too.</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`}
                  onClick={() => navigate(`/app/messages?conversation=${conv.id}`)}
                >
                  <div className="conv-avatar">
                    <Avatar 
                      src={conv.user?.avatar} 
                      name={conv.user?.name} 
                      size="40px" 
                    />
                  </div>
                  <div className="conv-preview">
                    <div className="conv-name">{conv.user?.name || 'Host'}</div>
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
                <button className="back-btn mobile-only" onClick={() => navigate('/app/messages')}>
                  <ArrowLeft size={20} />
                </button>
                <div className="chat-header-info">
                  <h3>{activeConv.user?.name || 'Host'}</h3>
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
                    <span>Exact address & phone are only shared after booking.</span>
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

                {activeConv.status === 'LOCKED' ? (
                  <div className="chat-locked-notice">
                    <div className="locked-msg" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                      <Lock size={16} />
                      <span>Inquiry limit reached. You can book this charger now or request to continue the conversation.</span>
                    </div>
                    <div className="locked-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/app/charger/${activeConv.listingId}`)}>Book Now</button>
                      {!activeConv.extensionRequested && (
                        <button className="btn btn-secondary btn-sm" onClick={handleRequestContinue} disabled={sending}>
                          {sending ? 'Requesting...' : 'Request to Continue'}
                        </button>
                      )}
                    </div>
                    {activeConv.extensionRequested && !activeConv.extensionApproved && (
                      <div className="pending-notice" style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', opacity: 0.8 }}>
                        Waiting for host approval to continue this inquiry.
                      </div>
                    )}
                  </div>
                ) : activeConv.status !== 'OPEN' ? (
                  <div className="chat-locked-notice">
                    <Lock size={16} />
                    <span>This conversation is {activeConv.status.toLowerCase()}.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="chat-input-form">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      disabled={sending}
                    />
                    <button type="submit" disabled={!inputText.trim() || sending} className="btn-send">
                      <Send size={18} />
                    </button>
                  </form>
                )}

                {activeConv.type === 'INQUIRY' && (
                  <div className="inquiry-progress">
                    <Clock size={12} />
                    {activeConv.extensionApproved ? (
                      <span style={{ color: 'var(--brand-green)' }}>
                        Host approved 3 more messages for this inquiry. ({activeConv.extensionCount} used)
                      </span>
                    ) : (
                      <span>{activeConv.messageCount} of 3 free inquiry messages used</span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="chat-empty-state">
              <div className="empty-icon-wrapper">
                <Send size={40} />
              </div>
              <h3>Start a conversation</h3>
              <p>
                Use <strong>Ask Host</strong> from a charger listing for pre-booking questions about compatibility, access, or timing.
                Confirmed bookings will unlock full chat here.
              </p>
              <button className="empty-cta-subtle" onClick={() => navigate('/app/explore')}>
                Explore Chargers
              </button>
              <a href="#" className="empty-help-link" onClick={(e) => { e.preventDefault(); alert("Messaging Guide: Pre-booking inquiries are limited to 3 messages to protect host privacy. Booking a slot unlocks unlimited messaging and exact location details."); }}>
                How messaging works
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserMessages;
