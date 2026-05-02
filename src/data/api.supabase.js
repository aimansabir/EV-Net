/**
 * EV-Net — Supabase API Service Layer
 * 
 * Same interface as api.mock.js so all components work without changes.
 * Calls Supabase Auth, Postgres (via PostgREST), Storage, and Edge Functions.
 * 
 * STATUS: Scaffold — auth wired, other services are stubs that throw
 * "Not yet implemented (Supabase)" so the app can boot and you can
 * incrementally wire each service.
 */

import { supabase } from '../lib/supabase.js';
import { calculateHostPayout } from './feeConfig.js';
import { friendlyAuthError, normalizePersonName } from '../utils/text.js';

// ─── PERFORMANCE CACHE ──────────────────────────────────
let _cachedUser = null;
let _userCacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds
const VERIFICATION_BUCKET = 'verification_documents';

async function getAuthenticatedUser() {
  const now = Date.now();
  if (_cachedUser && (now - _userCacheTime < CACHE_TTL)) {
    return { data: { user: _cachedUser }, error: null };
  }
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) {
    _cachedUser = data.user;
    _userCacheTime = now;
  }
  return { data, error };
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getEvProfile(userId) {
  const { data, error } = await supabase
    .from('ev_profiles')
    .select('*, avatar_path')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getHostProfile(userId) {
  const { data, error } = await supabase
    .from('host_profiles')
    .select('*, avatar_path')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function withTimeout(promise, ms = 15000) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Operation timed out. Profile setup is taking longer than expected. Please log in again in a moment.'));
    }, ms);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));
}

