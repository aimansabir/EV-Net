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

// ─── HELPERS ────────────────────────────────────────────

async function getProfile(userId) {
  // DEMO BACKDOOR: Mock admin profile
  if (userId === 'admin_main') {
    return {
      id: 'admin_main',
      email: 'admin@EV-Net.pk',
      name: 'Zain Ahmed',
      role: 'ADMIN',
      created_at: new Date().toISOString()
    };
  }
  
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

/**
 * Merge profile + role-specific profile into the shape
 * the frontend expects (flat User object).
 */
function mergeUserShape(profile, evProfile, hostProfile, authUser = null) {
  if (!profile) return null;

  const provider = authUser?.app_metadata?.provider || 'email';
  const emailVerified = !!(authUser?.email_confirmed_at || provider === 'google');
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
    return {
      ...base,
      phone: evProfile.phone,
      avatar: avatar || base.avatar,
      avatarPath: evProfile.avatar_path,
      evBrand: evProfile.ev_brand,
      evModel: evProfile.ev_model,
      connectorPreference: evProfile.connector_preference,
      verificationStatus: (evProfile.verification_status === 'approved') ? 'approved' : 
                         (evProfile.cnic_submitted && evProfile.ev_proof_submitted) ? 'under_review' : 
                         evProfile.verification_status,
      cnicSubmitted: evProfile.cnic_submitted,
      cnicPath: evProfile.cnic_path,
      evProofSubmitted: evProfile.ev_proof_submitted,
      evProofPath: evProfile.ev_proof_path,
      isRestrictedFromInquiry: evProfile.is_restricted_from_inquiry,
      // Derived
      canBook: emailVerified && phoneVerified && evProfile.cnic_submitted && evProfile.ev_proof_submitted && evProfile.verification_status === 'approved',
    };
  }

  if (profile.role === 'HOST' && hostProfile) {
    const avatar = resolveAvatarUrl(hostProfile.avatar_path);
    return {
      ...base,
      phone: hostProfile.phone,
      avatar: avatar || base.avatar,
      avatarPath: hostProfile.avatar_path,
      verificationStatus: (hostProfile.verification_status === 'approved') ? 'approved' : 
                         (hostProfile.cnic_submitted && hostProfile.property_proof_uploaded && hostProfile.charger_proof_uploaded) ? 'under_review' : 
                         hostProfile.verification_status,
      cnicSubmitted: hostProfile.cnic_submitted,
      cnicPath: hostProfile.cnic_path,
      propertyProofUploaded: hostProfile.property_proof_uploaded,
      propertyProofPath: hostProfile.property_proof_path,
      chargerProofUploaded: hostProfile.charger_proof_uploaded,
      chargerProofPath: hostProfile.charger_proof_path,
    };
  }

  // Admin or fallback
  return base;
}

/**
 * Optimized profile summary for fast hydration
 */
