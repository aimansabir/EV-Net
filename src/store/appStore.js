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
    const notifs = await notificationService.getByUser(userId);
    set({ notifications: notifs, notificationsLoaded: true });
  },

  markNotificationRead: async (notifId) => {
    await notificationService.markRead(notifId);
    set({
      notifications: get().notifications.map(n =>
        n.id === notifId ? { ...n, isRead: true } : n
      ),
    });
  },

  unreadCount: () => {
    return get().notifications.filter(n => !n.isRead).length;
  },
}));

export default useAppStore;
