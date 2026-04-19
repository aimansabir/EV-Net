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
    const { data: bookingId, error } = await supabase.rpc('create_booking', {
      p_listing_id: data.listingId,
      p_date: data.date,
      p_start_time: data.startTime + ':00',
      p_end_time: data.endTime + ':00'
    });
    
    if (error) throw new Error(error.message);
    
    // Fetch newly created booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    if (fetchError) throw fetchError;
    
    return {
      ...booking,
      listingId: booking.listing_id,
      startTime: booking.start_time.substring(0, 5),
      endTime: booking.end_time.substring(0, 5),
      baseFee: booking.base_fee,
      serviceFee: booking.service_fee,
      totalFee: booking.total_fee,
      createdAt: booking.created_at,
    };
  },

  async getByUser(userId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, listing:listings(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(b => ({
      ...b,
      listingId: b.listing_id,
      userId: b.user_id,
      startTime: b.start_time.substring(0, 5),
      endTime: b.end_time.substring(0, 5),
      baseFee: b.base_fee,
      serviceFee: b.service_fee,
      totalFee: b.total_fee,
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
      baseFee: b.base_fee,
      serviceFee: b.service_fee,
      totalFee: b.total_fee,
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
        user:profiles!user_id(*),
        host:profiles!host_id(*),
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
        user: isUser ? c.host : c.user,
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
    const { data, error } = await supabase.rpc('create_or_get_inquiry', {
      p_listing_id: listingId
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Failed to init inquiry.');

    const c = data[0];
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
    };
  },

  async sendMessage(conversationId, senderId, content) {
    const { data, error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_content: content
    });
    if (error) throw new Error(error.message); // Will throw 'Inquiry limit reached' or Regex filters

    const m = data[0];
    return {
      ...m,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      createdAt: m.created_at
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
    return data.map(u => ({ ...u, createdAt: u.created_at, hostProfile: u.hostProfile, evProfile: u.evProfile }));
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

  async getConversations() {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, listing:listings(*), user:profiles!user_id(*), host:profiles!host_id(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(c => ({
      ...c,
      userId: c.user_id,
      hostId: c.host_id,
      listingId: c.listing_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at
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
  notificationService as mockNotification,
} from './api.mock.js';

export const hostService = mockHost;
export const reviewService = mockReview;
export const notificationService = mockNotification;
