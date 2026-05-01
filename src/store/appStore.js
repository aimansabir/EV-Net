/**
 * EV-Net — App Store (Zustand)
 * 
 * Global app state for favorites, notifications, and UI state.
 */

import { create } from 'zustand';
import { favoriteService, notificationService } from '../data/api.js';

const useAppStore = create((set, get) => ({
  // ─── Favorites ─────────────────────────────────────
  favorites: new Set(),
  favoritesLoaded: false,

  loadFavorites: async () => {
    if (get().favoritesLoaded) return;
    const favs = await favoriteService.getAll();
    set({ favorites: new Set(favs), favoritesLoaded: true });
  },

  toggleFavorite: async (listingId) => {
    const { isFavorited } = await favoriteService.toggle(listingId);
    const newFavs = new Set(get().favorites);
    if (isFavorited) {
      newFavs.add(listingId);
    } else {
      newFavs.delete(listingId);
    }
    set({ favorites: newFavs });
    return isFavorited;
  },

  isFavorited: (listingId) => {
    return get().favorites.has(listingId);
  },

  // ─── Notifications ────────────────────────────────
  notifications: [],
  notificationsLoaded: false,

  loadNotifications: async (userId) => {
    try {
      const notifs = await notificationService.getByUser(userId);
      set({ notifications: notifs, notificationsLoaded: true });
    } catch (err) {
      console.warn('[EV-Net] Notification load failed:', err.message);
      set({ notifications: [], notificationsLoaded: true });
    }
  },

  markNotificationRead: async (notifId) => {
    try {
      await notificationService.markRead(notifId);
    } catch (err) {
      console.warn('[EV-Net] Notification mark-read failed:', err.message);
    }
    set({
      notifications: get().notifications.map(n =>
        n.id === notifId ? { ...n, isRead: true } : n
      ),
    });
  },

  subscribeToNotifications: (userId) => {
    if (!notificationService.subscribeToUser || !userId) return () => {};

    return notificationService.subscribeToUser(userId, (notification) => {
      if (!notification?.id) return;

      if (notification.deleted) {
        set({
          notifications: get().notifications.filter(n => n.id !== notification.id),
        });
        return;
      }

      const current = get().notifications;
      const exists = current.some(n => n.id === notification.id);
      const notifications = exists
        ? current.map(n => n.id === notification.id ? { ...n, ...notification } : n)
        : [notification, ...current];

      set({
        notifications: notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        notificationsLoaded: true,
      });
    });
  },

  unreadCount: () => {
    return get().notifications.filter(n => !n.isRead).length;
  },
}));

export default useAppStore;
