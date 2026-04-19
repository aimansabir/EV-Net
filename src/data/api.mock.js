/**
 * EV-Net — Mock API Service Layer
 * 
 * Mirrors Supabase client patterns so future migration is seamless.
 * All functions return Promises (simulating async API).
 * All data shapes follow src/data/schema.js.
 * All pricing follows src/data/feeConfig.js.
 */

import * as seed from './seed.js';
import { 
  createUser, createHostProfile, createListing, createBooking, createReview, createNotification, 
  createConversation, createMessage,
  UserRole, VerificationStatus, BookingStatus 
} from './schema.js';
import { calculateBookingFees, calculateHostPayout } from './feeConfig.js';

// Simulate network delay
const delay = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

// Mutable copies of seed data for session-level state
let _users = [...seed.users];
let _hostProfiles = [...seed.hostProfiles];
let _listings = [...seed.listings];
let _availability = [...seed.availability];
let _bookings = [...seed.bookings];
let _reviews = [...seed.reviews];
let _notifications = [...seed.notifications];
let _favorites = new Set(['listing_1', 'listing_3']); // Default favorites for demo

// ─── AUTH SERVICE ───────────────────────────────────────

export const authService = {
  async login(email, password) {
    await delay(300);
    const user = _users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid email or password');
    const { password: _, ...safeUser } = user;
    return { user: safeUser };
  },

  async signupUser(data) {
    await delay(300);
    if (_users.find(u => u.email === data.email)) throw new Error('Email already registered');
    const newUser = createUser({
      ...data,
      role: UserRole.USER,
    });
    _users.push(newUser);
    const { password: _, ...safeUser } = newUser;
    return { user: safeUser };
  },

  async signupHost(data) {
    await delay(300);
    if (_users.find(u => u.email === data.email)) throw new Error('Email already registered');
    const newUser = createUser({
      ...data,
      role: UserRole.HOST,
    });
    _users.push(newUser);
    const profile = createHostProfile({ userId: newUser.id });
    _hostProfiles.push(profile);
    const { password: _, ...safeUser } = newUser;
    return { user: safeUser, hostProfile: profile };
  },

  async submitUserVerification(userId) {
    await delay(300);
    const idx = _users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    _users[idx].verificationStatus = VerificationStatus.UNDER_REVIEW;
    _users[idx].cnicSubmitted = true;
    _users[idx].evProofSubmitted = true;
    const { password: _, ...safeUser } = _users[idx];
    return safeUser;
  },

  async getMe(userId) {
    await delay(100);
    const user = _users.find(u => u.id === userId);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  async logout() {
    // No-op in mock mode — store handles localStorage
  },

  async loginWithGoogle() {
    // No real OAuth in mock mode
    throw new Error('Google login is not available in demo mode. Use email/password.');
  },

  async getSession() {
    return null; // No real session in mock mode
  },

  onAuthStateChange() {
    // No-op — return a dummy subscription for API parity
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// ─── LISTING SERVICE ────────────────────────────────────

export const listingService = {
  async getAll(filters = {}) {
    await delay(200);
    let result = [..._listings];
    if (filters.isActive !== undefined) result = result.filter(l => l.isActive === filters.isActive);
    if (filters.isApproved !== undefined) result = result.filter(l => l.isApproved === filters.isApproved);
    if (filters.city) result = result.filter(l => l.city === filters.city);
    if (filters.chargerType) result = result.filter(l => l.chargerType === filters.chargerType);
    if (filters.maxPrice) result = result.filter(l => l.pricePerHour <= filters.maxPrice);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(l => l.title.toLowerCase().includes(q) || l.area.toLowerCase().includes(q) || l.city.toLowerCase().includes(q));
    }
    return result;
  },

  async getById(id) {
    await delay(150);
    const listing = _listings.find(l => l.id === id);
    if (!listing) return null;
    const host = _users.find(u => u.id === listing.hostId);
    const hostProfile = _hostProfiles.find(h => h.userId === listing.hostId);
    const listingReviews = _reviews.filter(r => r.listingId === id).map(r => ({
      ...r,
      author: _users.find(u => u.id === r.authorId),
    }));
    const listingAvailability = _availability.filter(a => a.listingId === id);
    return {
      ...listing,
      host: host ? { id: host.id, name: host.name, avatar: host.avatar, createdAt: host.createdAt } : null,
      hostProfile: hostProfile ? { verificationStatus: hostProfile.verificationStatus } : null,
      reviews: listingReviews,
      availability: listingAvailability,
    };
  },

  async create(data) {
    await delay(300);
    const listing = createListing(data);
    _listings.push(listing);
    return listing;
  },

  async update(id, data) {
    await delay(200);
    const idx = _listings.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Listing not found');
    _listings[idx] = { ..._listings[idx], ...data };
    return _listings[idx];
  },

  async delete(id) {
    await delay(200);
    _listings = _listings.filter(l => l.id !== id);
    return { success: true };
  },

  async getByHost(hostId) {
    await delay(200);
    return _listings.filter(l => l.hostId === hostId);
  },
};

// ─── AVAILABILITY SERVICE ───────────────────────────────

export const availabilityService = {
  async getByListing(listingId) {
    await delay(100);
    return _availability.filter(a => a.listingId === listingId);
  },

  async set(listingId, schedules) {
    await delay(200);
    _availability = _availability.filter(a => a.listingId !== listingId);
    const newAvail = schedules.map((s, i) => ({
      id: `avail_new_${listingId}_${i}`,
      listingId,
      ...s,
    }));
    _availability.push(...newAvail);
    return newAvail;
  },

  async generateSlots(listingId, date) {
    await delay(200);
    const dayOfWeek = new Date(date).getDay();
    const dayAvail = _availability.filter(a => a.listingId === listingId && a.dayOfWeek === dayOfWeek);
    if (dayAvail.length === 0) return [];

    const slots = [];
    dayAvail.forEach(a => {
      const startHour = parseInt(a.startTime.split(':')[0]);
      const endHour = parseInt(a.endTime.split(':')[0]);
      for (let h = startHour; h < endHour; h++) {
        const slotStart = `${String(h).padStart(2, '0')}:00`;
        const slotEnd = `${String(h + 1).padStart(2, '0')}:00`;
        const isBooked = _bookings.some(b =>
          b.listingId === listingId &&
          b.date === date &&
          b.status !== BookingStatus.CANCELLED &&
          b.startTime <= slotStart &&
          b.endTime > slotStart
        );
        slots.push({ id: `slot_${listingId}_${date}_${h}`, listingId, date, startTime: slotStart, endTime: slotEnd, isBooked });
      }
    });
    return slots;
  },
};

// ─── BOOKING SERVICE ────────────────────────────────────

export const bookingService = {
  async create(data) {
    await delay(300);
    // Validate slot availability
    const conflicts = _bookings.filter(b =>
      b.listingId === data.listingId &&
      b.date === data.date &&
      b.status !== BookingStatus.CANCELLED &&
      b.startTime < data.endTime &&
      b.endTime > data.startTime
    );
    if (conflicts.length > 0) throw new Error('This time slot is no longer available. Please choose another.');

    // Prevent self-booking
    const listing = _listings.find(l => l.id === data.listingId);
    if (listing && listing.hostId === data.userId) throw new Error('You cannot book your own charger.');

    // Calculate fees
    const hours = (parseInt(data.endTime.split(':')[0]) - parseInt(data.startTime.split(':')[0]));
    const fees = calculateBookingFees(listing.pricePerHour, hours);

    const booking = createBooking({
      ...data,
      ...fees,
      status: BookingStatus.PENDING,
    });
    _bookings.push(booking);
    return booking;
  },

  async getByUser(userId) {
    await delay(200);
    return _bookings
      .filter(b => b.userId === userId)
      .map(b => ({
        ...b,
        listing: _listings.find(l => l.id === b.listingId),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getByHost(hostId) {
    await delay(200);
    const hostListingIds = _listings.filter(l => l.hostId === hostId).map(l => l.id);
    return _bookings
      .filter(b => hostListingIds.includes(b.listingId))
      .map(b => ({
        ...b,
        listing: _listings.find(l => l.id === b.listingId),
        user: _users.find(u => u.id === b.userId),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async updateStatus(bookingId, status) {
    await delay(200);
    const idx = _bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) throw new Error('Booking not found');
    _bookings[idx].status = status;
    return _bookings[idx];
  },
};

// ─── HOST SERVICE ───────────────────────────────────────

export const hostService = {
  async getDashboard(hostId) {
    await delay(200);
    const hostListings = _listings.filter(l => l.hostId === hostId);
    const hostListingIds = hostListings.map(l => l.id);
    const hostBookings = _bookings.filter(b => hostListingIds.includes(b.listingId));
    const completedBookings = hostBookings.filter(b => b.status === BookingStatus.COMPLETED);
    const totalEarnings = completedBookings.reduce((sum, b) => {
      const { hostPayout } = calculateHostPayout(b.baseFee);
      return sum + hostPayout;
    }, 0);
    const activeBookings = hostBookings.filter(b => b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.PENDING);
    const profile = _hostProfiles.find(h => h.userId === hostId);

    return {
      totalEarnings,
      activeBookingCount: activeBookings.length,
      totalSessions: completedBookings.length,
      listings: hostListings,
      upcomingBookings: activeBookings.slice(0, 5).map(b => ({
        ...b,
        listing: _listings.find(l => l.id === b.listingId),
        user: _users.find(u => u.id === b.userId),
      })),
      profile,
      avgRating: hostListings.reduce((sum, l) => sum + l.rating, 0) / (hostListings.filter(l => l.rating > 0).length || 1),
    };
  },

  async getProfile(userId) {
    await delay(150);
    return _hostProfiles.find(h => h.userId === userId) || null;
  },

  async updateProfile(userId, data) {
    await delay(200);
    const idx = _hostProfiles.findIndex(h => h.userId === userId);
    if (idx === -1) throw new Error('Host profile not found');
    _hostProfiles[idx] = { ..._hostProfiles[idx], ...data };
    return _hostProfiles[idx];
  },

  async submitVerification(userId) {
    await delay(300);
    const idx = _hostProfiles.findIndex(h => h.userId === userId);
    if (idx === -1) throw new Error('Host profile not found');
    _hostProfiles[idx].verificationStatus = VerificationStatus.UNDER_REVIEW;
    _hostProfiles[idx].cnicSubmitted = true;
    _hostProfiles[idx].propertyProofUploaded = true;
    _hostProfiles[idx].chargerProofUploaded = true;
    return _hostProfiles[idx];
  },

  async getEarnings(hostId) {
    await delay(200);
    const hostListingIds = _listings.filter(l => l.hostId === hostId).map(l => l.id);
    const completedBookings = _bookings.filter(b => hostListingIds.includes(b.listingId) && b.status === BookingStatus.COMPLETED);

    const earningsByMonth = {};
    completedBookings.forEach(b => {
      const month = b.createdAt.substring(0, 7); // "2026-03"
      const { hostPayout, platformCommission } = calculateHostPayout(b.baseFee);
      if (!earningsByMonth[month]) earningsByMonth[month] = { revenue: 0, payout: 0, commission: 0, sessions: 0 };
      earningsByMonth[month].revenue += b.baseFee;
      earningsByMonth[month].payout += hostPayout;
      earningsByMonth[month].commission += platformCommission;
      earningsByMonth[month].sessions += 1;
    });

    return {
      totalRevenue: completedBookings.reduce((s, b) => s + b.baseFee, 0),
      totalPayout: completedBookings.reduce((s, b) => s + calculateHostPayout(b.baseFee).hostPayout, 0),
      totalCommission: completedBookings.reduce((s, b) => s + calculateHostPayout(b.baseFee).platformCommission, 0),
      totalSessions: completedBookings.length,
      byMonth: earningsByMonth,
    };
  },
};

// ─── REVIEW SERVICE ─────────────────────────────────────

export const reviewService = {
  async getByListing(listingId) {
    await delay(150);
    return _reviews
      .filter(r => r.listingId === listingId)
      .map(r => ({
        ...r,
        author: _users.find(u => u.id === r.authorId),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async create(data) {
    await delay(300);
    const review = createReview(data);
    _reviews.push(review);
    // Update listing stats
    const listingReviews = _reviews.filter(r => r.listingId === data.listingId);
    const listingIdx = _listings.findIndex(l => l.id === data.listingId);
    if (listingIdx !== -1) {
      _listings[listingIdx].reviewCount = listingReviews.length;
      _listings[listingIdx].rating = Math.round(listingReviews.reduce((s, r) => s + r.rating, 0) / listingReviews.length * 10) / 10;
    }
    return review;
  },
};

// ─── FAVORITE SERVICE ───────────────────────────────────

export const favoriteService = {
  async getAll() {
    await delay(100);
    return [..._favorites];
  },

  async toggle(listingId) {
    await delay(100);
    if (_favorites.has(listingId)) {
      _favorites.delete(listingId);
      return { isFavorited: false };
    } else {
      _favorites.add(listingId);
      return { isFavorited: true };
    }
  },

  async isFavorited(listingId) {
    return _favorites.has(listingId);
  },
};

// ─── ADMIN SERVICE ──────────────────────────────────────

export const adminService = {
  async getDashboard() {
    await delay(200);
    return {
      totalUsers: _users.filter(u => u.role === UserRole.USER).length,
      totalHosts: _users.filter(u => u.role === UserRole.HOST).length,
      totalListings: _listings.length,
      activeListings: _listings.filter(l => l.isActive && l.isApproved).length,
      pendingVerifications: _hostProfiles.filter(h => h.verificationStatus === VerificationStatus.PENDING).length,
      totalBookings: _bookings.length,
      totalRevenue: _bookings.filter(b => b.status === BookingStatus.COMPLETED).reduce((s, b) => s + b.serviceFee, 0),
    };
  },

  async getListings() {
    await delay(200);
    return _listings.map(l => ({
      ...l,
      host: _users.find(u => u.id === l.hostId),
    }));
  },

  async getUsers() {
    await delay(200);
    return _users.map(u => {
      const { password: _, ...safe } = u;
      const hostProfile = _hostProfiles.find(h => h.userId === u.id);
      return { ...safe, hostProfile };
    });
  },

  async getBookings() {
    await delay(200);
    return _bookings.map(b => ({
      ...b,
      listing: _listings.find(l => l.id === b.listingId),
      user: _users.find(u => u.id === b.userId),
    }));
  },

  async reviewListing(listingId, decision) {
    await delay(300);
    const idx = _listings.findIndex(l => l.id === listingId);
    if (idx === -1) throw new Error('Listing not found');
    _listings[idx].isApproved = decision.approved;
    if (decision.approved) _listings[idx].isActive = true;
    return _listings[idx];
  },

  async verifyHost(userId, decision) {
    await delay(300);
    const idx = _hostProfiles.findIndex(h => h.userId === userId);
    if (idx === -1) throw new Error('Host profile not found');
    _hostProfiles[idx].verificationStatus = decision.approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
    if (decision.notes) _hostProfiles[idx].moderationNotes = decision.notes;
    return _hostProfiles[idx];
  },

  async verifyUser(userId, decision) {
    await delay(300);
    const idx = _users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    _users[idx].verificationStatus = decision.approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
    if (decision.approved) {
      _users[idx].canBook = true;
    }
    return _users[idx];
  },

  async getConversations() {
    await delay(200);
    return _conversations.map(c => ({
      ...c,
      listing: _listings.find(l => l.id === c.listingId),
      user: _users.find(u => u.id === c.userId),
      host: _users.find(u => u.id === c.hostId),
    }));
  },

  async moderateConversation(conversationId, action) {
    await delay(200);
    const idx = _conversations.findIndex(c => c.id === conversationId);
    if (idx === -1) throw new Error('Conversation not found');
    
    const conv = _conversations[idx];
    
    // Actions: 'WARN_USER', 'RESTRICT_INQUIRY', 'CLOSE_THREAD', 'ESCALATE_TO_DISPUTE', 'SUSPEND_ACCOUNT'
    if (action === 'CLOSE_THREAD') {
      conv.status = 'CLOSED';
    } else if (action === 'RESTRICT_INQUIRY') {
      const uIdx = _users.findIndex(u => u.id === conv.userId);
      if (uIdx !== -1) _users[uIdx].isRestrictedFromInquiry = true;
    } else if (action === 'SUSPEND_ACCOUNT') {
      const uIdx = _users.findIndex(u => u.id === conv.userId);
      if (uIdx !== -1) _users[uIdx].isSuspended = true;
    }
    
    // In a real app we would log this in ModerationReview table
    return conv;
  }
};

// ─── NOTIFICATION SERVICE ───────────────────────────────

export const notificationService = {
  async getByUser(userId) {
    await delay(100);
    return _notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async markRead(notifId) {
    await delay(100);
    const idx = _notifications.findIndex(n => n.id === notifId);
    if (idx !== -1) _notifications[idx].isRead = true;
    return { success: true };
  },

  async create(data) {
    await delay(100);
    const notif = createNotification(data);
    _notifications.push(notif);
    return notif;
  },
};

// ─── MESSAGING SERVICE ──────────────────────────────────

let _conversations = [...seed.conversations];
let _messages = [...seed.messages];

export const messagingService = {
  async getConversations(userId) {
    await delay(200);
    return _conversations
      .filter(c => c.userId === userId || c.hostId === userId)
      .map(c => ({
        ...c,
        listing: _listings.find(l => l.id === c.listingId),
        user: _users.find(u => u.id === (c.userId === userId ? c.hostId : c.userId)), // the other party
        lastMessage: _messages.filter(m => m.conversationId === c.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  async getMessages(conversationId) {
    await delay(150);
    return _messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async createOrGetInquiry(listingId, userId) {
    await delay(300);
    const listing = _listings.find(l => l.id === listingId);
    if (!listing) throw new Error('Listing not found');

    let conv = _conversations.find(c => c.listingId === listingId && c.userId === userId && c.type === 'INQUIRY');
    
    if (!conv) {
      conv = createConversation({
        listingId,
        userId,
        hostId: listing.hostId,
        type: 'INQUIRY',
      });
      _conversations.push(conv);
    }
    return conv;
  },

  async sendMessage(conversationId, senderId, content) {
    await delay(200);
    const convIdx = _conversations.findIndex(c => c.id === conversationId);
    if (convIdx === -1) throw new Error('Conversation not found');
    const conv = _conversations[convIdx];

    const isHost = senderId === conv.hostId;
    const isUser = senderId === conv.userId;

    // Block logic
    if (conv.status === 'ARCHIVED' || conv.status === 'FLAGGED' || conv.status === 'CLOSED') {
      throw new Error(`Cannot send message. Conversation is ${conv.status}.`);
    }

    if (conv.status === 'LOCKED' && !isHost) {
       // user can't send unless they have an approved extension and it's not exhausted
       if (!conv.extensionApproved || conv.extensionCount >= conv.extensionLimit) {
         throw new Error('Inquiry limit reached. Book to continue chatting.');
       }
    }

    // Tracker logic for INQUIRY (only user messages count)
    if (conv.type === 'INQUIRY' && isUser) {
      if (!conv.extensionApproved) {
        if (conv.messageCount >= 3) {
          _conversations[convIdx].status = 'LOCKED';
          throw new Error('Inquiry limit reached. Book to continue chatting.');
        }
        _conversations[convIdx].messageCount += 1;
        if (_conversations[convIdx].messageCount >= 3) {
          _conversations[convIdx].status = 'LOCKED';
        }
      } else {
        if (conv.extensionCount >= conv.extensionLimit) {
           _conversations[convIdx].status = 'LOCKED';
           throw new Error('Extension limit reached. Booking is now required.');
        }
        _conversations[convIdx].extensionCount += 1;
        if (_conversations[convIdx].extensionCount >= conv.extensionLimit) {
           _conversations[convIdx].status = 'LOCKED';
        }
      }
    }

    const message = createMessage({
      conversationId,
      senderId,
      type: 'USER',
      content,
    });

    _messages.push(message);
    _conversations[convIdx].updatedAt = message.createdAt;

    return message;
  },

  async requestExtension(conversationId) {
    await delay(300);
    const convIdx = _conversations.findIndex(c => c.id === conversationId);
    if (convIdx === -1) throw new Error('Conversation not found');
    const conv = _conversations[convIdx];

    if (conv.extensionRequested) return conv;

    _conversations[convIdx].extensionRequested = true;
    
    // Add system message
    const sysMsg = createMessage({
      conversationId,
      senderId: 'SYSTEM',
      type: 'SYSTEM',
      content: 'Guest requested to continue this inquiry.',
    });
    _messages.push(sysMsg);
    _conversations[convIdx].updatedAt = sysMsg.createdAt;

    return _conversations[convIdx];
  },

  async approveExtension(conversationId) {
    await delay(300);
    const convIdx = _conversations.findIndex(c => c.id === conversationId);
    if (convIdx === -1) throw new Error('Conversation not found');

    _conversations[convIdx].extensionApproved = true;
    _conversations[convIdx].status = 'OPEN';
    
    const sysMsg = createMessage({
      conversationId,
      senderId: 'SYSTEM',
      type: 'SYSTEM',
      content: 'Host approved 3 more messages for this inquiry.',
    });
    _messages.push(sysMsg);
    _conversations[convIdx].updatedAt = sysMsg.createdAt;

    return _conversations[convIdx];
  }
};
