/**
 * EV-Net — Auth Store (Zustand)
 * 
 * Manages authentication state, role-based access, and demo mode.
 * Supports both Supabase session hydration and localStorage fallback (mock mode).
 */

import { create } from 'zustand';
import { authService } from '../data/api.js';

const STORAGE_KEY = 'EV-Net_auth';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Load persisted auth state
function loadPersistedAuth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user || null,
        role: parsed.role || 'guest',
        isAuthenticated: !!parsed.user,
      };
    }
  } catch {
    // Ignore corrupt localStorage
  }
  return { user: null, role: 'guest', isAuthenticated: false };
}

function persistAuth(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: state.user,
      role: state.role,
    }));
  } catch {
    // Ignore storage errors
  }
}

const useAuthStore = create((set, get) => ({
  ...loadPersistedAuth(),
  isInitialized: false,
  isLoading: false,           // Global auth action loading (login/signup)
  isAuthHydrating: false,     // Background profile fetching
  error: null,
  _authSubscription: null,
  _initPromise: null,

  /**
   * Initialize Auth — restores Supabase session or falls back to localStorage.
   */
  initAuth: () => {
    // Already initialized
    if (get().isInitialized) return Promise.resolve();

    // Already initializing
    if (get()._initPromise) return get()._initPromise;

    const promise = (async () => {
      // Clean up any existing subscription on re-init
      const existingSub = get()._authSubscription;
      if (existingSub) {
        existingSub.unsubscribe();
        set({ _authSubscription: null });
      }

      try {
      // 1. Try Supabase session hydration (returns null in mock mode)
      const session = await authService.getSession();

      if (session?.user) {
        // 1a. INSTANT HINT: Use session metadata to unlock UI immediately
        const metadataRole = session.user.user_metadata?.role?.toLowerCase() || 'user';
        set({ 
          role: metadataRole, 
          isAuthenticated: true,
          isInitialized: true // UNLOCK NAVIGATION IMMEDIATELY
        });

        // 1b. BACKGROUND: Hydrate full profile (No await here, let it run in bg)
        set({ isAuthHydrating: true });
        authService.getMe(session.user.id).then(user => {
          if (user) {
            const state = {
              user,
              role: user.role.toLowerCase(),
              isAuthenticated: true,
            };
            set({ ...state, isAuthHydrating: false });
            persistAuth(state);
          } else {
            // Profile truly missing - only then clear
            get()._clearAuth();
            set({ isAuthHydrating: false });
          }
        }).catch(err => {
          console.error('[EV-Net] Background hydration failed:', err);
          set({ isAuthHydrating: false });
        });
      } else {
        // 2. No Supabase session - fall back to localStorage only in explicit mock mode
        if (!USE_MOCK) {
          get()._clearAuth();
          return;
        }

        const persisted = loadPersistedAuth();
        if (persisted.user) {
          // Provisionally trust persisted state for mock speed
          set({ ...persisted, isInitialized: true });
          
          set({ isAuthHydrating: true });
          authService.getMe(persisted.user.id).then(updatedUser => {
            if (updatedUser) {
              set({ 
                user: updatedUser, 
                role: updatedUser.role.toLowerCase(), 
                isAuthenticated: true,
                isAuthHydrating: false
              });
            } else {
              get()._clearAuth();
              set({ isAuthHydrating: false });
            }
          }).catch(() => set({ isAuthHydrating: false }));
        }
      }

      // 3. Subscribe to Supabase auth state changes (token refresh, sign out)
      if (authService.onAuthStateChange) {
        const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
            get()._clearAuth();
          } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
            try {
              const user = await authService.getMe(session.user.id);
              if (user) {
                const state = {
                  user,
                  role: user.role.toLowerCase(),
                  isAuthenticated: true,
                };
                set(state);
                persistAuth(state);
              } else {
                get()._clearAuth();
              }
            } catch (err) {
              console.error('[EV-Net] Auth error during state change:', err);
            }
          }
        });
        
        if (subscription) {
          set({ _authSubscription: subscription });
        }
      }
    } finally {
      set({ isInitialized: true, _initPromise: null });
    }
    })();

    set({ _initPromise: promise });
    return promise;
  },

  /**
   * Login with email and password
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.login(email, password);
      const role = user.role.toLowerCase();
      const state = { user, role, isAuthenticated: true };
      set(state);
      persistAuth(state);
      return { user, role };
    } catch (err) {
      const errorMsg = err.message || (typeof err === 'string' ? err : 'An unexpected login error occurred');
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Login with Google OAuth — redirects to Google, then /auth/callback.
   * Session hydration happens in initAuth after the redirect.
   */
  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.loginWithGoogle();
    } catch (err) {
      const errorMsg = err.message || 'Failed to initialize Google Login';
      set({ error: errorMsg });
      throw err;
    } finally {
      // Note: redirection usually happens before this for success
      set({ isLoading: false });
    }
  },

  /**
   * Quick demo login — logs in with pre-seeded accounts
   */
  demoLogin: async (demoRole) => {
    const accounts = {
      user: { email: 'ali@example.com', password: 'demo123' },
      verified: { email: 'verified@example.com', password: 'demo123' },
      tester: { email: 'tester@example.com', password: 'demo123' },
      host: { email: 'ahsan@example.com', password: 'demo123' },
      admin: { email: 'admin@EV-Net.pk', password: 'admin123' },
    };
    const creds = accounts[demoRole];
    if (!creds) throw new Error('Invalid demo role');
    return get().login(creds.email, creds.password);
  },

  /**
   * Signup as EV User
   */
  signupUser: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.signupUser(data);
      
      if (result.verificationRequired) {
        return { verificationRequired: true };
      }

      const { user } = result;
      const state = { user, role: 'user', isAuthenticated: true };
      set(state);
      persistAuth(state);
      return { user, success: true };
    } catch (err) {
      const errorMsg = err.message || 'Signup failed';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Signup as Host
   */
  signupHost: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.signupHost(data);

      if (result.verificationRequired) {
        return { verificationRequired: true };
      }

      const { user } = result;
      const state = { user, role: 'host', isAuthenticated: true };
      set(state);
      persistAuth(state);
      return { user, success: true };
    } catch (err) {
      const errorMsg = err.message || 'Host signup failed';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Logout — clears state immediately, then signs out from Supabase (best-effort).
   */
  logout: async () => {
    const state = { user: null, role: 'guest', isAuthenticated: false, isLoading: false, error: null };
    set(state);
    persistAuth(state);
    try {
      await authService.logout();
    } catch {
      // Best-effort Supabase sign out — state is already cleared
    }
  },

  /**
   * Switch role (DEMO MODE ONLY)
   * Instantly switch between user/host/admin with pre-seeded accounts.
   */
  switchRole: async (newRole) => {
    return get().demoLogin(newRole);
  },

  /**
   * Clear error
   */
  clearError: () => set({ error: null }),

  /**
   * Reload current user to get fresh verification status
   */
  reloadUser: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const updatedUser = await authService.getMe(user.id);
      if (updatedUser) {
        const state = { user: updatedUser, role: updatedUser.role.toLowerCase() };
        set(state);
        persistAuth({ ...get(), ...state });
      }
    } catch (err) {
      console.warn('[EV-Net] Failed to reload current user:', err.message);
    }
  },

  /**
   * Internal: clear auth state (used during init failures).
   */
  _clearAuth: () => {
    const state = { user: null, role: 'guest', isAuthenticated: false, isLoading: false, error: null };
    set(state);
    persistAuth(state);
  },
}));

export default useAuthStore;
