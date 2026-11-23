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

// Seeded mock-mode accounts used by the dev DemoSwitcher (see data/seed.js).
const DEMO_ACCOUNTS = {
  user: { email: 'ali@example.com', password: 'demo123' },
  host: { email: 'omar@example.com', password: 'demo123' },
  admin: { email: 'admin@EV-Net.pk', password: 'admin123' },
};
const AUTH_TIMEOUT_MS = 20000;

function authDebug(...args) {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH === 'true') {
    console.debug(...args);
  }
}

function withAuthTimeout(promise, label, timeoutMs = AUTH_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

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
  hydrationError: null,
  _authSubscription: null,
  _initPromise: null,

  /**
   * Initialize Auth — restores Supabase session or falls back to localStorage.
   */
  initAuth: (options = { force: false }) => {
    // Already initialized
    if (!options.force && get().isInitialized && !get().isAuthHydrating) return Promise.resolve();

    // Already initializing
    if (!options.force && get()._initPromise) return get()._initPromise;

    const promise = (async () => {
      const persisted = loadPersistedAuth();

      // Clean up any existing subscription on re-init
      const existingSub = get()._authSubscription;
      if (existingSub) {
        existingSub.unsubscribe();
        set({ _authSubscription: null });
      }

      // Subscribe first so sign-in / sign-out / expiry are tracked even when
      // the visitor starts logged out.
      get()._subscribeToAuthChanges();

      try {
      authDebug('[EV-Net][Auth] checking session');
      // 1. Try Supabase session hydration (returns null in mock mode)
      const session = await withAuthTimeout(
        authService.getSession(),
        'Auth session check timed out.'
      );
      authDebug('[EV-Net][Auth] session loaded', { hasSession: !!session?.user });

      if (session?.user) {
        // 1a. INSTANT HINT: Use session metadata to unlock UI immediately
        const persistedRole = get().role;
        const metadataRole = session.user.user_metadata?.role?.toLowerCase();
        
        // Prefer persisted role (from last successful profile load), fallback to metadata role, fallback to 'user'
        const initialRole = (persistedRole && persistedRole !== 'guest') ? persistedRole : (metadataRole || 'user');
        authDebug('[EV-Net][Auth] resolved role', initialRole, { persistedRole, metadataRole });
        
        set({ 
          role: initialRole, 
          isAuthenticated: true,
          isInitialized: true // UNLOCK NAVIGATION IMMEDIATELY
        });

        // 1b. BACKGROUND: Hydrate full profile (No await here, let it run in bg)
        set({ isAuthHydrating: true });
        withAuthTimeout(
          authService.getMe(session.user.id, { throwOnError: true }),
          'Auth profile load timed out.'
        ).then(user => {
          if (user) {
            const state = {
              user,
              role: user.role.toLowerCase(),
              isAuthenticated: true,
            };
            authDebug('[EV-Net][Auth] profile loaded');
            authDebug('[EV-Net][Auth] role loaded', state.role);
            set({ ...state, isAuthHydrating: false, hydrationError: null });
            persistAuth(state);
          } else {
            // Profile truly missing - only then clear
            get()._clearAuth();
            set({ isAuthHydrating: false, hydrationError: 'Your profile could not be loaded. Please retry.' });
          }
        }).catch(err => {
          console.error('[EV-Net][Auth] Background hydration failed:', err);
          set({ isAuthHydrating: false, hydrationError: err.message || 'Profile loading failed. Please retry.' });
        });
      } else {
        // 2. No Supabase session - fall back to localStorage only in explicit mock mode
        if (!USE_MOCK) {
          get()._clearAuth();
          return;
        }

        if (persisted.user) {
          // Provisionally trust persisted state for mock speed
          set({ ...persisted, isInitialized: true });
          
          set({ isAuthHydrating: true });
          withAuthTimeout(
            authService.getMe(persisted.user.id, { throwOnError: true }),
            'Persisted profile load timed out.'
          ).then(updatedUser => {
            if (updatedUser) {
              set({ 
                user: updatedUser, 
                role: updatedUser.role.toLowerCase(), 
                isAuthenticated: true,
                isAuthHydrating: false,
                hydrationError: null
              });
            } else {
              get()._clearAuth();
              set({ isAuthHydrating: false, hydrationError: 'Your saved profile could not be loaded. Please retry.' });
            }
          }).catch((err) => {
            console.warn('[EV-Net][Auth] profile hydration failed', err.message);
            set({ isAuthHydrating: false, hydrationError: err.message || 'Profile loading failed. Please retry.' });
          });
        }
      }

    } catch (err) {
      console.warn('[EV-Net][Auth] session hydration failed', err.message);
      if (persisted.user) {
        set({ ...persisted, isInitialized: true, isAuthHydrating: false, error: null, hydrationError: err.message || null });
      } else if (!USE_MOCK) {
        get()._clearAuth();
      }
    } finally {
      set({ isInitialized: true, _initPromise: null });
    }
    })();

    set({ _initPromise: promise });
    return promise;
  },

  /**
   * Listen for Supabase auth events.
   *
   * IMPORTANT: the callback must stay synchronous and must not call Supabase
   * directly. supabase-js runs it while holding its internal auth lock, so
   * awaiting a query (or auth.getUser) inside it deadlocks the client and
   * every later request — uploads, page loads — hangs forever. Follow-up work
   * is deferred with setTimeout, as the Supabase docs recommend.
   */
  _subscribeToAuthChanges: () => {
    if (!authService.onAuthStateChange) return;

    const result = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setTimeout(() => get()._clearAuth(), 0);
        return;
      }

      // Token refreshes don't change who the user is — nothing to reload.
      if (event === 'TOKEN_REFRESHED' || !session?.user) return;

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const current = get().user;
        // supabase-js re-emits SIGNED_IN when a tab regains focus; skip the
        // reload if this user's profile is already loaded.
        if (event === 'SIGNED_IN' && current?.id === session.user.id) return;

        const userId = session.user.id;
        setTimeout(async () => {
          try {
            const user = await authService.getMe(userId, { force: event === 'USER_UPDATED' });
            if (!user) return;
            const state = { user, role: user.role.toLowerCase(), isAuthenticated: true };
            set({ ...state, hydrationError: null });
            persistAuth(state);
          } catch (err) {
            // Keep the current session on transient errors instead of
            // logging the user out.
            console.error('[EV-Net] Auth error during state change:', err);
          }
        }, 0);
      }
    });

    const subscription = result?.data?.subscription;
    if (subscription) set({ _authSubscription: subscription });
  },

  /**
   * Login with email and password
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null, hydrationError: null });
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
    set({ isLoading: true, error: null, hydrationError: null });
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

  resetPassword: async (email) => {
    set({ isLoading: true, error: null, hydrationError: null });
    try {
      return await authService.resetPassword(email);
    } catch (err) {
      const errorMsg = err.message || 'Could not send password reset email.';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },


  /**
   * Signup as EV User
   */
  signupUser: async (data) => {
    set({ isLoading: true, error: null, hydrationError: null });
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
    set({ isLoading: true, error: null, hydrationError: null });
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
    const state = { user: null, role: 'guest', isAuthenticated: false, isLoading: false, error: null, hydrationError: null };
    set(state);
    persistAuth(state);
    try {
      await authService.logout();
    } catch {
      // Best-effort Supabase sign out — state is already cleared
    }
  },


  /**
   * Demo-only: sign in as a seeded account for the given role.
   * Only available in mock mode — real accounts can't change role client-side.
   */
  switchRole: async (newRole) => {
    if (!USE_MOCK) {
      throw new Error('Role switching is only available in mock/demo mode.');
    }
    const account = DEMO_ACCOUNTS[newRole];
    if (!account) throw new Error(`Unknown demo role: ${newRole}`);
    return get().login(account.email, account.password);
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
      const updatedUser = await authService.getMe(user.id, { force: true });
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
   * Patch the current user locally for optimistic UI updates.
   */
  patchUser: (partialUser) => {
    const { user, role } = get();
    if (!user || !partialUser) return null;

    const nextUser = { ...user, ...partialUser };
    const nextRole = (nextUser.role || role || 'guest').toLowerCase();
    const state = { user: nextUser, role: nextRole, isAuthenticated: true };
    set(state);
    persistAuth({ ...get(), ...state });
    return nextUser;
  },

  /**
   * Internal: clear auth state (used during init failures).
   */
  _clearAuth: () => {
    const state = { user: null, role: 'guest', isAuthenticated: false, isLoading: false, error: null, hydrationError: null };
    set(state);
    persistAuth(state);
  },
}));

export default useAuthStore;