async function withOperationTimeout(promise, ms, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function isMissingColumnError(error, columnName) {
  const message = error?.message || '';
  return (error?.code === '42703' || error?.code === 'PGRST204') && message.includes(columnName);
}

/**
 * Robustly poll for a record in any table (used after signup to wait for trigger).
 */
async function pollTable(tableName, userId, field = 'id', maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(field, userId)
      .maybeSingle();
    
    if (error) throw error;
    if (data) return data;
    
    // Exponential backoff: 500ms, 1000ms, 1500ms...
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

async function pollProfile(userId) {
  const profile = await pollTable('profiles', userId);
  if (!profile) throw new Error('Profile creation timed out. Please try logging in.');
  return profile;
}

/**
 * Derives public storage URL with cache busting.
 */
function resolveAvatarUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('profile_avatars').getPublicUrl(path);
  // Add timestamp for cache busting
  return `${data.publicUrl}?t=${Date.now()}`;
}

function resolveListingPhotoUrl(path) {
  if (!path) return null;
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  const { data } = supabase.storage.from('listing_photos').getPublicUrl(path);
  return data.publicUrl;
}

function isUploadableFile(input) {
  const file = input?.file || input;
  return !!(
    file &&
    typeof file === 'object' &&
    typeof file.name === 'string' &&
    typeof file.arrayBuffer === 'function'
  );
}

async function createVerificationSignedUrl(path) {
  if (!path) return null;
  if (/^(https?:|blob:|data:)/.test(path)) return path;

  try {
    const { data, error } = await supabase.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (error) throw error;
    return data?.signedUrl || null;
  } catch (err) {
    console.warn('[EV-Net] Could not create verification document signed URL:', err.message);
    return null;
  }
}

function isEmailVerified(authUser) {
  const provider = authUser?.app_metadata?.provider || 'email';
  return !!(authUser?.email_confirmed_at || provider === 'google');
}

async function syncEvEmailVerification(userId, evProfile, authUser) {
  if (!evProfile || !authUser) return evProfile;

  const emailVerified = isEmailVerified(authUser);
  if (evProfile.email_verified === emailVerified) return evProfile;

  try {
    const { data, error } = await supabase
      .from('ev_profiles')
      .update({ email_verified: emailVerified })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data || { ...evProfile, email_verified: emailVerified };
  } catch (err) {
    console.warn('[EV-Net] Could not sync EV email verification flag:', err.message);
    return { ...evProfile, email_verified: emailVerified };
  }
}

function mergeDocumentPath(paths, row, field, documentType) {
  const legacyPath = row[field];
  const modernPath = row.document_type === documentType ? row.storage_path : null;
  if (!paths[field] && (legacyPath || modernPath)) {
    paths[field] = legacyPath || modernPath;
  }
}

/**
 * Best-effort notification helper used by admin actions.
 * Catches and logs errors silently so admin workflows never break due to notification failures.
 */
function normalizeNotificationRow(row) {
  if (!row) return null;
  return {
    ...row,
    userId: row.user_id,
    isRead: row.is_read,
    createdAt: row.created_at,
    data: row.data || {},
  };
}

async function safeSendNotification(userId, type, message, data = null) {
  if (!userId) return;
  try {
    const payload = { user_id: userId, type, message, is_read: false };
    if (data && Object.keys(data).length > 0) payload.data = data;

    const { error } = await supabase
      .from('notifications')
      .insert(payload);

    if (error) throw error;
  } catch (err) {
    console.warn('[EV-Net] safeSendNotification failed:', err.message);
  }
}

async function getLatestVerificationDocuments(userId, profileType) {
  try {
    const { data, error } = await supabase
      .from('verification_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return (data || [])
      .filter(row => (row.type || row.profile_type) === profileType)
      .reduce((paths, row) => {
        mergeDocumentPath(paths, row, 'cnic_path', 'CNIC_FRONT');
        mergeDocumentPath(paths, row, 'cnic_back_path', 'CNIC_BACK');
        mergeDocumentPath(paths, row, 'ev_proof_path', 'EV_PROOF');
        mergeDocumentPath(paths, row, 'property_proof_path', 'PROPERTY_PROOF');
        mergeDocumentPath(paths, row, 'charger_proof_path', 'CHARGER_PROOF');
        return paths;
      }, {});
  } catch (err) {
    console.warn('[EV-Net] Could not hydrate verification document paths:', err.message);
    return {};
  }
}

function isHostIdentitySubmitted(hostProfile, verificationDocs = {}) {
  return !!(hostProfile?.identity_verified || hostProfile?.cnic_submitted || verificationDocs.cnic_path);
}

/**
 * Merge profile + role-specific profile into the shape
 * the frontend expects (flat User object).
 */
function mergeUserShape(profile, evProfile, hostProfile, authUser = null, verificationDocs = {}) {
  if (!profile) return null;

  const provider = authUser?.app_metadata?.provider || 'email';
  const emailVerified = isEmailVerified(authUser);
  const phoneVerified = !!authUser?.phone_confirmed_at;

  const base = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    isSuspended: profile.is_suspended,
    createdAt: profile.created_at,
    avatar: profile.avatar_url, // Default fallback
    authProvider: provider,
    emailVerified: emailVerified,
    phoneVerified: phoneVerified,
  };

  if (profile.role === 'USER' && evProfile) {
    const avatar = resolveAvatarUrl(evProfile.avatar_path);
    const cnicSubmitted = !!(evProfile.cnic_submitted || verificationDocs.cnic_path);
    const cnicBackSubmitted = !!(evProfile.cnic_back_submitted || verificationDocs.cnic_back_path);
    const evProofSubmitted = !!(evProfile.ev_proof_submitted || verificationDocs.ev_proof_path);
    return {
      ...base,
      phone: evProfile.phone,
      avatar: avatar || base.avatar,
      avatarPath: evProfile.avatar_path,
      evBrand: evProfile.ev_brand,
      evModel: evProfile.ev_model,
      connectorPreference: evProfile.connector_preference,
      verificationStatus: evProfile.verification_status,
      cnicSubmitted,
      cnicBackSubmitted,
      cnicPath: verificationDocs.cnic_path || evProfile.cnic_path,
      cnicBackPath: verificationDocs.cnic_back_path || evProfile.cnic_back_path,
      evProofSubmitted,
      evProofPath: verificationDocs.ev_proof_path || evProfile.ev_proof_path,
      isRestrictedFromInquiry: evProfile.is_restricted_from_inquiry,
      // Derived
      canBook: emailVerified && cnicSubmitted && cnicBackSubmitted && evProofSubmitted && evProfile.verification_status === 'approved',
    };
  }

  if (profile.role === 'HOST' && hostProfile) {
    const avatar = resolveAvatarUrl(hostProfile.avatar_path);
    const cnicSubmitted = isHostIdentitySubmitted(hostProfile, verificationDocs);
    const cnicBackSubmitted = !!(hostProfile.cnic_back_submitted || verificationDocs.cnic_back_path);
    const propertyProofUploaded = !!(hostProfile.property_proof_uploaded || verificationDocs.property_proof_path);
    const chargerProofUploaded = !!(hostProfile.charger_proof_uploaded || verificationDocs.charger_proof_path);
    return {
      ...base,
      phone: hostProfile.phone,
      avatar: avatar || base.avatar,
      avatarPath: hostProfile.avatar_path,
      verificationStatus: hostProfile.verification_status,
      cnicSubmitted,
      cnicBackSubmitted,
      cnicPath: verificationDocs.cnic_path || hostProfile.cnic_path,
      cnicBackPath: verificationDocs.cnic_back_path || hostProfile.cnic_back_path,
      propertyProofUploaded,
      propertyProofPath: verificationDocs.property_proof_path || hostProfile.property_proof_path,
      chargerProofUploaded,
      chargerProofPath: verificationDocs.charger_proof_path || hostProfile.charger_proof_path,
    };
  }

  // Admin or fallback
  return base;
}

// ─── AUTH SERVICE ───────────────────────────────────────

export const authService = {
  async login(email, password) {
    return withTimeout((async () => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (authError) throw new Error(friendlyAuthError(authError));

      _cachedUser = authData.user;
      _userCacheTime = Date.now();

      const userId = authData.user.id;
      const authUser = authData.user;
      const profile = await getProfile(userId);
      if (!profile) {
        throw new Error('Authentication successful, but user profile was not found in the database.');
      }

      let evProfile = null;
      let hostProfile = null;

      if (profile.role === 'USER') {
        evProfile = await getEvProfile(userId);
        if (!evProfile) {
          console.warn(`[EV-Net] User sub-profile missing for ${userId}. Repairing...`);
          await supabase.rpc('ensure_ev_profile', { p_user_id: userId });
          evProfile = await getEvProfile(userId);
        }
        evProfile = await syncEvEmailVerification(userId, evProfile, authUser);
      } else if (profile.role === 'HOST') {
        hostProfile = await getHostProfile(userId);
        if (!hostProfile) {
          console.warn(`[EV-Net] Host sub-profile missing for ${userId}. Repairing...`);
          await supabase.rpc('ensure_host_profile', { p_user_id: userId });
          hostProfile = await getHostProfile(userId);
        }
      }

      const verificationDocs = profile.role === 'USER'
        ? await getLatestVerificationDocuments(userId, 'EV_USER')
        : profile.role === 'HOST'
          ? await getLatestVerificationDocuments(userId, 'HOST')
          : {};

      return { user: mergeUserShape(profile, evProfile, hostProfile, authUser, verificationDocs) };
    })(), 10000);
  },

  /**
   * Resends the verification email for email/password users.
   */
  async sendVerificationEmail(email) {
    const result = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    console.log('[EV-Net] Supabase resend result:', result);
    if (result.error) throw new Error(result.error.message);
    return { success: true };
  },

  async resetPassword(email) {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('Enter your email address first.');

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/login`
    });

    if (error) throw new Error(friendlyAuthError(error));
    return { success: true };
  },

  /**
   * Sends an OTP to the user's phone via WhatsApp.
   */
  async sendPhoneOTP(phone) {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone,
      options: {
        channel: 'whatsapp'
      }
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  /**
   * Verifies the OTP and updates the profile via RPC.
   */
  async verifyPhoneOTP(phone, token, role) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms' // Supabase uses 'sms' type for phone OTP verification
    });
    if (error) throw new Error(error.message);

    // Call role-specific RPC to mark as verified in application logic
    const rpcName = role === 'HOST' ? 'rpc_mark_host_phone_verified' : 'rpc_mark_ev_phone_verified';
    const { error: rpcError } = await supabase.rpc(rpcName, { p_user_id: data.user.id });
    
    if (rpcError) {
      console.warn(`[EV-Net] Phone verified in Auth but RPC ${rpcName} failed:`, rpcError);
    }

    return { success: true, user: data.user };
  },

  async signupUser(formData) {
    const normalizedName = normalizePersonName(formData.name);
    const normalizedEmail = formData.email.trim().toLowerCase();

    // Requirement 1 & 2: Check whether the email already exists via RPC
    const { data: exists, error: checkError } = await supabase.rpc('email_exists', { p_email: normalizedEmail });
    if (checkError) {
      console.error("[EV-Net] email_exists check failed:", checkError);
    } else if (exists) {
      throw new Error("An account with this email already exists. Please log in or reset your password.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: formData.password,
      options: {
        data: {
          name: normalizedName,
          phone: formData.phone,
          role: 'USER',
          ev_brand: formData.evBrand,
          ev_model: formData.evModel,
          connector_preference: formData.connectorPreference,
        },
      },
    });
    if (error) throw new Error(friendlyAuthError(error));

    // If no session, email verification is likely required
    if (!data.session) {
      return { success: true, verificationRequired: true, user: data.user };
    }

    // Wrap polling in a hard timeout
    return withTimeout((async () => {
      const profile = await pollProfile(data.user.id);
      let evProfile = await pollTable('ev_profiles', data.user.id, 'user_id');

      // Update EV-specific fields if provided
      if (formData.evBrand || formData.evModel || formData.connectorPreference) {
        await supabase
          .from('ev_profiles')
          .update({
            ev_brand: formData.evBrand,
            ev_model: formData.evModel,
            connector_preference: formData.connectorPreference,
          })
          .eq('user_id', data.user.id);
        evProfile = await getEvProfile(data.user.id);
      }

      // Handle avatar upload if provided
      if (formData.avatar) {
        try {
          await profileService.uploadAvatar(data.user.id, formData.avatar, 'USER');
        } catch (err) {
          console.error("[EV-Net] Failed to upload avatar during signup:", err);
        }
      }

      evProfile = await syncEvEmailVerification(data.user.id, evProfile, data.user);
      const verificationDocs = await getLatestVerificationDocuments(data.user.id, 'EV_USER');
      return { 
        success: true, 
        user: mergeUserShape(profile, evProfile, null, data.user, verificationDocs)
      };
    })());
  },

  async signupHost(formData) {
    const normalizedName = normalizePersonName(formData.name);
    const normalizedEmail = formData.email.trim().toLowerCase();

    // Requirement 1 & 2: Check whether the email already exists via RPC
    const { data: exists, error: checkError } = await supabase.rpc('email_exists', { p_email: normalizedEmail });
    if (checkError) {
      console.error("[EV-Net] email_exists check failed:", checkError);
    } else if (exists) {
      throw new Error("An account with this email already exists. Please log in or reset your password.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: formData.password,
      options: {
        data: {
          name: normalizedName,
          phone: formData.phone,
          role: 'HOST',
        },
      },
    });
    if (error) throw new Error(friendlyAuthError(error));

    // If no session, email verification is likely required
    if (!data.session) {
      return { success: true, verificationRequired: true, user: data.user };
    }

    // Wrap polling in a hard timeout
    return withTimeout((async () => {
      const profile = await pollProfile(data.user.id);
      const hostProfile = await pollTable('host_profiles', data.user.id, 'user_id');

      // Handle avatar upload if provided
      if (formData.avatar) {
        try {
          await profileService.uploadAvatar(data.user.id, formData.avatar, 'HOST');
        } catch (err) {
          console.error("[EV-Net] Failed to upload host avatar during signup:", err);
        }
      }

      if (!hostProfile) {
        throw new Error('Host sub-profile could not be initialized. Please try logging in.');
      }

      const verificationDocs = await getLatestVerificationDocuments(data.user.id, 'HOST');
      return { 
        success: true, 
        user: mergeUserShape(profile, null, hostProfile, data.user, verificationDocs)
      };
    })());
  },

  async getMe(userId) {
    try {
      const profile = await getProfile(userId);
      if (!profile) return null;
      
      let evProfile = null;
      let hostProfile = null;

      if (profile.role === 'USER') {
        evProfile = await getEvProfile(userId);
        if (!evProfile) {
          await supabase.rpc('ensure_ev_profile', { p_user_id: userId });
          evProfile = await getEvProfile(userId);
        }
      } else if (profile.role === 'HOST') {
        hostProfile = await getHostProfile(userId);
        if (!hostProfile) {
          await supabase.rpc('ensure_host_profile', { p_user_id: userId });
          hostProfile = await getHostProfile(userId);
        }
      }

      const { data: { user: authUser } } = await getAuthenticatedUser();
      if (profile.role === 'USER') {
        evProfile = await syncEvEmailVerification(userId, evProfile, authUser);
      }

      const verificationDocs = profile.role === 'USER'
        ? await getLatestVerificationDocuments(userId, 'EV_USER')
        : profile.role === 'HOST'
          ? await getLatestVerificationDocuments(userId, 'HOST')
          : {};

      return mergeUserShape(profile, evProfile, hostProfile, authUser, verificationDocs);
    } catch (err) {
      console.error('[EV-Net] getMe failed:', err);
      return null;
    }
  },

  async submitUserVerification(userId, profileType) {
    return verificationService.submitForReview(userId, profileType);
  },

  /**
   * Sign out the current Supabase session.
   */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    _cachedUser = null;
    _userCacheTime = 0;
  },

  /**
   * Sign in with Google OAuth.
   * Redirects to Google consent, then back to /auth/callback.
   * The callback page hydrates the session and routes by role.
   */
  async loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Return the current Supabase session (or null if none).
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  /**
   * Subscribe to Supabase auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED).
   * Returns { data: { subscription } } — call subscription.unsubscribe() to clean up.
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ─── PROFILE SERVICE ────────────────────────────────────

export const profileService = {
  async get(userId) {
    return authService.getMe(userId);
  },

  async uploadAvatar(userId, file, role) {
    if (!file) throw new Error("No file provided");

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;
    const table = role === 'HOST' ? 'host_profiles' : 'ev_profiles';

    // 1. Get current path to delete if it changes
    const { data: current } = await supabase
      .from(table)
      .select('avatar_path')
      .eq('user_id', userId)
      .single();

    const oldPath = current?.avatar_path;

    // 2. Upload new
    const { error: uploadError } = await supabase.storage
      .from('profile_avatars')
      .upload(filePath, file, { 
        upsert: true,
        cacheControl: '3600'
      });
    
    if (uploadError) throw uploadError;

    // 3. Update DB
    const { error: dbError } = await supabase
      .from(table)
      .update({ avatar_path: filePath })
      .eq('user_id', userId);
    
    if (dbError) throw dbError;

    // 4. Cleanup old if path changed (different extension)
    if (oldPath && oldPath !== filePath) {
      await supabase.storage.from('profile_avatars').remove([oldPath]);
    }

    return await authService.getMe(userId);
  }
};

// ─── LISTING SERVICE ────────────────────────────────────

export const listingService = {
  resolveListingPhotoUrl,

  async getAll(filters = {}) {
    let query = supabase
      .from('listings')
      .select(`
        *,
        listing_photos ( id, storage_path, display_order )
      `)
      .eq('is_active', true)
      .eq('is_approved', true);

    if (filters.city) query = query.eq('city', filters.city);
    if (filters.chargerType) query = query.eq('charger_type', filters.chargerType);
    if (filters.maxPrice) query = query.lte('price_day_per_kwh', filters.maxPrice);
    if (filters.search) query = query.or(
      `title.ilike.%${filters.search}%,area.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
    );

    try {
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error("ListingService.getAll Error:", error);
        throw error;
      }

      return (data || []).map(l => ({
        ...l,
        images: (l.listing_photos || [])
          .sort((a, b) => a.display_order - b.display_order)
          .map(p => resolveListingPhotoUrl(p.storage_path)),
        pricePerHour: l.price_per_hour,
        priceDay: l.price_day_per_kwh,
        priceNight: l.price_night_per_kwh,
        chargerType: l.charger_type,
        chargerSpeed: l.charger_speed,
        hostId: l.host_id,
        isActive: l.is_active,
        isApproved: l.is_approved,
        setupFeePaid: l.setup_fee_paid,
        reviewCount: l.review_count,
        sessionsCompleted: l.sessions_completed,
        houseRules: l.house_rules,
        createdAt: l.created_at,
      }));
    } catch (error) {
      console.error("listingService.getAll fetch failed", error);
      throw error;
    }
  },

  async getById(id) {
    const { data: listing, error } = await supabase
      .from('listings')
      .select(`
        *,
        listing_photos ( id, storage_path, display_order ),
        host:profiles!host_id ( 
          id, 
          name, 
          avatar_url, 
          created_at,
          host_profiles:host_profiles!user_id ( avatar_path )
        ),
        availability:availability_rules ( id, day_of_week, start_time, end_time )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!listing) return null;

    // Fetch reviews separately (they reference listing_id)
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        *, 
        author:profiles!author_id ( 
          id, 
          name, 
          avatar_url,
          ev_profiles:ev_profiles!user_id ( avatar_path ),
          host_profiles:host_profiles!user_id ( avatar_path )
        )
      `)
      .eq('listing_id', id)
      .order('created_at', { ascending: false });

    // Try to get host profile verification status
    const { data: hostProfile } = await supabase
      .from('host_profiles')
      .select('verification_status')
      .eq('user_id', listing.host_id)
      .single();

    // Try to get exact location (will only succeed if user has booking)
    let location = null;
    try {
      const { data: loc } = await supabase
        .from('listing_locations')
        .select('*')
        .eq('listing_id', id)
        .single();
      location = loc;
    } catch {
      // RLS blocked — expected for users without booking
    }

    return {
      ...listing,
      images: (listing.listing_photos || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(p => resolveListingPhotoUrl(p.storage_path)),
      pricePerHour: listing.price_per_hour,
      priceDay: listing.price_day_per_kwh,
      priceNight: listing.price_night_per_kwh,
      chargerType: listing.charger_type,
      chargerSpeed: listing.charger_speed,
      hostId: listing.host_id,
      isActive: listing.is_active,
      isApproved: listing.is_approved,
      houseRules: listing.house_rules,
      reviewCount: listing.review_count,
      createdAt: listing.created_at,
      host: listing.host ? {
        id: listing.host.id,
        name: listing.host.name,
        avatar: resolveAvatarUrl(listing.host.host_profiles?.[0]?.avatar_path) || listing.host.avatar_url,
        createdAt: listing.host.created_at,
      } : null,
      hostProfile: hostProfile ? { verificationStatus: hostProfile.verification_status } : null,
      reviews: (reviews || []).map(r => ({
        ...r,
        author: r.author ? { 
          id: r.author.id, 
          name: r.author.name, 
          avatar: resolveAvatarUrl(r.author.ev_profiles?.[0]?.avatar_path || r.author.host_profiles?.[0]?.avatar_path) || r.author.avatar_url 
        } : null,
        authorId: r.author_id,
        listingId: r.listing_id,
        createdAt: r.created_at,
      })),
      availability: listing.availability || [],
      // Location fields — only populated if RLS allows
      address: location?.address || null,
      lat: location?.lat || null,
      lng: location?.lng || null,
    };
  },

  async create(data) {
    console.log("[EV-Net] listingService.create: Inserting listing row...", data.title);
    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        host_id: data.hostId,
        title: data.title,
        description: data.description,
        city: data.city,
        area: data.area,
        charger_type: data.chargerType,
        charger_speed: data.chargerSpeed,
        price_per_hour: data.pricePerHour || 1, // Satisfy check (price_per_hour > 0)
        price_day_per_kwh: data.priceDay,
        price_night_per_kwh: data.priceNight,
        amenities: data.amenities || [],
        house_rules: data.houseRules || [],
      })
      .select()
      .single();
    
    if (error) {
      console.error("[EV-Net] Error inserting listing row:", error);
      throw error;
    }
    console.log("[EV-Net] listingService.create: Listing row created ID:", listing.id);

    // 2. Insert location separately
    if (data.address && data.lat && data.lng) {
      console.log("[EV-Net] listingService.create: Inserting location...", data.address);
      const { error: locError } = await supabase.from('listing_locations').insert({
        listing_id: listing.id,
        address: data.address,
        lat: data.lat,
        lng: data.lng
      });
      if (locError) {
        console.error("[EV-Net] Failed to insert listing location:", locError);
        // We don't throw here to avoid blocking the whole flow, but we log it.
      } else {
        console.log("[EV-Net] listingService.create: Location inserted.");
      }
    }

    // 3. Upload and insert photos
    if (data.images && data.images.length > 0) {
      console.log(`[EV-Net] listingService.create: Starting upload for ${data.images.length} photos...`);
      const uploadedPaths = await Promise.all(data.images.map(async (image, index) => {
        const file = image?.file || image;
        if (typeof file === 'string') return file;

        const extension = file.name?.split('.').pop() || 'jpg';
        const filePath = `${data.hostId}/${listing.id}/${Date.now()}_${index}.${extension}`;
        
        console.log(`[EV-Net] Uploading photo ${index + 1} to 'listing_photos' bucket at: ${filePath}`);
        const { error: uploadError } = await supabase.storage
          .from('listing_photos')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'image/jpeg'
          });

        if (uploadError) {
          console.error(`[EV-Net] Error uploading photo ${index + 1}:`, uploadError);
          throw uploadError;
        }
        console.log(`[EV-Net] Photo ${index + 1} uploaded successfully.`);
        return filePath;
      }));

      console.log("[EV-Net] listingService.create: Inserting photo metadata rows...");
      const photoRows = uploadedPaths.map((path, index) => ({
        listing_id: listing.id,
        storage_path: path,
        display_order: index
      }));
      const { error: photoError } = await supabase.from('listing_photos').insert(photoRows);
      if (photoError) {
        console.error("[EV-Net] Failed to insert listing photos metadata:", photoError);
        throw photoError;
      }
      console.log("[EV-Net] listingService.create: Photos metadata inserted.");
    }

    return listing;
  },

  async getOwnedById(listingId, hostId) {
    if (!listingId || !hostId) return null;

    const { data, error } = await supabase
      .from('listings')
      .select('*, listing_photos ( id, storage_path, display_order )')
      .eq('id', listingId)
      .eq('host_id', hostId)
      .maybeSingle();

    if (error) {
      console.warn("[EV-Net] listingService.getOwnedById failed:", error.message);
      return null;
    }

    if (!data) return null;
    return {
      ...data,
      priceDay: data.price_day_per_kwh,
      priceNight: data.price_night_per_kwh,
      chargerType: data.charger_type,
      chargerSpeed: data.charger_speed,
      hostId: data.host_id,
      isActive: data.is_active,
      isApproved: data.is_approved,
      setupFeePaid: data.setup_fee_paid,
      images: (data.listing_photos || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(p => resolveListingPhotoUrl(p.storage_path))
    };
  },

  async getHostOnboardingListing(hostId, preferredListingId = null) {
    if (!hostId) return null;

    let listing = null;
    if (preferredListingId) {
      listing = await this.getOwnedById(preferredListingId, hostId);
    }

    if (!listing) {
      const { data, error } = await supabase
        .from('listings')
        .select('*, listing_photos ( id, storage_path, display_order )')
        .eq('host_id', hostId)
        .order('is_approved', { ascending: true })
        .order('setup_fee_paid', { ascending: false })
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn("[EV-Net] Could not load host onboarding listing:", error.message);
        return null;
      }

      const row = data?.[0];
      if (row) {
        listing = {
          ...row,
          priceDay: row.price_day_per_kwh,
          priceNight: row.price_night_per_kwh,
          chargerType: row.charger_type,
          chargerSpeed: row.charger_speed,
          hostId: row.host_id,
          isActive: row.is_active,
          isApproved: row.is_approved,
          setupFeePaid: row.setup_fee_paid,
          images: (row.listing_photos || [])
            .sort((a, b) => a.display_order - b.display_order)
            .map(p => resolveListingPhotoUrl(p.storage_path))
        };
      }
    }

    if (!listing?.id) return null;

    const [{ data: location }, { data: availability }] = await Promise.all([
      supabase
        .from('listing_locations')
        .select('address, lat, lng')
        .eq('listing_id', listing.id)
        .maybeSingle(),
      supabase
        .from('availability_rules')
        .select('id, day_of_week, start_time, end_time')
        .eq('listing_id', listing.id)
    ]);

    return {
      ...listing,
      address: location?.address || listing.address || '',
      lat: location?.lat ?? listing.lat ?? null,
      lng: location?.lng ?? listing.lng ?? null,
      availability: (availability || []).map(rule => ({
        id: rule.id,
        dayOfWeek: rule.day_of_week,
        startTime: rule.start_time?.substring(0, 5),
        endTime: rule.end_time?.substring(0, 5),
      })),
    };
  },

  async findExistingOnboardingListing({ hostId, title, city, area, chargerType }) {
    console.log("[EV-Net] Checking for existing onboarding listing", {
      hostId,
      title,
      city,
      area,
      chargerType
    });

    let query = supabase
      .from('listings')
      .select('id, host_id, title, city, area, charger_type, is_active, is_approved, setup_fee_paid, created_at')
      .eq('host_id', hostId)
      .eq('is_approved', false);

    if (title) query = query.eq('title', title);
    if (city) query = query.eq('city', city);
    if (area) query = query.eq('area', area);
    if (chargerType) query = query.eq('charger_type', chargerType);

    const { data, error } = await query
      .order('setup_fee_paid', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error("[EV-Net] Error finding existing onboarding listing:", error);
      throw new Error(`Could not check for an existing listing: ${error.message}`);
    }

    return data?.[0] || null;
  },

  async findExistingDraft(hostId, title) {
    return this.findExistingOnboardingListing({ hostId, title });
  },

  async demoteDuplicateOnboardingListings({ hostId, keepId, title, city, area, chargerType }) {
    if (!hostId || !keepId) return { success: true, demoted: 0 };

    let query = supabase
      .from('listings')
      .select('id')
      .eq('host_id', hostId)
      .eq('is_approved', false)
      .neq('id', keepId);

    if (title) query = query.eq('title', title);
    if (city) query = query.eq('city', city);
    if (area) query = query.eq('area', area);
    if (chargerType) query = query.eq('charger_type', chargerType);

    const { data: duplicates, error: lookupError } = await query;
    if (lookupError) {
      console.warn("[EV-Net] Could not check duplicate onboarding listings:", lookupError.message);
      return { success: false, demoted: 0, error: lookupError.message };
    }

    const duplicateIds = (duplicates || []).map(row => row.id);
    if (duplicateIds.length === 0) return { success: true, demoted: 0 };

    console.warn("[EV-Net] Demoting duplicate onboarding listings:", duplicateIds);
    const { error } = await supabase
      .from('listings')
      .update({ setup_fee_paid: false, is_active: false, is_approved: false })
      .in('id', duplicateIds)
      .eq('host_id', hostId);

    if (error) {
      console.warn("[EV-Net] Could not demote duplicate onboarding listings:", error.message);
      return { success: false, demoted: 0, error: error.message };
    }

    return { success: true, demoted: duplicateIds.length };
  },

  async update(id, data) {
    const updates = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.city !== undefined) updates.city = data.city;
    if (data.area !== undefined) updates.area = data.area;
    if (data.chargerType !== undefined) updates.charger_type = data.chargerType;
    if (data.chargerSpeed !== undefined) updates.charger_speed = data.chargerSpeed;
    if (data.pricePerHour !== undefined) updates.price_per_hour = data.pricePerHour;
    if (data.priceDay !== undefined) updates.price_day_per_kwh = data.priceDay;
    if (data.priceNight !== undefined) updates.price_night_per_kwh = data.priceNight;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.isApproved !== undefined) updates.is_approved = data.isApproved;
    if (data.setupFeePaid !== undefined) updates.setup_fee_paid = data.setupFeePaid;
    if (data.amenities !== undefined) updates.amenities = data.amenities;
    if (data.houseRules !== undefined) updates.house_rules = data.houseRules;

    const { data: listing, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!listing) {
      throw new Error('Listing could not be updated. It may no longer exist or you may not have access.');
    }

    if (data.address && data.lat && data.lng) {
      const locationPayload = {
        listing_id: id,
        address: data.address,
        lat: data.lat,
        lng: data.lng
      };

      const { data: existingLocation, error: lookupError } = await supabase
        .from('listing_locations')
        .select('listing_id')
        .eq('listing_id', id)
        .maybeSingle();

      if (lookupError) {
        console.warn("[EV-Net] Could not check existing listing location:", lookupError.message);
      } else if (existingLocation) {
        const { error: locError } = await supabase
          .from('listing_locations')
          .update({ address: data.address, lat: data.lat, lng: data.lng })
          .eq('listing_id', id);
        if (locError) console.warn("[EV-Net] Could not update listing location:", locError.message);
      } else {
        const { error: locError } = await supabase
          .from('listing_locations')
          .insert(locationPayload);
        if (locError) console.warn("[EV-Net] Could not insert listing location:", locError.message);
      }
    }

    return listing;
  },

  async uploadListingPhotos(listingId, hostId, files) {
    const uploadableFiles = (files || []).filter(file => isUploadableFile(file));
    if (uploadableFiles.length === 0) return [];
    
    // 1. Get current max display order
    const { data: currentPhotos } = await supabase
      .from('listing_photos')
      .select('display_order')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: false })
      .limit(1);
    
    let nextOrder = currentPhotos && currentPhotos.length > 0 ? currentPhotos[0].display_order + 1 : 0;

    // 2. Upload files
    const uploadedPaths = await Promise.all(uploadableFiles.map(async (image, index) => {
      const file = image?.file || image;
      const extension = file.name?.split('.').pop() || 'jpg';
      const filePath = `${hostId}/${listingId}/${Date.now()}_added_${index}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('listing_photos')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });

      if (uploadError) throw uploadError;
      return filePath;
    }));

    // 3. Insert rows
    const photoRows = uploadedPaths.map((path, index) => ({
      listing_id: listingId,
      storage_path: path,
      display_order: nextOrder + index
    }));
    
    const { data, error } = await supabase.from('listing_photos').insert(photoRows).select();
    if (error) throw error;
    return data;
  },

  async ensureOnboardingPhotos(listingId, hostId, files) {
    const uploadableFiles = (files || []).filter(file => isUploadableFile(file));
    if ((!files || files.length === 0) && uploadableFiles.length === 0) {
      throw new Error('At least one charger setup photo is required.');
    }

    const { data: existingPhotos, error: existingError } = await supabase
      .from('listing_photos')
      .select('id, storage_path, display_order')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true });

    if (existingError) {
      throw new Error(`Could not check existing listing photos: ${existingError.message}`);
    }

    if ((existingPhotos || []).length > 0 && uploadableFiles.length === 0) {
      console.log("[EV-Net] Skipping duplicate photo upload", {
        listingId,
        count: existingPhotos.length
      });
      return existingPhotos;
    }

    if ((existingPhotos || []).length === 0 && uploadableFiles.length === 0) {
      throw new Error('At least one charger setup photo is required.');
    }

    return this.uploadListingPhotos(listingId, hostId, uploadableFiles);
  },

  async markOnboardingSubmitted(listingId, hostId, options = {}) {
    console.log("[EV-Net] Marking onboarding listing pending review:", listingId);
    const setupFeePaid = options.setupFeePaid ?? true;
    const { data, error } = await supabase
      .from('listings')
      .update({
        setup_fee_paid: setupFeePaid,
        is_active: false,
        is_approved: false
      })
      .eq('id', listingId)
      .eq('host_id', hostId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[EV-Net] Could not mark listing pending review:", error);
      throw new Error(`Could not mark listing pending review: ${error.message}`);
    }

    if (!data) {
      throw new Error('Could not mark listing pending review: listing was not found for this host.');
    }

    return data;
  },

  async deleteListingPhoto(photoId) {
    // 1. Get photo to find storage path
    const { data: photo } = await supabase.from('listing_photos').select('storage_path').eq('id', photoId).single();
    if (photo) {
      // 2. Delete from storage
      await supabase.storage.from('listing_photos').remove([photo.storage_path]);
    }
    // 3. Delete row
    const { error } = await supabase.from('listing_photos').delete().eq('id', photoId);
    if (error) throw error;
    return { success: true };
  },

  async delete(id) {
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async getByHost(hostId) {
    const { data, error } = await supabase
      .from('listings')
      .select('*, listing_photos ( id, storage_path, display_order )')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(l => ({
      ...l,
      images: (l.listing_photos || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(p => resolveListingPhotoUrl(p.storage_path)),
      pricePerHour: l.price_per_hour,
      priceDay: l.price_day_per_kwh,
      priceNight: l.price_night_per_kwh,
      hostId: l.host_id,
      isActive: l.is_active,
      isApproved: l.is_approved,
      setupFeePaid: l.setup_fee_paid,
      chargerType: l.charger_type,
      chargerSpeed: l.charger_speed,
      reviewCount: l.review_count,
      sessionsCompleted: l.sessions_completed,
      createdAt: l.created_at,
    }));
  },
};

// ─── FAVORITE SERVICE ───────────────────────────────────

export const favoriteService = {
  async getAll() {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) return [];

    const { data, error } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', userData.user.id);
    
    if (error) throw error;
    return data ? data.map(f => f.listing_id) : [];
  },

  async toggle(listingId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Must be logged in to favorite");

    // Check if exists
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { isFavorited: false };
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listingId });
      if (error) throw error;
      return { isFavorited: true };
    }
  },

  async isFavorited(listingId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', listingId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }
};

// ─── AVAILABILITY SERVICE (PHASE 2) ─────────────────────

export const availabilityService = {
  async getByListing(listingId) {
    const { data, error } = await supabase
      .from('availability_rules')
      .select('*')
      .eq('listing_id', listingId);
    if (error) throw error;
    // Map to frontend shape
    return data.map(a => ({
      id: a.id,
      listingId: a.listing_id,
      dayOfWeek: a.day_of_week,
      startTime: a.start_time.substring(0, 5), // "09:00:00" -> "09:00"
      endTime: a.end_time.substring(0, 5),
    }));
  },

  async set(listingId, schedules) {
    // Requires transaction or sequential deletes, but simplest for now:
    const { error: delError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('listing_id', listingId);
    if (delError) throw delError;

    if (schedules.length === 0) return [];

    const rows = schedules.map(s => ({
      listing_id: listingId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime + ':00',
      end_time: s.endTime + ':00',
    }));

    const { data, error } = await supabase
      .from('availability_rules')
      .insert(rows)
      .select();
    if (error) throw error;
    return data;
  },

  async generateSlots(listingId, dateStr) {
    // Use the RPC for accurate robust slot generation if complex, 
    // or fallback to mock locally since generating unbooked slots 
    // is computationally light. We will leave it calling mock for now 
    // unless we need complex timezones.
    // For now, implementing basic local generation here:
    const dayOfWeek = new Date(dateStr).getDay();
    const rules = await this.getByListing(listingId);
    const dayAvail = rules.filter(r => r.dayOfWeek === dayOfWeek);
    
    if (dayAvail.length === 0) return [];

    // Pull bookings for that date
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('listing_id', listingId)
      .eq('date', dateStr)
      .neq('status', 'CANCELLED');

    const slots = [];
    dayAvail.forEach(a => {
      const startHour = parseInt(a.startTime.split(':')[0]);
      const endHour = parseInt(a.endTime.split(':')[0]);
      for (let h = startHour; h < endHour; h++) {
        const slotStart = `${String(h).padStart(2, '0')}:00`;
        const slotEnd = `${String(h + 1).padStart(2, '0')}:00`;
        
        // Simple overlap check
        const isBooked = bookings?.some(b => 
          b.start_time.substring(0,5) <= slotStart && 
          b.end_time.substring(0,5) > slotStart
        );
        
        slots.push({
          id: `slot_${listingId}_${dateStr}_${h}`,
          listingId,
          date: dateStr,
          startTime: slotStart,
          endTime: slotEnd,
          isBooked: !!isBooked
        });
      }
    });

    return slots;
  }
};

// ─── BOOKING SERVICE (PHASE 2 RPC) ──────────────────────

export const bookingService = {
  async create(data) {
    // Calls the robust transaction-safe RPC
    // Note: Backend handles pricing_band derivation and fee calculation
    const { data: rpcBooking, error } = await supabase.rpc('create_booking', {
      p_listing_id: data.listingId,
      p_date: data.date,
      p_start_time: data.startTime + ':00',
      p_end_time: data.endTime + ':00',
      p_vehicle_size: data.vehicleSize
    });
    
    if (error) throw new Error(error.message);

    let booking = Array.isArray(rpcBooking) ? rpcBooking[0] : rpcBooking;
    if (booking && typeof booking !== 'object') {
      const { data: fetchedBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking)
        .single();
      if (fetchError) throw fetchError;
      booking = fetchedBooking;
    }

    if (!booking?.id) {
      throw new Error('Booking RPC completed but did not return a booking row.');
    }
    
    const result = {
      ...booking,
      listingId: booking.listing_id,
      startTime: booking.start_time.substring(0, 5),
      endTime: booking.end_time.substring(0, 5),
      // Map new fee fields
      baseFee: booking.base_fee,
      userServiceFee: booking.user_service_fee,
      hostPlatformFee: booking.host_platform_fee,
      gatewayFee: booking.gateway_fee,
      userTotal: booking.total_user_price ?? booking.total_fee,
      hostPayout: booking.host_payout,
      estimatedKwh: booking.estimated_kwh,
      pricingBand: booking.pricing_band,
      createdAt: booking.created_at,
    };

    // Notification Triggers
    try {
      const { data: listing } = await supabase.from('listings').select('title, host_id').eq('id', booking.listing_id).single();
      if (listing) {
        // To User
        await notificationService.create(booking.user_id, 'BOOKING_SUBMITTED', `Booking submitted for ${listing.title}. Waiting for host confirmation.`);
        // To Host
        await notificationService.create(listing.host_id, 'NEW_BOOKING_REQUEST', `New booking request for ${listing.title}.`);
      }
    } catch (err) {
      console.warn('[EV-Net] Failed to create booking notifications:', err);
    }

    return result;
  },

  async getByUser(userId) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        listing:listings ( id, title, area, city, images:listing_photos ( storage_path ) )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    
    return (data || []).map(b => ({
      ...b,
      listingId: b.listing_id,
      userId: b.user_id,
      listing: b.listing ? {
        ...b.listing,
        images: (b.listing.images || []).map(p => resolveListingPhotoUrl(p.storage_path))
      } : null,
      startTime: b.start_time.substring(0, 5),
      endTime: b.end_time.substring(0, 5),
      // New fee model fields
      baseFee: b.base_fee,
      userServiceFee: b.user_service_fee,
      userTotal: b.total_user_price ?? b.total_fee,
      pricingBand: b.pricing_band,
      estimatedKwh: b.estimated_kwh,
      hostPayout: b.host_payout,
      createdAt: b.created_at,
    }));
  },

  async getByHost(hostId) {
    // Note: RLS ensures users can only read bookings tied to their own listings
    const { data, error } = await supabase
      .from('bookings')
      .select('*, listing:listings!inner(*), user:profiles!user_id(*)')
      .eq('listing.host_id', hostId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(b => ({
      ...b,
      listingId: b.listing_id,
      userId: b.user_id,
      startTime: b.start_time.substring(0, 5),
      endTime: b.end_time.substring(0, 5),
      // New fee model fields
      baseFee: b.base_fee,
      userServiceFee: b.user_service_fee,
      hostPlatformFee: b.host_platform_fee,
      gatewayFee: b.gateway_fee,
      userTotal: b.total_user_price ?? b.total_fee,
      hostPayout: b.host_payout,
      pricingBand: b.pricing_band,
      estimatedKwh: b.estimated_kwh,
      createdAt: b.created_at,
    }));
  },

  async updateStatus(bookingId, status) {
    // In a prod app, this might also be an RPC (e.g. host can't cancel a completed booking).
    // For now, relies on Edge Function service_role or basic update.
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) throw error;

    // Notification Trigger
    try {
      const { data: b } = await supabase.from('bookings').select('*, listings(title)').eq('id', bookingId).single();
      if (b) {
        const msg = status === 'CONFIRMED' 
          ? `Your booking for ${b.listings.title} has been confirmed!`
          : `Your booking for ${b.listings.title} is now ${status.toLowerCase()}.`;
        await notificationService.create(b.user_id, 'BOOKING_STATUS_UPDATE', msg);
      }
    } catch (err) {
      console.warn('[EV-Net] Failed to create status notification:', err);
    }

    return data;
  }
};

// ─── MESSAGING SERVICE (PHASE 3 RPCs) ───────────────────

export const messagingService = {
  async getConversations(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        listing:listings(*),
        user:profiles!user_id(
          *,
          ev_profiles:ev_profiles!user_id ( avatar_path ),
          host_profiles:host_profiles!user_id ( avatar_path )
        ),
        host:profiles!host_id(
          *,
          ev_profiles:ev_profiles!user_id ( avatar_path ),
          host_profiles:host_profiles!user_id ( avatar_path )
        ),
        messages(id, content, created_at, type, sender_id, is_read)
      `)
      .or(`user_id.eq.${userId},host_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    
    return data.map(c => {
      // Sort embedded messages to find lastMessage
      const sortedMsgs = (c.messages || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      const isUser = c.user_id === userId;
      
      return {
        ...c,
        listingId: c.listing_id,
        userId: c.user_id,
        hostId: c.host_id,
        messageCount: c.message_count,
        extensionRequested: c.extension_requested,
        extensionApproved: c.extension_approved,
        extensionLimit: c.extension_limit,
        extensionCount: c.extension_count,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        listing: c.listing,
        // map 'user' to be the OTHER party for UI display logic
        user: (() => {
          const party = isUser ? c.host : c.user;
          if (!party) return null;
          return {
            ...party,
            avatar: resolveAvatarUrl(party.ev_profiles?.[0]?.avatar_path || party.host_profiles?.[0]?.avatar_path) || party.avatar_url
          };
        })(),
        lastMessage: sortedMsgs.length > 0 ? {
          ...sortedMsgs[0],
          createdAt: sortedMsgs[0].created_at,
          senderId: sortedMsgs[0].sender_id
        } : null
      };
    }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  async getMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;

    return data.map(m => ({
      ...m,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      isRead: m.is_read,
      createdAt: m.created_at
    }));
  },

  async createOrGetInquiry(listingId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please log in to message the host.');

    console.log('[EV-Net] Starting conversation for listing:', listingId);

    const { data: existingInquiry, error: existingInquiryError } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', user.id)
      .eq('type', 'INQUIRY')
      .maybeSingle();

    if (existingInquiryError) {
      console.warn('[EV-Net] Could not check existing inquiry before RPC:', existingInquiryError.message);
    }

    // Try new robust name first, then previous names
    let rpcResponse = await supabase.rpc('initialize_inquiry', {
      p_listing_id: listingId
    });

    if (rpcResponse.error && ['PGRST202', 'PGRST203', '42883'].includes(rpcResponse.error.code)) {
      console.warn('[EV-Net] initialize_inquiry failed, falling back to start_conversation_with_host');
      rpcResponse = await supabase.rpc('start_conversation_with_host', {
        p_listing_id: listingId
      });
    }

    if (rpcResponse.error && ['PGRST202', 'PGRST203', '42883'].includes(rpcResponse.error.code)) {
      console.warn('[EV-Net] start_conversation_with_host failed, falling back to create_or_get_inquiry');
      rpcResponse = await supabase.rpc('create_or_get_inquiry', {
        p_listing_id: listingId
      });
    }

    if (rpcResponse.error) {
      console.error('[EV-Net] RPC Error:', rpcResponse.error);
      const message = rpcResponse.error.message || 'Unable to start conversation.';
      if (message.toLowerCase().includes('own listing')) {
        throw new Error('You cannot message yourself as the host of this listing.');
      }
      throw new Error(`${message} Please try again.`);
    }

    const rpcData = Array.isArray(rpcResponse.data) ? rpcResponse.data[0] : rpcResponse.data;
    const conversationId = typeof rpcData === 'string' ? rpcData : rpcData?.id;

    if (!conversationId) {
      throw new Error('Conversation could not be opened. Please try again.');
    }

    const { data: created, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!created) throw new Error('Conversation was created but could not be loaded.');
    
    // Notification Trigger for new inquiry
    try {
      if (!existingInquiry?.id) {
        const { data: list } = await supabase.from('listings').select('title, host_id').eq('id', listingId).single();
        await safeSendNotification(
          list?.host_id,
          'MESSAGE',
          `You have a new inquiry about ${list?.title || 'your listing'}.`,
          { conversationId, listingId }
        );
      }
    } catch (err) {
      console.warn('[EV-Net] Failed to notify host of new inquiry:', err);
    }

    return {
      ...created,
      listingId: created.listing_id,
      userId: created.user_id,
      hostId: created.host_id,
    };
  },

  async sendMessage(conversationId, senderId, content) {
    const { data: rpcMessage, error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_content: content
    });

    if (error) throw new Error(error.message);

    const data = Array.isArray(rpcMessage) ? rpcMessage[0] : rpcMessage;
    if (!data?.id) throw new Error('Message could not be sent. Please try again.');

    // Notification Trigger: notify the OTHER party
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('user_id, host_id, listing:listings(title)')
        .eq('id', conversationId)
        .single();
      if (conv) {
        const recipientId = senderId === conv.user_id ? conv.host_id : conv.user_id;
        const listingTitle = conv.listing?.title || 'a listing';
        await safeSendNotification(
          recipientId,
          'MESSAGE',
          `You have a new message regarding ${listingTitle}.`,
          { conversationId }
        );
      }
    } catch (err) {
      console.warn('[EV-Net] Failed to create message notification:', err);
    }

    return {
      ...data,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      createdAt: data.created_at
    };
  },

  async requestExtension(conversationId) {
    const { data, error } = await supabase.rpc('request_extension', {
      p_conversation_id: conversationId
    });
    if (error) throw new Error(error.message);
    const c = data[0];
    return { ...c, extensionRequested: c.extension_requested };
  },

  async approveExtension(conversationId) {
    const { data, error } = await supabase.rpc('approve_extension', {
      p_conversation_id: conversationId
    });
    if (error) throw new Error(error.message);
    const c = data[0];
    return { ...c, extensionApproved: c.extension_approved };
  },

  // Added Realtime Subscription exclusively for messaging
  subscribeToMessages(conversationId, callback) {
    const channel = supabase
      .channel(`room:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new;
          callback({
            ...m,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            isRead: m.is_read,
            createdAt: m.created_at
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }
};

// ─── ADMIN SERVICE (PHASE 4 RPCs & VIEWS) ───────────────

export const adminService = {
  async getDashboard() {
    // In prod, this would be a dedicated RPC 'get_admin_dashboard_stats' to avoid mass roundtrips.
    // Simplifying with basic parallel queries for now since Admin Dashboard load is infrequent.
    const [
      { count: totalUsers },
      { count: totalListings },
      { count: activeListings },
      { count: totalBookings },
      { data: completedBookings }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_approved', true),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('service_fee').eq('status', 'COMPLETED')
    ]);

    const totalRevenue = (completedBookings || []).reduce((s, b) => s + b.service_fee, 0);

    // 1. Pending Verifications (live profile state is the source of truth)
    const [{ count: pendingEvCount }, { count: pendingHostCount }] = await Promise.all([
      supabase
        .from('ev_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'under_review'),
      supabase
        .from('host_profiles')
        .select('*', { count: 'exact', head: true })
        .in('verification_status', ['pending', 'under_review'])
    ]);

    // 2. Pending Payments
    const { count: pendingPayments } = await supabase
      .from('onboarding_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 3. Unique Hosts Count
    const { count: totalHosts } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'HOST');

    return {
      totalUsers: totalUsers || 0,
      totalHosts: totalHosts || 0,
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      pendingEvVerifications: pendingEvCount || 0,
      pendingHostVerifications: pendingHostCount || 0,
      pendingPayments: pendingPayments || 0,
      totalBookings: totalBookings || 0,
      totalRevenue
    };
  },

  async getListings() {
    const { data, error } = await supabase
      .from('listings')
      .select('*, host:profiles!host_id(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(l => ({ ...l, hostId: l.host_id, isApproved: l.is_approved, isActive: l.is_active, createdAt: l.created_at }));
  },

  async getUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, hostProfile:host_profiles(*), evProfile:ev_profiles(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(u => {
      const evProfile = u.evProfile?.[0] || null;
      const hostProfile = u.hostProfile?.[0] || null;
      return {
        ...u,
        createdAt: u.created_at,
        hostProfile,
        evProfile,
        avatar: resolveAvatarUrl(evProfile?.avatar_path || hostProfile?.avatar_path) || u.avatar_url
      };
    });
  },

  async getBookings() {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, listing:listings(*), user:profiles!user_id(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(b => ({ ...b, createdAt: b.created_at, baseFee: b.base_fee, serviceFee: b.service_fee, totalFee: b.total_fee }));
  },

  async reviewListing(listingId, decision) {
    const { error } = await supabase.rpc('admin_review_listing', {
      p_listing_id: listingId,
      p_approved: decision.approved,
      p_notes: decision.notes || ''
    });
    if (error) throw new Error(error.message);
    
    // refetch updated listing
    const { data } = await supabase.from('listings').select('*, host_id').eq('id', listingId).single();

    // Notification → Host
    if (data?.host_id) {
      const msg = decision.approved
        ? `Your listing "${data.title}" has been approved and is now live!`
        : `Your listing "${data.title}" was not approved. ${decision.notes || 'Please review and resubmit.'}`;
      await safeSendNotification(data.host_id, 'VERIFICATION', msg);
    }

    return { ...data, isApproved: data.is_approved, isActive: data.is_active };
  },

  async verifyHost(userId, decision) {
    console.log("[EV-Net] Admin approve/reject started", {
      target: 'HOST',
      userId,
      approved: decision.approved
    });
    const { data, error } = await withOperationTimeout(
      supabase.rpc('admin_verify_host_v2', {
        p_approved: decision.approved,
        p_notes: decision.notes || '',
        p_user_id: userId
      }),
      15000,
      'Admin host review timed out. Please retry from the queue.'
    );
    console.log("[EV-Net] admin_verify_host_v2 response:", { data, error });
    if (error) throw new Error(error.message);

    // Notification → Host
    const msg = decision.approved
      ? 'Your host verification has been approved! You can now receive bookings.'
      : `Your host verification was rejected. ${decision.notes || 'Please review and resubmit your documents.'}`;
    await safeSendNotification(userId, 'VERIFICATION', msg);

    console.log("[EV-Net] Admin decision complete", { target: 'HOST', userId });
    return { success: true };
  },

  async verifyUser(userId, decision) {
    console.log("[EV-Net] Admin approve/reject started", {
      target: 'EV_USER',
      userId,
      approved: decision.approved
    });
    const { data, error } = await withOperationTimeout(
      supabase.rpc('admin_verify_user_v2', {
        p_approved: decision.approved,
        p_notes: decision.notes || '',
        p_user_id: userId
      }),
      15000,
      'Admin user review timed out. Please retry from the queue.'
    );
    console.log("[EV-Net] admin_verify_user_v2 response:", { data, error });
    if (error) throw new Error(error.message);

    // Notification → EV User
    const msg = decision.approved
      ? 'Your verification has been approved! You can now book EV chargers on EV-Net.'
      : `Your verification was rejected. ${decision.notes || 'Please review and resubmit your documents.'}`;
    await safeSendNotification(userId, 'VERIFICATION', msg);

    console.log("[EV-Net] Admin decision complete", { target: 'EV_USER', userId });
    return { success: true };
  },

  async getVerificationSubmissions() {
    let { data, error } = await supabase
      .from('verification_submissions')
      .select('*, user:profiles!user_id(*, ev_profiles(*), host_profiles(*))')
      .order('submitted_at', { ascending: false });
    
    if (error) {
      console.warn('[EV-Net] Verification submissions profile join failed; retrying without join:', error.message);
      const fallback = await supabase
        .from('verification_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (fallback.error) throw fallback.error;
      data = fallback.data || [];

      const userIds = [...new Set(data.map(row => row.user_id).filter(Boolean))];
      const { data: users, error: usersError } = userIds.length > 0
        ? await supabase.from('profiles').select('*, ev_profiles:ev_profiles!user_id(verification_status, updated_at), host_profiles:host_profiles!user_id(verification_status, moderation_notes, updated_at)').in('id', userIds)
        : { data: [], error: null };

      if (usersError) {
        console.warn('[EV-Net] Could not hydrate verification users:', usersError.message);
      }

      const usersById = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      data = data.map(row => ({ ...row, user: usersById[row.user_id] || null }));
    }
    
    const grouped = (data || []).reduce((acc, s) => {
      const rawType = (s.type || s.profile_type || '').toUpperCase();
      if (!['EV_USER', 'HOST', 'USER'].includes(rawType)) return acc;
      const profileType = rawType === 'HOST' ? 'HOST' : 'EV_USER';

      const key = `${s.user_id}_${profileType}`;
      if (!acc[key]) {
        const u = s.user || {}; const evProfile = (Array.isArray(u.ev_profiles) ? u.ev_profiles[0] : u.ev_profiles) || (Array.isArray(s.ev_profiles) ? s.ev_profiles[0] : s.ev_profiles);
        const hostProfile = (Array.isArray(u.host_profiles) ? u.host_profiles[0] : u.host_profiles) || (Array.isArray(s.host_profiles) ? s.host_profiles[0] : s.host_profiles);
        
        acc[key] = {
          ...s,
          user: s.user ? {
            ...s.user,
            avatar: s.user.avatar_url
          } : null,
          profile_type: profileType,
          type: profileType,
          status: (s.status || 'pending').toLowerCase(),
          submittedAt: s.submitted_at,
          documentRows: [],
          evProfileStatus: evProfile?.verification_status || null,
          hostProfileStatus: hostProfile?.verification_status || null,
          moderationNotes: profileType === 'HOST' ? hostProfile?.moderation_notes : null,
          profileUpdatedAt: profileType === 'HOST' ? hostProfile?.updated_at : evProfile?.updated_at,
          reviewedAt: s.reviewed_at || (profileType === 'HOST' ? hostProfile?.updated_at : evProfile?.updated_at)
        };
      }

      mergeDocumentPath(acc[key], s, 'cnic_path', 'CNIC_FRONT');
      mergeDocumentPath(acc[key], s, 'cnic_back_path', 'CNIC_BACK');
      mergeDocumentPath(acc[key], s, 'ev_proof_path', 'EV_PROOF');
      mergeDocumentPath(acc[key], s, 'property_proof_path', 'PROPERTY_PROOF');
      mergeDocumentPath(acc[key], s, 'charger_proof_path', 'CHARGER_PROOF');
      acc[key].documentRows.push(s);

      if (s.status?.toLowerCase() === 'pending' || s.status?.toLowerCase() === 'under_review') acc[key].status = 'pending';
      if (new Date(s.submitted_at) > new Date(acc[key].submittedAt)) {
        acc[key].submittedAt = s.submitted_at;
      }
      return acc;
    }, {});
    
    return Promise.all(Object.values(grouped).map(async submission => {
      // Profile status is the absolute source of truth for the verification lifecycle
      let finalStatus = (submission.status || 'pending').toLowerCase();
      const profileStatus = (submission.profile_type === 'HOST' ? submission.hostProfileStatus : submission.evProfileStatus);
      
      if (profileStatus) {
        finalStatus = profileStatus.toLowerCase();
      }

      const reviewedAt = submission.reviewed_at || submission.reviewedAt || submission.profileUpdatedAt || null;
      const notes = submission.moderationNotes || submission.reviewer_notes || submission.admin_notes || '';

      if (submission.profile_type === 'EV_USER') {
        console.log('[EV-Net] admin normalized EV submission', {
          email: submission.user?.email,
          evProfileStatus: submission.evProfileStatus,
          documentStatuses: submission.documentRows.map(dr => dr.status),
          finalStatus
        });
      }

      return {
        ...submission,
        status: finalStatus,
        currentStatus: finalStatus,
        moderationNotes: notes,
        admin_notes: submission.admin_notes || notes,
        reviewer_notes: submission.reviewer_notes || notes,
        reviewed_at: reviewedAt,
        reviewedAt,
        documentUrls: {
          cnic_path: await createVerificationSignedUrl(submission.cnic_path),
          cnic_back_path: await createVerificationSignedUrl(submission.cnic_back_path),
          ev_proof_path: await createVerificationSignedUrl(submission.ev_proof_path),
          property_proof_path: await createVerificationSignedUrl(submission.property_proof_path),
          charger_proof_path: await createVerificationSignedUrl(submission.charger_proof_path)
        }
      };
    }));
  },

  async getConversations() {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *, 
        listing:listings(*), 
        user:profiles!user_id(
          *,
          ev_profiles:ev_profiles!user_id ( avatar_path ),
          host_profiles:host_profiles!user_id ( avatar_path )
        ), 
        host:profiles!host_id(
          *,
          ev_profiles:ev_profiles!user_id ( avatar_path ),
          host_profiles:host_profiles!user_id ( avatar_path )
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(c => ({
      ...c,
      userId: c.user_id,
      hostId: c.host_id,
      listingId: c.listing_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      user: c.user ? {
        ...c.user,
        avatar: resolveAvatarUrl(c.user.ev_profiles?.[0]?.avatar_path || c.user.host_profiles?.[0]?.avatar_path) || c.user.avatar_url
      } : null,
      host: c.host ? {
        ...c.host,
        avatar: resolveAvatarUrl(c.host.ev_profiles?.[0]?.avatar_path || c.host.host_profiles?.[0]?.avatar_path) || c.host.avatar_url
      } : null,
    }));
  },

  async moderateConversation(conversationId, action) {
    // simplified implementation of moderation action -> DB insert
    const { data: admin } = await getAuthenticatedUser();
    
    const { data: conv, error: fetchErr } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
    if (fetchErr) throw fetchErr;

    if (action === 'CLOSE_THREAD') {
      await supabase.from('conversations').update({ status: 'CLOSED' }).eq('id', conversationId);
    } else if (action === 'RESTRICT_INQUIRY') {
      await supabase.from('ev_profiles').update({ is_restricted_from_inquiry: true }).eq('user_id', conv.user_id);
    } else if (action === 'SUSPEND_ACCOUNT') {
      await supabase.from('profiles').update({ is_suspended: true }).eq('id', conv.user_id);
    }
    
    // Log explicit moderation review
    await supabase.from('moderation_reviews').insert({
      target_type: 'CONVERSATION',
      target_id: conversationId,
      admin_id: admin.user.id,
      action: action,
      notes: 'Admin executed quick action directly from dashboard.'
    });

    return { success: true };
  },

  async getOnboardingPayments() {
    return onboardingPaymentService.getAllSubmissions();
  },

  async verifyOnboardingPayment(paymentId, approved, notes) {
    return onboardingPaymentService.verifyPayment(paymentId, approved, notes);
  }
};

// ─── ONBOARDING PAYMENT SERVICE ─────────────────────────

async function markHostPaymentSetupComplete(userId, listingId = null) {
  let query = supabase
    .from('listings')
    .update({ setup_fee_paid: true, is_active: false, is_approved: false })
    .eq('host_id', userId);

  if (listingId) query = query.eq('id', listingId);

  const { error: listingError } = await query;
  if (listingError) throw listingError;
}

function mapPaymentStatus(status) {
  if (status === 'verified') return 'approved';
  if (status === 'failed') return 'rejected';
  return status || 'pending';
}

export const onboardingPaymentService = {
  async submitPayment(userId, data) {
    console.log("[EV-Net] onboardingPaymentService.submitPayment: Initializing...", data.method);
    if (!userId) throw new Error('User session is required before submitting payment.');
    if (!data?.listingId) throw new Error('Listing ID is required before submitting payment proof.');
    if (data.method !== 'BANK_TRANSFER') {
      throw new Error('Pay Online is coming soon. Please use Bank Transfer for this beta.');
    }

    const existingPayment = await this.getExistingPayment(userId, data.listingId);
    let screenshotPath = existingPayment?.screenshot_path || null;
    
    // 1. Upload screenshot if bank transfer
    if (data.method === 'BANK_TRANSFER' && data.screenshot) {
      console.log("[EV-Net] Uploading payment proof");
      const screenshotFile = data.screenshot?.file || data.screenshot;
      const isAllowedProof = screenshotFile?.type?.startsWith('image/')
        || screenshotFile?.type === 'application/pdf'
        || screenshotFile?.name?.toLowerCase().endsWith('.pdf');

      if (!isAllowedProof) {
        throw new Error('Payment proof must be an image or PDF.');
      }

      const extension = screenshotFile.name?.split('.').pop() || 'png';
      const safeListingId = data.listingId || 'general';
      const fileName = `${safeListingId}_${Date.now()}.${extension}`;
      const filePath = `payments/${userId}/${fileName}`;
      
      console.log(`[EV-Net] onboardingPaymentService.submitPayment: Uploading screenshot to '${VERIFICATION_BUCKET}' at: ${filePath}`);
      const { error: uploadError } = await supabase.storage
        .from(VERIFICATION_BUCKET)
        .upload(filePath, screenshotFile, {
          upsert: true,
          contentType: screenshotFile.type || 'image/png'
        });
      
      if (uploadError) {
        console.error("[EV-Net] Error uploading payment screenshot:", uploadError);
        throw uploadError;
      }
      screenshotPath = filePath;
      console.log("[EV-Net] onboardingPaymentService.submitPayment: Screenshot uploaded.");
    }

    const paymentPayload = {
      user_id: userId,
      listing_id: data.listingId,
      amount: data.amount,
      method: data.method,
      screenshot_path: screenshotPath,
      status: 'pending'
    };

    if (existingPayment) {
      console.log("[EV-Net] onboardingPaymentService.submitPayment: Reusing existing payment:", existingPayment.id);
      console.log("[EV-Net] Updating existing payment proof");
      const { data: payment, error } = await supabase
        .from('onboarding_payments')
        .update({
          amount: paymentPayload.amount,
          method: paymentPayload.method,
          screenshot_path: paymentPayload.screenshot_path,
          status: 'pending',
          admin_notes: null
        })
        .eq('id', existingPayment.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[EV-Net] Error updating onboarding payment record:", error);
        throw new Error(`Could not update payment proof: ${error.message}`);
      }

      if (!payment?.id) {
        throw new Error('Could not update payment proof: payment record was not found. Please refresh and try again.');
      }

      console.log("[EV-Net] Payment record updated", payment.id);
      return { success: true, payment, reused: true };
    }

    console.log("[EV-Net] onboardingPaymentService.submitPayment: Inserting record into 'onboarding_payments' table...");
    let insertPayload = paymentPayload;
    let response = await supabase
      .from('onboarding_payments')
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (response.error && isMissingColumnError(response.error, 'listing_id')) {
      console.warn("[EV-Net] onboarding_payments.listing_id missing; retrying insert without listing_id. Run latest migrations.");
      const fallbackPayload = { ...paymentPayload };
      delete fallbackPayload.listing_id;
      insertPayload = fallbackPayload;
      response = await supabase
        .from('onboarding_payments')
        .insert(insertPayload)
        .select()
        .maybeSingle();
    }

    if (response.error) {
      if (response.error.code === '23505') {
        const latestPayment = await this.getExistingPayment(userId, data.listingId);
        if (latestPayment) {
          console.log("[EV-Net] Updating existing payment proof after unique conflict");
          const { data: payment, error: updateError } = await supabase
            .from('onboarding_payments')
            .update({
              amount: paymentPayload.amount,
              method: paymentPayload.method,
              screenshot_path: paymentPayload.screenshot_path,
              status: 'pending',
              admin_notes: null
            })
            .eq('id', latestPayment.id)
            .select()
            .maybeSingle();

          if (updateError) {
            throw new Error(`Could not update payment proof: ${updateError.message}`);
          }

          if (!payment?.id) {
            throw new Error('Could not update payment proof: payment record was not found. Please refresh and try again.');
          }

          return { success: true, payment, reused: true };
        }
      }
      console.error("[EV-Net] Error inserting onboarding payment record:", response.error);
      throw new Error(`Could not record payment proof: ${response.error.message}`);
    }

    if (!response.data?.id) {
      throw new Error('Could not record payment proof: no payment record was returned.');
    }

    console.log("[EV-Net] Payment record created", response.data?.id);
    return { success: true, payment: response.data, reused: false };
  },

  async getExistingPayment(userId, listingId = null) {
    console.log("[EV-Net] onboardingPaymentService.getExistingPayment: Checking for existing payment", { userId, listingId });
    let query = supabase
      .from('onboarding_payments')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'verified'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (listingId) query = query.eq('listing_id', listingId);

    let { data, error } = await query;

    if (error && listingId && isMissingColumnError(error, 'listing_id')) {
      console.warn("[EV-Net] onboarding_payments.listing_id missing; falling back to user-level payment lookup.");
      ({ data, error } = await supabase
        .from('onboarding_payments')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'verified'])
        .order('created_at', { ascending: false })
        .limit(1));
    }
    
    if (error) {
      console.error("[EV-Net] Error checking existing payment:", error);
      throw new Error(`Could not check existing payment: ${error.message}`);
    }
    return data?.[0] || null;
  },

  async getAllSubmissions() {
    let { data, error } = await supabase
      .from('onboarding_payments')
      .select(`
        *,
        user:profiles(id, name, email, avatar_url)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('[EV-Net] onboarding_payments table missing. Skipping payment queue.');
        return [];
      }
      console.warn('[EV-Net] Onboarding payments profile join failed; retrying without join:', error.message);
      const fallback = await supabase
        .from('onboarding_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallback.error) throw fallback.error;
      data = fallback.data || [];

      const userIds = [...new Set(data.map(row => row.user_id).filter(Boolean))];
      const { data: users, error: usersError } = userIds.length > 0
        ? await supabase.from('profiles').select('id, name, email, avatar_url').in('id', userIds)
        : { data: [], error: null };

      if (usersError) {
        console.warn('[EV-Net] Could not hydrate onboarding payment users:', usersError.message);
      }

      const usersById = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      data = data.map(row => ({ ...row, user: usersById[row.user_id] || null }));
    }

    return Promise.all((data || []).map(async payment => ({
      ...payment,
      status: mapPaymentStatus(payment.status),
      payment_status: payment.status,
      receiptUrl: await createVerificationSignedUrl(payment.screenshot_path),
      submittedAt: payment.created_at,
      reviewedAt: payment.verified_at,
      reviewed_at: payment.verified_at
    })));
  },

  async verifyPayment(paymentId, approved, notes) {
    let { data: payment, error: fetchError } = await supabase
      .from('onboarding_payments')
      .select('id, user_id, listing_id')
      .eq('id', paymentId)
      .single();

    if (fetchError && isMissingColumnError(fetchError, 'listing_id')) {
      ({ data: payment, error: fetchError } = await supabase
        .from('onboarding_payments')
        .select('id, user_id')
        .eq('id', paymentId)
        .single());
    }

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('onboarding_payments')
      .update({
        status: approved ? 'verified' : 'failed',
        admin_notes: notes,
        verified_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    if (error) throw error;

    if (approved) {
      await markHostPaymentSetupComplete(payment.user_id, payment.listing_id);
    }

    // Notification → Host
    const msg = approved
      ? 'Your onboarding payment has been verified! Your listing setup is now complete.'
      : `Your onboarding payment was not verified. ${notes || 'Please contact support.'}`;
    await safeSendNotification(payment.user_id, 'PAYMENT', msg);

    return { success: true };
  }
};

export const hostService = {
  async getDashboard(hostId) {
    // 1. Fetch Host sub-profile (for verification status)
    const hostProfileData = await getHostProfile(hostId);
    const verificationDocs = await getLatestVerificationDocuments(hostId, 'HOST');
    
    // 2. Fetch Listings
    const { data: listingsData, error: lError } = await supabase
      .from('listings')
      .select(`
        *,
        listing_photos ( id, storage_path, display_order )
      `)
      .eq('host_id', hostId);
    
    if (lError) throw lError;
    
    const listings = (listingsData || []).map(l => ({
      ...l,
      images: (l.listing_photos || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(p => resolveListingPhotoUrl(p.storage_path)),
      pricePerHour: l.price_per_hour,
      priceDay: l.price_day_per_kwh,
      priceNight: l.price_night_per_kwh,
      chargerType: l.charger_type,
      isActive: l.is_active,
      isApproved: l.is_approved,
      setupFeePaid: l.setup_fee_paid,
    }));

    const hostListingIds = listings.map(l => l.id);

    // 3. Fetch Bookings
    const { data: bookingsData, error: bError } = await (hostListingIds.length > 0 
      ? supabase
          .from('bookings')
          .select('*, user:profiles!user_id(id, name, ev_profiles(ev_model))')
          .in('listing_id', hostListingIds)
          .order('date', { ascending: false })
          .order('start_time', { ascending: false })
      : Promise.resolve({ data: [], error: null }));

    if (bError) throw bError;

    const completedBookings = (bookingsData || []).filter(b => b.status === 'COMPLETED');
    const upcomingBookingsData = (bookingsData || []).filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING');

    const totalEarnings = completedBookings.reduce((sum, b) => {
      const { hostPayout } = calculateHostPayout(b.base_fee);
      return sum + hostPayout;
    }, 0);

    const upcomingBookings = upcomingBookingsData.slice(0, 5).map(b => ({
      ...b,
      date: b.date,
      startTime: b.start_time.substring(0, 5),
      endTime: b.end_time.substring(0, 5),
      baseFee: b.base_fee,
      user: {
        name: b.user?.name || 'Guest',
        evModel: b.user?.ev_profiles?.[0]?.ev_model || null
      }
    }));

    return {
      totalEarnings,
      activeBookingCount: upcomingBookingsData.length,
      totalSessions: completedBookings.length,
      listings,
      upcomingBookings,
      profile: {
        id: hostId,
        verificationStatus: hostProfileData?.verification_status || 'draft',
        phoneVerified: hostProfileData?.phone_verified || false,
        identityVerified: isHostIdentitySubmitted(hostProfileData, verificationDocs),
        propertyProofUploaded: !!(hostProfileData?.property_proof_uploaded || verificationDocs.property_proof_path),
        chargerProofUploaded: !!(hostProfileData?.charger_proof_uploaded || verificationDocs.charger_proof_path),
        payoutSetupComplete: hostProfileData?.payout_setup_complete || false,
      },
      avgRating: listings.reduce((sum, l) => sum + l.rating, 0) / (listings.filter(l => l.rating > 0).length || 1),
    };
  },

  async getEarnings(hostId) {
    if (!hostId) return null;

    const { data: listings, error: lError } = await supabase
      .from('listings')
      .select('id')
      .eq('host_id', hostId);
    
    if (lError) throw lError;
    const hostListingIds = (listings || []).map(l => l.id);

    const { data: bookings, error: bError } = await (hostListingIds.length > 0 
      ? supabase
          .from('bookings')
          .select('*')
          .in('listing_id', hostListingIds)
          .eq('status', 'COMPLETED')
      : Promise.resolve({ data: [], error: null }));

    if (bError) throw bError;

    let totalRevenue = 0;
    let totalPayout = 0;
    let totalCommission = 0;
    const byMonth = {};

    (bookings || []).forEach(b => {
      const revenue = b.base_fee || 0;
      const { hostPayout, hostPlatformFee } = calculateHostPayout(revenue);
      
      totalRevenue += revenue;
      totalPayout += hostPayout;
      totalCommission += hostPlatformFee;

      const monthKey = b.date ? b.date.substring(0, 7) : 'Unknown';
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { revenue: 0, payout: 0, commission: 0, sessions: 0 };
      }
      byMonth[monthKey].revenue += revenue;
      byMonth[monthKey].payout += hostPayout;
      byMonth[monthKey].commission += hostPlatformFee;
      byMonth[monthKey].sessions += 1;
    });

    return {
      totalRevenue,
      totalPayout,
      totalCommission,
      totalSessions: bookings?.length || 0,
      byMonth
    };
  },

  async getProfile(userId) {
    const profile = await getProfile(userId);
    if (!profile) return null;
    const hostProfileRow = await getHostProfile(userId);
    const verificationDocs = await getLatestVerificationDocuments(userId, 'HOST');
    const combined = mergeUserShape(profile, null, hostProfileRow, null, verificationDocs);
    
    // Add additional flags needed for Host Profile UI
    return {
      ...combined,
      phoneVerified: hostProfileRow?.phone_verified || false,
      identityVerified: isHostIdentitySubmitted(hostProfileRow, verificationDocs),
      propertyProofUploaded: !!(hostProfileRow?.property_proof_uploaded || verificationDocs.property_proof_path),
      chargerProofUploaded: !!(hostProfileRow?.charger_proof_uploaded || verificationDocs.charger_proof_path),
      payoutSetupComplete: hostProfileRow?.payout_setup_complete || false,
    };
  },

  async getOnboardingDraft(userId, preferredListingId = null) {
    if (!userId) return null;

    const [hostProfileRow, verificationDocs, listing] = await Promise.all([
      getHostProfile(userId),
      getLatestVerificationDocuments(userId, 'HOST'),
      listingService.getHostOnboardingListing(userId, preferredListingId)
    ]);

    const payment = listing?.id
      ? await onboardingPaymentService.getExistingPayment(userId, listing.id)
      : await onboardingPaymentService.getExistingPayment(userId, null);

    return {
      profile: hostProfileRow ? {
        phone: hostProfileRow.phone || '',
        cnicNumber: hostProfileRow.cnic_number || '',
        verificationStatus: hostProfileRow.verification_status || 'draft',
        identityVerified: isHostIdentitySubmitted(hostProfileRow, verificationDocs),
        cnicBackSubmitted: !!(hostProfileRow.cnic_back_submitted || verificationDocs.cnic_back_path),
        propertyProofUploaded: !!(hostProfileRow.property_proof_uploaded || verificationDocs.property_proof_path),
        chargerProofUploaded: !!(hostProfileRow.charger_proof_uploaded || verificationDocs.charger_proof_path),
        payoutSetupComplete: !!hostProfileRow.payout_setup_complete,
        moderationNotes: hostProfileRow.moderation_notes || ''
      } : null,
      listing,
      payment: payment ? {
        ...payment,
        receiptUrl: await createVerificationSignedUrl(payment.screenshot_path)
      } : null,
      verificationDocs: {
        cnicPath: verificationDocs.cnic_path || null,
        cnicBackPath: verificationDocs.cnic_back_path || null,
        propertyProofPath: verificationDocs.property_proof_path || null,
        chargerProofPath: verificationDocs.charger_proof_path || null,
        cnicUrl: await createVerificationSignedUrl(verificationDocs.cnic_path),
        cnicBackUrl: await createVerificationSignedUrl(verificationDocs.cnic_back_path),
        propertyProofUrl: await createVerificationSignedUrl(verificationDocs.property_proof_path),
        chargerProofUrl: await createVerificationSignedUrl(verificationDocs.charger_proof_path),
      }
    };
  },

  async updateProfile(userId, data) {
    const { error } = await supabase
      .from('host_profiles')
      .update(data)
      .eq('user_id', userId);
    if (error) throw error;
    return this.getProfile(userId);
  },

  async promote(userId) {
    if (!userId) throw new Error('User session is required before host promotion.');
    console.log("[EV-Net] Promoting user to host", userId);
    const response = await withOperationTimeout(
      supabase.rpc('promote_to_host', { target_user_id: userId }),
      15000,
      'Host promotion timed out after 15 seconds. Please try again.'
    );
    const { data, error } = response;
    console.log("[EV-Net] promote_to_host response:", { data, error });
    if (error) {
      console.error("[EV-Net] Error in promote_to_host:", error);
      throw new Error(`Host promotion failed: ${error.message}`);
    }
    console.log("[EV-Net] Host promotion successful");
    return { success: true };
  },

  async finalizeOnboarding() {
    console.log('[EV-Net] Step 4: Finalizing verification via RPC...');
    const { data, error } = await supabase.rpc('finalize_host_onboarding');
    console.log('[EV-Net] finalize_host_onboarding response:', { data, error });
    
    if (error) {
      console.error('[EV-Net] finalize_host_onboarding failed:', error);
      throw error;
    }
    console.log('[EV-Net] Step 4 complete: Host onboarding finalized');
    return { success: true };
  },

  async getExistingOnboardingPayment(userId, listingId) {
    return onboardingPaymentService.getExistingPayment(userId, listingId);
  },

  async submitOnboardingPayment(userId, data) {
    return onboardingPaymentService.submitPayment(userId, data);
  }
};
export const reviewService = {
  async getByListing(listingId) {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        author:profiles!author_id(
          *,
          ev_profiles:ev_profiles!user_id ( avatar_path ),
          host_profiles:host_profiles!user_id ( avatar_path )
        )
      `)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (reviews || []).map(r => ({
      ...r,
      author: r.author ? {
        id: r.author.id,
        name: r.author.name,
        avatar: resolveAvatarUrl(r.author.ev_profiles?.[0]?.avatar_path || r.author.host_profiles?.[0]?.avatar_path) || r.author.avatar_url,
        createdAt: r.author.created_at
      } : null,
      authorId: r.author_id,
      listingId: r.listing_id,
      createdAt: r.created_at,
    }));
  },

  async create(data) {
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        author_id: data.authorId,
        listing_id: data.listingId,
        rating: data.rating,
        comment: data.comment
      })
      .select()
      .single();

    if (error) throw error;
    return review;
  }
};

// ─── NOTIFICATION SERVICE ───────────────────────────────

export const notificationService = {
  async getByUser(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(normalizeNotificationRow);
  },

  async markRead(notifId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    if (error) throw error;
    return { success: true };
  },

  async create(userId, type, message, meta = null) {
    const payload = {
      user_id: userId,
      type,
      message,
      is_read: false
    };

    if (meta && Object.keys(meta).length > 0) payload.data = meta;

    const { data: row, error } = await supabase
      .from('notifications')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return normalizeNotificationRow(row);
  },

  subscribeToUser(userId, callback) {
    if (!userId) return () => {};

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            callback({ id: payload.old?.id, deleted: true });
            return;
          }
          callback(normalizeNotificationRow(payload.new));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }
};

// ─── VERIFICATION SERVICE ───────────────────────────────

export const verificationService = {
  /**
   * Returns a public URL for a given storage path.
   */
  getPublicUrl(path) {
    if (!path) return null;
    const { data } = supabase.storage.from(VERIFICATION_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  async getSignedUrl(path) {
    return createVerificationSignedUrl(path);
  },

  /**
   * Uploads a document to Supabase Storage and records it in verification_submissions.
   * Also updates the corresponding profile flag.
   */
  async uploadDocument(userId, profileType, documentType, file, options = {}) {
    if (!file) throw new Error("No file provided");
    
    // 0. Ensure session exists
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[EV-Net] No active session found during upload.');
      throw new Error("Your session has expired. Please log in again.");
    }
    const sessionUserId = session.user.id;

    console.log(`[EV-Net] Starting upload for ${documentType} (User: ${userId})...`);

    const fileExt = file.name.split('.').pop() || 'bin';
    const filePath = `${sessionUserId}/${documentType}_${Date.now()}.${fileExt}`;
    const normalizedProfileType = profileType === 'HOST' ? 'HOST' : 'EV_USER';
    const table = normalizedProfileType === 'HOST' ? 'host_profiles' : 'ev_profiles';
    const shouldUpdateProfileFlags = options.updateProfileFlags !== false;

    // 1. Upload to Storage with a 30s timeout
    console.log(`[EV-Net] Uploading to bucket '${VERIFICATION_BUCKET}' at path: ${filePath}`);
    
    const uploadPromise = supabase.storage
      .from(VERIFICATION_BUCKET)
      .upload(filePath, file, { 
        upsert: true,
        contentType: file.type || 'application/octet-stream'
      });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => {
        console.error('[EV-Net] Upload timeout reached (20s)');
        reject(new Error("Upload timed out after 20 seconds. Please check your connection."));
      }, 20000)
    );

    console.log('[EV-Net] Racing upload against timeout...');
    const result = await Promise.race([uploadPromise, timeoutPromise]);
    
    // Promise.race returns the raw result from the winner
    const { data: uploadData, error: uploadError } = result || {};
    
    if (uploadError) {
      console.error('[EV-Net] Supabase Storage Error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    if (!uploadData) {
      console.error('[EV-Net] Upload finished with no data and no error - unexpected.');
      throw new Error("Upload failed to return a response.");
    }

    console.log(`[EV-Net] Storage upload successful:`, uploadData);

    // 2. Record in submissions table (exact hybrid schema)
    console.log(`[EV-Net] Recording submission in DB...`);
    
    // Map documentType to legacy path columns
    const legacyPathMap = {
      'CNIC_FRONT': 'cnic_path',
      'CNIC_BACK': 'cnic_back_path',
      'EV_PROOF': 'ev_proof_path',
      'PROPERTY_PROOF': 'property_proof_path',
      'CHARGER_PROOF': 'charger_proof_path'
    };
    const legacyField = legacyPathMap[documentType];

    const submissionPayload = {
      user_id: sessionUserId,
      profile_type: normalizedProfileType,
      type: normalizedProfileType,
      document_type: documentType,
      storage_path: filePath,
      status: 'pending',         // Lowercase as requested
      submitted_at: new Date().toISOString()
    };

    if (legacyField) {
      submissionPayload[legacyField] = filePath;
    }

    // Helper to wrap Supabase calls in timeout
    const withDbTimeout = async (promise, timeoutMs = 10000) => {
      const tPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database operation timed out")), timeoutMs)
      );
      return Promise.race([promise, tPromise]);
    };

    const { data: existingRows, error: existingError } = await withDbTimeout(supabase
      .from('verification_submissions')
      .select('id')
      .eq('user_id', sessionUserId)
      .eq('profile_type', normalizedProfileType)
      .eq('document_type', documentType)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(1));

    if (existingError) {
      console.error('[EV-Net] Existing submission lookup error:', existingError);
      throw new Error(`Could not check existing document submission: ${existingError.message}`);
    }

    const existingSubmissionId = existingRows?.[0]?.id;
    const submissionRequest = existingSubmissionId
      ? supabase
          .from('verification_submissions')
          .update(submissionPayload)
          .eq('id', existingSubmissionId)
      : supabase
          .from('verification_submissions')
          .insert(submissionPayload);

    const { error: submissionError } = await withDbTimeout(submissionRequest);
    
    if (submissionError) {
      console.error('[EV-Net] Submission record error:', submissionError);
      throw new Error(`Database error: ${submissionError.message}`);
    }
    console.log(`[EV-Net] Submission recorded.`, {
      mode: existingSubmissionId ? 'updated' : 'inserted',
      id: existingSubmissionId || null
    });

    // 3. Update profile boolean flags
    const updateData = {};
    if (documentType === 'CNIC_FRONT') {
      if (normalizedProfileType === 'HOST') {
        updateData.identity_verified = true;
      } else {
        updateData.cnic_submitted = true;
      }
    }
    if (documentType === 'CNIC_BACK') {
      updateData.cnic_back_submitted = true;
    }
    if (documentType === 'EV_PROOF') updateData.ev_proof_submitted = true;
    if (documentType === 'PROPERTY_PROOF') updateData.property_proof_uploaded = true;
    if (documentType === 'CHARGER_PROOF') updateData.charger_proof_uploaded = true;

    if (shouldUpdateProfileFlags && Object.keys(updateData).length > 0) {
      console.log(`[EV-Net] Updating profile flags:`, updateData);
      const { error: dbError } = await withDbTimeout(supabase
        .from(table)
        .update(updateData)
        .eq('user_id', sessionUserId));
      
      if (dbError) {
        console.error('[EV-Net] Profile update error:', dbError);
        throw dbError;
      }
      console.log(`[EV-Net] Profile flags updated.`);
    } else if (!shouldUpdateProfileFlags) {
      console.log(`[EV-Net] Skipping profile flag update; caller will finalize via RPC.`);
    }

    return { success: true, path: filePath };
  },

  /**
   * Final step: sets the overall profile status to under_review.
   */
  async submitForReview(userId, profileType) {
    // Helper to wrap Supabase calls in timeout
    const withDbTimeout = async (promise, timeoutMs = 8000) => {
      const tPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
      );
      return Promise.race([promise, tPromise]);
    };

    console.log(`[EV-Net] Marking profile as under_review for ${profileType}...`);
    
    let updateError;
    
    if (profileType === 'USER' || profileType === 'EV_USER') {
      const { data, error } = await withDbTimeout(supabase.rpc('submit_ev_verification_for_review'));
      console.log('[EV-Net] submit_ev_verification_for_review response:', { data, error });
      updateError = error;
    } else {
      const { data, error } = await withDbTimeout(supabase.rpc('resubmit_host_onboarding'));
      console.log('[EV-Net] resubmit_host_onboarding response:', { data, error });
      updateError = error;
    }

    if (updateError) {
      throw new Error(`Could not submit verification for review: ${updateError.message}`);
    }
    console.log(`[EV-Net] Profile status updated.`);

    // 2. Notification Trigger (Best effort, with timeout)
    try {
      console.log(`[EV-Net] Creating submission notification...`);
      await withDbTimeout(notificationService.create(userId, 'VERIFICATION', 'Your verification documents have been submitted and are under review.'), 5000);
      console.log(`[EV-Net] Notification created.`);
    } catch (err) {
      console.warn('[EV-Net] Notification creation skipped/failed:', err.message);
    }

    // 3. Return fresh profile
    console.log(`[EV-Net] Finalizing submission...`);
    return await withDbTimeout(authService.getMe(userId), 5000);
  }
};


