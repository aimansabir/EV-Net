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

// ─── HELPERS ────────────────────────────────────────────

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
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getHostProfile(userId) {
  const { data, error } = await supabase
    .from('host_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Robustly poll for a profile (used after signup to wait for trigger).
 */
async function pollProfile(userId, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const profile = await getProfile(userId);
    if (profile) return profile;
    await new Promise(r => setTimeout(r, 500 * (i + 1))); // Exponentialish backoff
  }
  throw new Error('Profile creation timed out. Please try logging in.');
}

/**
 * Merge profile + role-specific profile into the shape
 * the frontend expects (flat User object).
 */
function mergeUserShape(profile, evProfile, hostProfile) {
  if (!profile) return null;

  const base = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    avatar: profile.avatar_url,
    isSuspended: profile.is_suspended,
    createdAt: profile.created_at,
  };

  if (profile.role === 'USER' && evProfile) {
    return {
      ...base,
      phone: evProfile.phone,
      evBrand: evProfile.ev_brand,
      evModel: evProfile.ev_model,
      connectorPreference: evProfile.connector_preference,
      verificationStatus: evProfile.verification_status,
      emailVerified: evProfile.email_verified,
      phoneVerified: evProfile.phone_verified,
      cnicSubmitted: evProfile.cnic_submitted,
      evProofSubmitted: evProfile.ev_proof_submitted,
      isRestrictedFromInquiry: evProfile.is_restricted_from_inquiry,
      // Derived
      canBook: evProfile.email_verified && evProfile.phone_verified && evProfile.cnic_submitted && evProfile.ev_proof_submitted && evProfile.verification_status === 'approved',
    };
  }

  if (profile.role === 'HOST' && hostProfile) {
    return {
      ...base,
      phone: hostProfile.phone,
      verificationStatus: hostProfile.verification_status,
    };
  }

  // Admin or fallback
  return base;
}

// ─── AUTH SERVICE ───────────────────────────────────────

export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const profile = await getProfile(data.user.id);
    if (!profile) {
      throw new Error('Authentication successful, but user profile was not found in the database.');
    }

    let evProfile = null;
    let hostProfile = null;

    if (profile.role === 'USER') {
      evProfile = await getEvProfile(data.user.id);
    } else if (profile.role === 'HOST') {
      hostProfile = await getHostProfile(data.user.id);
      if (!hostProfile) {
        throw new Error('Host account setup is incomplete. Missing host profile record (Data Integrity error).');
      }
    }

    return { user: mergeUserShape(profile, evProfile, hostProfile) };
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

    // Wait for auth trigger to create profiles
    const profile = await pollProfile(data.user.id);
    const evProfile = await getEvProfile(data.user.id);

    // Update EV-specific fields
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

    // Refetch to get updated fields
    const updatedEvProfile = await getEvProfile(data.user.id);
    return { user: mergeUserShape(profile, updatedEvProfile, null) };
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

    // Wait for auth trigger
    const profile = await pollProfile(data.user.id);
    const hostProfile = await getHostProfile(data.user.id);

    return { user: mergeUserShape(profile, null, hostProfile), hostProfile };
  },

  async getMe(userId) {
    try {
      const profile = await getProfile(userId);
      if (!profile) return null;
      const evProfile = profile.role === 'USER' ? await getEvProfile(userId) : null;
      const hostProfile = profile.role === 'HOST' ? await getHostProfile(userId) : null;
      return mergeUserShape(profile, evProfile, hostProfile);
    } catch {
      return null;
    }
  },

  async submitUserVerification(userId) {
    const { data, error } = await supabase
      .from('ev_profiles')
      .update({
        verification_status: 'under_review',
        cnic_submitted: true,
        ev_proof_submitted: true,
      })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return await this.getMe(userId);
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
    if (filters.maxPrice) query = query.lte('price_per_hour', filters.maxPrice);
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
        host:profiles!host_id ( id, name, avatar_url, created_at ),
        availability:availability_rules ( id, day_of_week, start_time, end_time )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!listing) return null;

    // Fetch reviews separately (they reference listing_id)
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*, author:profiles!author_id ( id, name, avatar_url )')
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
        avatar: listing.host.avatar_url,
        createdAt: listing.host.created_at,
      } : null,
      hostProfile: hostProfile ? { verificationStatus: hostProfile.verification_status } : null,
      reviews: (reviews || []).map(r => ({
        ...r,
        author: r.author ? { id: r.author.id, name: r.author.name, avatar: r.author.avatar_url } : null,
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
        price_per_hour: data.pricePerHour,
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

// ─── STUB SERVICES ──────────────────────────────────────
// These are not yet implemented in Supabase (Phase 2+).
// We fall back to mock services so the frontend UI doesn't crash 
// while developers are testing real Supabase Auth (Phase 1).

import {
  availabilityService as mockAvailability,
  bookingService as mockBooking,
  hostService as mockHost,
  reviewService as mockReview,
  adminService as mockAdmin,
  notificationService as mockNotification,
  messagingService as mockMessaging
} from './api.mock.js';

export const availabilityService = mockAvailability;
export const bookingService = mockBooking;
export const hostService = mockHost;
export const reviewService = mockReview;
export const adminService = mockAdmin;
export const notificationService = mockNotification;
export const messagingService = mockMessaging;
