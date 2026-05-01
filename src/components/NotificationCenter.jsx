import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Info, AlertTriangle, CreditCard, Calendar, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { notifications, loadNotifications, markNotificationRead, subscribeToNotifications, unreadCount } = useAppStore();
  const count = unreadCount();

  useEffect(() => {
    if (user?.id) {
      loadNotifications(user.id);
    }
  }, [user?.id, loadNotifications]);

  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeToNotifications(user.id);
  }, [user?.id, subscribeToNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'BOOKING_UPDATE':
      case 'BOOKING_SUBMITTED':
      case 'NEW_BOOKING_REQUEST':
      case 'BOOKING_STATUS_UPDATE':
        return <Calendar size={16} color="var(--brand-cyan)" />;
      case 'PAYMENT': return <CreditCard size={16} color="var(--brand-green)" />;
      case 'VERIFICATION': return <AlertTriangle size={16} color="#fbbf24" />;
      case 'MESSAGE': return <MessageSquare size={16} color="#a78bfa" />;
      case 'SYSTEM': return <Info size={16} color="#94a3b8" />;
      default: return <Bell size={16} color="var(--text-secondary)" />;
    }
  };

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    await markNotificationRead(id);
  };

  const getNotificationRoute = (notification) => {
    const data = notification.data || {};
    const conversationId = data.conversationId || data.conversation_id;
    const listingId = data.listingId || data.listing_id;
    const isHost = user?.role === 'HOST' || user?.role === 'host';

    if (notification.type === 'MESSAGE') {
      const basePath = isHost ? '/host/messages' : '/app/messages';
      return conversationId ? `${basePath}?conversation=${encodeURIComponent(conversationId)}` : basePath;
    }

    if (notification.type === 'NEW_BOOKING_REQUEST') return '/host/bookings';

    if (['BOOKING_UPDATE', 'BOOKING_SUBMITTED', 'BOOKING_STATUS_UPDATE'].includes(notification.type)) {
      return isHost ? '/host/bookings' : '/app/bookings';
    }

    if (notification.type === 'VERIFICATION') {
      return isHost ? '/host/onboarding' : '/app/verification';
    }

    if (listingId) return `/app/charger/${encodeURIComponent(listingId)}`;

    return null;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markNotificationRead(notification.id);
    }

    const route = getNotificationRoute(notification);
    setIsOpen(false);
    if (route) navigate(route);
  };

  return (
    <div className="notification-center-wrapper" ref={dropdownRef}>
      <button 
        className={`notif-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} />
        {count > 0 && <span className="notif-badge">{count}</span>}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h3>Notifications</h3>
            {count > 0 && <span className="notif-count-label">{count} unread</span>}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notif-icon-box">
                    {getIcon(n.type)}
                  </div>
                  <div className="notif-content">
                    <p className="notif-message">{n.message}</p>
                    <span className="notif-time">
                      {new Date(n.created_at || n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!n.isRead && (
                    <button 
                      className="notif-mark-btn"
                      onClick={(e) => handleMarkRead(e, n.id)}
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="notif-footer">
            <button 
              className="btn-close-notif" 
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '0.4rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