async function getProfileSummary(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, avatar_url, is_suspended')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

// ─── AUTH SERVICE ───────────────────────────────────────

export const authService = {
  async login(email, password) {
    return withTimeout((async () => {
      let userId;

      // DEMO BACKDOOR: Allow admin login with fixed credentials
      if (email === 'admin@EV-Net.pk' && password === 'admin123') {
        console.log('[EV-Net] Admin Demo Login Detected. Bypassing Auth...');
        userId = 'admin_main'; 
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        userId = data.user.id;
      }
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
      } else if (profile.role === 'HOST') {
        hostProfile = await getHostProfile(userId);
        if (!hostProfile) {
          console.warn(`[EV-Net] Host sub-profile missing for ${userId}. Repairing...`);
          await supabase.rpc('ensure_host_profile', { p_user_id: userId });
          hostProfile = await getHostProfile(userId);
        }
      }

      const provider = data.user?.app_metadata?.provider || 'email';
      return { user: mergeUserShape(profile, evProfile, hostProfile, data.user) };
    })(), 10000);
  },

  /**
   * Resends the verification email for email/password users.
   */
  async sendVerificationEmail(email) {
    const result = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    console.log('[EV-Net] Supabase resend result:', result);
    if (result.error) throw new Error(result.error.message);
    return { success: true };
  },

  /**
   * Sends an OTP to the user's phone via WhatsApp.
   */
  async sendPhoneOTP(phone) {
    const { data, error } = await supabase.auth.signInWithOtp({
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
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          phone: formData.phone,
          role: 'USER',
        },
      },
    });
    if (error) throw new Error(error.message);

    // If no session, email verification is likely required
    if (!data.session) {
      return { success: true, verificationRequired: true, user: data.user };
    }

    // Wrap polling in a hard timeout
    return withTimeout((async () => {
      const profile = await pollProfile(data.user.id);
      await pollTable('ev_profiles', data.user.id, 'user_id');

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
      }

      // Handle avatar upload if provided
      if (formData.avatar) {
        try {
          await profileService.uploadAvatar(data.user.id, formData.avatar, 'USER');
        } catch (err) {
          console.error("[EV-Net] Failed to upload avatar during signup:", err);
        }
      }

      const provider = data.user?.app_metadata?.provider || 'email';
      return { 
        success: true, 
        user: mergeUserShape(profile, finalEvProfile, null, provider) 
      };
    })());
  },

  async signupHost(formData) {
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          phone: formData.phone,
          role: 'HOST',
        },
      },
    });
    if (error) throw new Error(error.message);

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

      const provider = data.user?.app_metadata?.provider || 'email';
      return { 
        success: true, 
        user: mergeUserShape(profile, null, hostProfile, data.user) 
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

      const { data: { user: authUser } } = await supabase.auth.getUser();
      return mergeUserShape(profile, evProfile, hostProfile, authUser);
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
          .map(p => p.storage_path),
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
        .map(p => p.storage_path),
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
        price_per_hour: data.pricePerHour || 0,
        price_day_per_kwh: data.priceDay,
        price_night_per_kwh: data.priceNight,
        amenities: data.amenities || [],
        house_rules: data.houseRules || [],
      })
      .select()
      .single();
    if (error) throw error;

    // Insert location separately
    if (data.address && data.lat && data.lng) {
      await supabase.from('listing_locations').insert({
        listing_id: listing.id,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
      });
    }

    return listing;
  },

  async update(id, data) {
    const updates = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.pricePerHour !== undefined) updates.price_per_hour = data.pricePerHour;
    if (data.priceDay !== undefined) updates.price_day_per_kwh = data.priceDay;
    if (data.priceNight !== undefined) updates.price_night_per_kwh = data.priceNight;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.amenities !== undefined) updates.amenities = data.amenities;
    if (data.houseRules !== undefined) updates.house_rules = data.houseRules;

    const { data: listing, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return listing;
  },

  async delete(id) {
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async getByHost(hostId) {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(l => ({
      ...l,
      pricePerHour: l.price_per_hour,
      priceDay: l.price_day_per_kwh,
      priceNight: l.price_night_per_kwh,
      hostId: l.host_id,
      isActive: l.is_active,
      isApproved: l.is_approved,
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
    const { data: bookingId, error } = await supabase.rpc('create_booking', {
      p_listing_id: data.listingId,
      p_date: data.date,
      p_start_time: data.startTime + ':00',
      p_end_time: data.endTime + ':00',
      p_vehicle_size: data.vehicleSize
    });
    
    if (error) throw new Error(error.message);
    
    // Fetch newly created booking with full breakdown
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    if (fetchError) throw fetchError;
    
    const result = {
      ...booking,
      listingId: booking.listing_id,
      startTime: booking.start_time.substring(0, 5),
      endTime: booking.end_time.substring(0, 5),
      // Map new fee fields
      baseCharge: booking.base_fee,
      userServiceFee: booking.user_service_fee,
      hostPlatformFee: booking.host_platform_fee,
      gatewayFee: booking.gateway_fee,
      userTotal: booking.total_fee,
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
      .eq('user_id', userId)
    
    return data.map(b => ({
      ...b,
      listingId: b.listing_id,
      userId: b.user_id,
      startTime: b.start_time.substring(0, 5),
      endTime: b.end_time.substring(0, 5),
      // New fee model fields
      baseCharge: b.base_fee,
      userServiceFee: b.user_service_fee,
      userTotal: b.total_fee,
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
      baseCharge: b.base_fee,
      userServiceFee: b.user_service_fee,
      hostPlatformFee: b.host_platform_fee,
      gatewayFee: b.gateway_fee,
      userTotal: b.total_fee,
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

  async createOrGetInquiry(listingId, userId) {
    // 1. Fetch listing to get hostId
    const { data: listing, error: lError } = await supabase
      .from('listings')
      .select('host_id')
      .eq('id', listingId)
      .single();
    if (lError) throw lError;

    // 2. Check for existing conversation
    const { data: existing, error: eError } = await supabase
      .from('conversations')
      .select('*')
      .eq('listing_id', listingId)
      .eq('user_id', userId)
      .eq('type', 'INQUIRY')
      .maybeSingle();
    
    if (eError) throw eError;
    if (existing) {
      return {
        ...existing,
        listingId: existing.listing_id,
        userId: existing.user_id,
        hostId: existing.host_id,
      };
    }

    // 3. Create new conversation
    const { data: created, error: cError } = await supabase
      .from('conversations')
      .insert({
        listing_id: listingId,
        user_id: userId,
        host_id: listing.host_id,
        type: 'INQUIRY',
        status: 'ACTIVE'
      })
      .select()
      .single();
    
    if (cError) throw cError;

    return {
      ...created,
      listingId: created.listing_id,
      userId: created.user_id,
      hostId: created.host_id,
    };
  },

  async sendMessage(conversationId, senderId, content) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content,
        is_read: false
      })
      .select()
      .single();
    
    if (error) throw error;

    // Update conversation updatedAt
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

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
    // Simple heuristic for pending hosts (where status = under_review)
    const { count: pendingVerifications } = await supabase
      .from('host_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'under_review');

    return {
      totalUsers: totalUsers || 0,
      totalHosts: 0, // Would need distinct query
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      pendingVerifications: pendingVerifications || 0,
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
    const { data } = await supabase.from('listings').select('*').eq('id', listingId).single();
    return { ...data, isApproved: data.is_approved, isActive: data.is_active };
  },

  async verifyHost(userId, decision) {
    const { error } = await supabase.rpc('admin_verify_host', {
      p_user_id: userId,
      p_approved: decision.approved,
      p_notes: decision.notes || ''
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async verifyUser(userId, decision) {
    const { error } = await supabase.rpc('admin_verify_user', {
      p_user_id: userId,
      p_approved: decision.approved,
      p_notes: decision.notes || ''
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async getVerificationSubmissions() {
    const { data, error } = await supabase
      .from('verification_submissions')
      .select('*, user:profiles(*)')
      .order('submitted_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(s => ({
      ...s,
      user: s.user ? {
        ...s.user,
        avatar: s.user.avatar_url
      } : null,
      submittedAt: s.submitted_at
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
    const { data: admin } = await supabase.auth.getUser();
    
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
  }
};

// ─── STUB SERVICES Remaining ────────────────────────────
import {
  hostService as mockHost,
  reviewService as mockReview,
} from './api.mock.js';

export const hostService = {
  async getDashboard(hostId) {
    // 1. Fetch Host sub-profile (for verification status)
    const hostProfileData = await getHostProfile(hostId);
    
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
        .map(p => p.storage_path),
      pricePerHour: l.price_per_hour,
      chargerType: l.charger_type,
      isActive: l.is_active,
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
        identityVerified: hostProfileData?.cnic_submitted || false,
        propertyProofUploaded: hostProfileData?.property_proof_uploaded || false,
        chargerProofUploaded: hostProfileData?.charger_proof_uploaded || false,
        payoutSetupComplete: hostProfileData?.payout_setup_complete || false,
      },
      avgRating: listings.reduce((sum, l) => sum + l.rating, 0) / (listings.filter(l => l.rating > 0).length || 1),
    };
  },

  async getProfile(userId) {
    const profile = await getProfile(userId);
    if (!profile) return null;
    const hostProfileRow = await getHostProfile(userId);
    const combined = mergeUserShape(profile, null, hostProfileRow);
    
    // Add additional flags needed for Host Profile UI
    return {
      ...combined,
      phoneVerified: hostProfileRow?.phone_verified || false,
      identityVerified: hostProfileRow?.cnic_submitted || false,
      propertyProofUploaded: hostProfileRow?.property_proof_uploaded || false,
      chargerProofUploaded: hostProfileRow?.charger_proof_uploaded || false,
      payoutSetupComplete: hostProfileRow?.payout_setup_complete || false,
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

  async submitVerification(userId) {
    const { error } = await supabase
      .from('host_profiles')
      .update({ verification_status: 'pending' })
      .eq('user_id', userId);
    if (error) throw error;
    return this.getProfile(userId);
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
    
    return (data || []).map(n => ({
      ...n,
      userId: n.user_id,
      isRead: n.is_read,
      createdAt: n.created_at,
    }));
  },

  async markRead(notifId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    if (error) throw error;
    return { success: true };
  },

  async create(userId, type, message) {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        message,
        is_read: false
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ─── VERIFICATION SERVICE ───────────────────────────────

export const verificationService = {
  /**
   * Returns a public URL for a given storage path.
   */
  getPublicUrl(path) {
    if (!path) return null;
    const { data } = supabase.storage.from('verification_documents').getPublicUrl(path);
    return data.publicUrl;
  },
  /**
   * Uploads a document to Supabase Storage and records it in verification_submissions.
   * Also updates the corresponding profile flag.
   */
  async uploadDocument(userId, profileType, documentType, file) {
    if (!file) throw new Error("No file provided");
    
    // 0. Ensure session exists
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[EV-Net] No active session found during upload.');
      throw new Error("Your session has expired. Please log in again.");
    }

    console.log(`[EV-Net] Starting upload for ${documentType} (User: ${userId})...`);

    const fileExt = file.name.split('.').pop() || 'bin';
    const filePath = `${userId}/${documentType}_${Date.now()}.${fileExt}`;
    const table = profileType === 'HOST' ? 'host_profiles' : 'ev_profiles';

    // 1. Upload to Storage with a 30s timeout
    console.log(`[EV-Net] Uploading to bucket 'verification_documents' at path: ${filePath}`);
    
    const uploadPromise = supabase.storage
      .from('verification_documents')
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
      'EV_PROOF': 'ev_proof_path',
      'PROPERTY_PROOF': 'property_proof_path',
      'CHARGER_PROOF': 'charger_proof_path'
    };
    const legacyField = legacyPathMap[documentType];

    const submissionPayload = {
      user_id: userId,
      profile_type: profileType, // 'EV_USER' or 'HOST'
      type: profileType,         // 'EV_USER' or 'HOST' (as requested)
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

    const { error: submissionError } = await withDbTimeout(supabase
      .from('verification_submissions')
      .insert(submissionPayload));
    
    if (submissionError) {
      console.error('[EV-Net] Submission record error:', submissionError);
      throw new Error(`Database error: ${submissionError.message}`);
    }
    console.log(`[EV-Net] Submission recorded.`);

    // 3. Update profile boolean flags
    const updateData = {};
    if (documentType === 'CNIC_FRONT') updateData.cnic_submitted = true;
    if (documentType === 'EV_PROOF') updateData.ev_proof_submitted = true;
    if (documentType === 'PROPERTY_PROOF') updateData.property_proof_uploaded = true;
    if (documentType === 'CHARGER_PROOF') updateData.charger_proof_uploaded = true;

    if (Object.keys(updateData).length > 0) {
      console.log(`[EV-Net] Updating profile flags:`, updateData);
      const { error: dbError } = await withDbTimeout(supabase
        .from(table)
        .update(updateData)
        .eq('user_id', userId));
      
      if (dbError) {
        console.error('[EV-Net] Profile update error:', dbError);
        throw dbError;
      }
      console.log(`[EV-Net] Profile flags updated.`);
    }

    return { success: true, path: filePath };
  },

  /**
   * Final step: sets the overall profile status to under_review.
   */
  async submitForReview(userId, profileType) {
    const table = profileType === 'HOST' ? 'host_profiles' : 'ev_profiles';
    
    // Helper to wrap Supabase calls in timeout
    const withDbTimeout = async (promise, timeoutMs = 8000) => {
      const tPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
      );
      return Promise.race([promise, tPromise]);
    };

    // 1. Attempt to update status
    try {
      console.log(`[EV-Net] Marking profile as under_review in ${table}...`);
      const { error: updateError } = await withDbTimeout(supabase
        .from(table)
        .update({ verification_status: 'under_review' })
        .eq('user_id', userId));
      
      if (updateError) {
        console.warn(`[EV-Net] Could not update status (RLS expected):`, updateError.message);
      } else {
        console.log(`[EV-Net] Profile status updated.`);
      }
    } catch (err) {
      console.warn('[EV-Net] Status update skipped/failed:', err.message);
    }

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
