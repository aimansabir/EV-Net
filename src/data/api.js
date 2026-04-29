/**
 * EV-Net — API Router
 * 
 * Env-based re-export: mock or Supabase backend.
 * All components import from this file — zero changes needed.
 * 
 * Set VITE_USE_MOCK=true in .env.development to use seed data.
 * Set VITE_USE_MOCK=false in .env.production to use Supabase.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

let api;

if (USE_MOCK) {
  console.log('[EV-Net] Using mock API layer');
  api = await import('./api.mock.js');
} else {
  console.log('[EV-Net] Using Supabase API layer');
  api = await import('./api.supabase.js');
}

export const authService = api.authService;
export const listingService = api.listingService;
export const availabilityService = api.availabilityService;
export const bookingService = api.bookingService;
export const messagingService = api.messagingService;
export const hostService = api.hostService;
export const adminService = api.adminService;
export const reviewService = api.reviewService;
export const favoriteService = api.favoriteService;
export const notificationService = api.notificationService;
export const profileService = api.profileService;
export const verificationService = api.verificationService;
