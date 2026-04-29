/**
 * EV-Net — Seed Data
 * 
 * Rich, realistic mock data for the Pakistani EV charging market.
 * All shapes follow src/data/schema.js definitions.
 * All pricing follows src/data/feeConfig.js rules.
 * 
 * This data powers the entire MVP frontend.
 */

import { UserRole, VerificationStatus, BookingStatus } from './schema.js';

// ─── Consistent Unsplash Images ─────────────────────────
// Dark/premium tone, consistent 16:9 aspect ratio, realistic charger/property shots

const CHARGER_IMAGES = {
  wallbox: 'https://images.unsplash.com/photo-1593941707882-a5bba14938cb?w=800&h=450&fit=crop',
  station: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=450&fit=crop',
  home: 'https://images.unsplash.com/photo-1620803588260-31afbb2720fb?w=800&h=450&fit=crop',
  garage: 'https://images.unsplash.com/photo-1647500636498-a9e7f84b35e2?w=800&h=450&fit=crop',
  parking: 'https://images.unsplash.com/photo-1633526543814-9718c8922b7a?w=800&h=450&fit=crop',
  driveway: 'https://images.unsplash.com/photo-1697441681690-2d16be62e73b?w=800&h=450&fit=crop',
};

const CHARGER_THUMBS = {
  wallbox2: 'https://images.unsplash.com/photo-1651055982498-7e3ba3ca8237?w=400&h=225&fit=crop',
  plug: 'https://images.unsplash.com/photo-1619317565853-87afb02b7b69?w=400&h=225&fit=crop',
  ev_parked: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=400&h=225&fit=crop',
  residential: 'https://images.unsplash.com/photo-1604014237800-1c9102c36684?w=400&h=225&fit=crop',
};

// Professional-looking but not stock-cheesy avatars
const AVATARS = {
  ahsan: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  fatima: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
  ali: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  sara: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  omar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  admin: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
};

// ─── USERS ──────────────────────────────────────────────

export const users = [
  {
    id: 'user_ali',
    email: 'ali@example.com',
    password: 'demo123',
    name: 'Ali Raza',
    phone: '+92 321 4567890',
    role: UserRole.USER,
    avatar: AVATARS.ali,
    evBrand: 'MG',
    evModel: 'ZS EV',
    connectorPreference: 'Type 2',
    emailVerified: true,
    phoneVerified: true,
    canBook: true,
    canOpenGoogleMaps: true,
    exactLocationUnlocked: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'user_sara',
    email: 'sara@example.com',
    password: 'demo123',
    name: 'Sara Malik',
    phone: '+92 300 1234567',
    role: UserRole.USER,
    avatar: AVATARS.sara,
    evBrand: 'BYD',
    evModel: 'Atto 3',
    connectorPreference: 'CCS2',
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'user_fatima_driver',
    email: 'fatima.driver@example.com',
    password: 'demo123',
    name: 'Fatima Noor',
    phone: '+92 333 9876543',
    role: UserRole.USER,
    avatar: AVATARS.fatima,
    evBrand: 'Honda',
    evModel: 'e:NP1',
    connectorPreference: 'Type 2',
    createdAt: '2026-02-10T10:00:00Z',
  },
  {
    id: 'host_ahsan',
    email: 'ahsan@example.com',
    password: 'demo123',
    name: 'Ahsan Qureshi',
    phone: '+92 300 5551234',
    role: UserRole.HOST,
    avatar: AVATARS.ahsan,
    evBrand: null,
    evModel: null,
    connectorPreference: null,
    createdAt: '2025-11-01T10:00:00Z',
  },
  {
    id: 'host_omar',
    email: 'omar@example.com',
    password: 'demo123',
    name: 'Omar Sheikh',
    phone: '+92 312 7778899',
    role: UserRole.HOST,
    avatar: AVATARS.omar,
    evBrand: null,
    evModel: null,
    connectorPreference: null,
    createdAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'admin_main',
    email: 'admin@EV-Net.pk',
    password: 'admin123',
    name: 'Zain Ahmed',
    phone: '+92 300 0000001',
    role: UserRole.ADMIN,
    avatar: AVATARS.admin,
    evBrand: null,
    evModel: null,
    connectorPreference: null,
    createdAt: '2025-10-01T10:00:00Z',
  },
  {
    id: 'user_verified',
    email: 'verified@example.com',
    password: 'demo123',
    name: 'Zain Ahmed',
    phone: '+92 300 1112223',
    role: UserRole.USER,
    avatar: AVATARS.omar,
    verificationStatus: VerificationStatus.APPROVED,
    emailVerified: true,
    phoneVerified: true,
    cnicSubmitted: true,
    evProofSubmitted: true,
    canBook: true,
    canOpenGoogleMaps: true,
    exactLocationUnlocked: true,
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'user_tester',
    email: 'tester@example.com',
    password: 'demo123',
    name: 'Test Driver',
    phone: '+92 345 6667778',
    role: UserRole.USER,
    avatar: AVATARS.admin,
    verificationStatus: VerificationStatus.APPROVED,
    emailVerified: true,
    phoneVerified: true,
    cnicSubmitted: true,
    evProofSubmitted: true,
    canBook: true,
    canOpenGoogleMaps: true,
    exactLocationUnlocked: true,
    createdAt: '2026-04-01T10:00:00Z',
  },
];

// ─── HOST PROFILES ──────────────────────────────────────

export const hostProfiles = [
  {
    userId: 'host_ahsan',
    verificationStatus: VerificationStatus.APPROVED,
    phoneVerified: true,
    identityVerified: true,
    propertyProofUploaded: true,
    chargerProofUploaded: true,
    payoutSetupComplete: true,
    onboardingStep: 6,
    moderationNotes: 'Verified. DHA property confirmed via utility bill. Charger spec confirmed.',
    createdAt: '2025-11-05T10:00:00Z',
  },
  {
    userId: 'host_omar',
    verificationStatus: VerificationStatus.PENDING,
    phoneVerified: true,
    identityVerified: true,
    propertyProofUploaded: true,
    chargerProofUploaded: false,
    payoutSetupComplete: false,
    onboardingStep: 3,
    moderationNotes: null,
    createdAt: '2025-12-20T10:00:00Z',
  },
];

// ─── LISTINGS ───────────────────────────────────────────

export const listings = [
  {
    id: 'listing_1',
    hostId: 'host_ahsan',
    title: 'DHA Phase 6 Fast Charger',
    description: 'Safe, gated driveway charger in DHA Phase 6, Lahore. Perfect for a quick top-up while you enjoy the neighborhood. Secure parking with CCTV surveillance. Plugs directly into standard EV ports. Wi-Fi available during your charging session.',
    address: 'House 42-B, Street 7, DHA Phase 6',
    city: 'Lahore',
    area: 'DHA Phase 6',
    lat: 31.5120,
    lng: 74.3600,
    chargerType: '22kW AC Type 2',
    chargerSpeed: '22kW',
    pricePerHour: 800,
    price_day_per_kwh: 35,
    price_night_per_kwh: 55,
    images: [CHARGER_IMAGES.wallbox, CHARGER_IMAGES.garage, CHARGER_THUMBS.plug, CHARGER_THUMBS.residential],
    amenities: ['WiFi Available', 'CCTV Security', 'Covered Parking', 'Drinking Water', 'Restroom Access'],
    houseRules: ['Park only in designated spot', 'No overnight charging without approval', 'Keep noise levels low', 'Pets not allowed in charging area'],
    isActive: true,
    isApproved: true,
    setupFeePaid: true,
    rating: 4.9,
    reviewCount: 24,
    sessionsCompleted: 87,
    createdAt: '2025-11-10T10:00:00Z',
  },
  {
    id: 'listing_2',
    hostId: 'host_ahsan',
    title: 'Gulberg Home Station',
    description: 'Convenient home charging station in the heart of Gulberg III. Easy access from Main Boulevard. AC Type 2 charger suitable for most EVs. Quiet residential area with good street lighting.',
    address: '15-A, Block L, Gulberg III',
    city: 'Lahore',
    area: 'Gulberg',
    lat: 31.5300,
    lng: 74.3400,
    chargerType: '7kW AC Type 2',
    chargerSpeed: '7kW',
    pricePerHour: 400,
    price_day_per_kwh: 40,
    price_night_per_kwh: 60,
    images: [CHARGER_IMAGES.home, CHARGER_IMAGES.driveway, CHARGER_THUMBS.ev_parked],
    amenities: ['Street Parking', 'Well-Lit Area', 'Near Main Boulevard'],
    houseRules: ['Maximum 4 hour sessions', 'Arrival within 15 min of booked time', 'No honking please'],
    isActive: true,
    isApproved: true,
    setupFeePaid: true,
    rating: 4.6,
    reviewCount: 15,
    sessionsCompleted: 42,
    createdAt: '2025-12-01T10:00:00Z',
  },
  {
    id: 'listing_3',
    hostId: 'host_ahsan',
    title: 'Johar Town DC Rapid',
    description: 'High-speed DC fast charging in Johar Town. Get 80% charge in under 45 minutes. Located in a commercial plaza parking area with easy access from Canal Road.',
    address: 'Plaza 7, Canal View, Johar Town',
    city: 'Lahore',
    area: 'Johar Town',
    lat: 31.4700,
    lng: 74.2800,
    chargerType: '50kW DC CCS2',
    chargerSpeed: '50kW',
    pricePerHour: 1200,
    price_day_per_kwh: 50,
    price_night_per_kwh: 75,
    images: [CHARGER_IMAGES.station, CHARGER_IMAGES.parking, CHARGER_THUMBS.wallbox2],
    amenities: ['DC Fast Charging', 'Commercial Area', 'Food Court Nearby', 'Easy Access from Canal Road'],
    houseRules: ['Move vehicle after charging completes', '60 minute max during peak hours (5-8 PM)'],
    isActive: true,
    isApproved: true,
    setupFeePaid: true,
    rating: 4.8,
    reviewCount: 31,
    sessionsCompleted: 156,
    createdAt: '2025-11-20T10:00:00Z',
  },
  {
    id: 'listing_4',
    hostId: 'host_omar',
    title: 'Model Town Residential Charger',
    description: 'Quiet residential charging in Model Town Extension. Standard AC charger, great for overnight or extended charging sessions. Beautiful garden setting.',
    address: '23-C, Block J, Model Town Extension',
    city: 'Lahore',
    area: 'Model Town',
    lat: 31.4900,
    lng: 74.3150,
    chargerType: '11kW AC Type 2',
    chargerSpeed: '11kW',
    pricePerHour: 550,
    price_day_per_kwh: 45,
    price_night_per_kwh: 65,
    images: [CHARGER_IMAGES.wallbox, CHARGER_IMAGES.driveway, CHARGER_THUMBS.plug],
    amenities: ['Garden Seating', 'Overnight Available', 'Quiet Area', 'Tea/Coffee Offered'],
    houseRules: ['Ring doorbell on arrival', 'No music/loud sounds', 'Children supervised at all times'],
    isActive: true,
    isApproved: false,
    setupFeePaid: true,
    rating: 4.5,
    reviewCount: 8,
    sessionsCompleted: 23,
    createdAt: '2026-01-05T10:00:00Z',
  },
  {
    id: 'listing_5',
    hostId: 'host_omar',
    title: 'Bahria Town Fast Station',
    description: 'Fast charging station in Bahria Town Lahore — Sector E. Located near the commercial area with plenty of shops and restaurants to pass the time.',
    address: 'Commercial Area, Sector E, Bahria Town',
    city: 'Lahore',
    area: 'Bahria Town',
    lat: 31.3700,
    lng: 74.1800,
    chargerType: '22kW AC Type 2',
    chargerSpeed: '22kW',
    pricePerHour: 750,
    price_day_per_kwh: 40,
    price_night_per_kwh: 60,
    images: [CHARGER_IMAGES.parking, CHARGER_IMAGES.station, CHARGER_THUMBS.wallbox2],
    amenities: ['Near Restaurants', 'Shopping Area', 'Guarded Parking', '22kW Fast AC'],
    houseRules: ['Park in marked EV spot only', 'Security guard will guide you'],
    isActive: false,
    isApproved: false,
    setupFeePaid: false,
    rating: 0,
    reviewCount: 0,
    sessionsCompleted: 0,
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'listing_6',
    hostId: 'host_ahsan',
    title: 'DHA Karachi Premium Charger',
    description: 'Premium home charging experience in DHA Phase 5, Karachi. Beachside neighborhood, secure gated community. Type 2 AC charger with dedicated EV parking.',
    address: 'Bungalow 14, Street 8, DHA Phase 5',
    city: 'Karachi',
    area: 'DHA Phase 5',
    lat: 24.8050,
    lng: 67.0350,
    chargerType: '22kW AC Type 2',
    chargerSpeed: '22kW',
    pricePerHour: 900,
    price_day_per_kwh: 45,
    price_night_per_kwh: 65,
    images: [CHARGER_IMAGES.garage, CHARGER_IMAGES.wallbox, CHARGER_THUMBS.plug],
    amenities: ['Gated Community', 'Dedicated EV Parking', 'Near Sea View', 'Security Guard'],
    houseRules: ['Follow community gate rules', 'Book at least 2 hours in advance'],
    isActive: true,
    isApproved: true,
    setupFeePaid: true,
    rating: 4.7,
    reviewCount: 11,
    sessionsCompleted: 34,
    createdAt: '2026-02-01T10:00:00Z',
  },
];

// ─── AVAILABILITY ───────────────────────────────────────

export const availability = [
  // Listing 1 — DHA Phase 6 (Mon-Sat, 8am-8pm)
  ...[1, 2, 3, 4, 5, 6].map(day => ({ id: `avail_1_${day}`, listingId: 'listing_1', dayOfWeek: day, startTime: '08:00', endTime: '20:00' })),
  // Listing 2 — Gulberg (Mon-Fri, 10am-6pm)
  ...[1, 2, 3, 4, 5].map(day => ({ id: `avail_2_${day}`, listingId: 'listing_2', dayOfWeek: day, startTime: '10:00', endTime: '18:00' })),
  // Listing 3 — Johar Town DC (Every day, 7am-10pm)
  ...[0, 1, 2, 3, 4, 5, 6].map(day => ({ id: `avail_3_${day}`, listingId: 'listing_3', dayOfWeek: day, startTime: '07:00', endTime: '22:00' })),
  // Listing 4 — Model Town (Wed-Sun, 9am-9pm)
  ...[0, 3, 4, 5, 6].map(day => ({ id: `avail_4_${day}`, listingId: 'listing_4', dayOfWeek: day, startTime: '09:00', endTime: '21:00' })),
  // Listing 6 — DHA Karachi (Fri-Sun, 10am-6pm)
  ...[0, 5, 6].map(day => ({ id: `avail_6_${day}`, listingId: 'listing_6', dayOfWeek: day, startTime: '10:00', endTime: '18:00' })),
];

// ─── BOOKINGS ───────────────────────────────────────────

export const bookings = [
  // Ali's bookings
  {
    id: 'booking_1', userId: 'user_ali', listingId: 'listing_1',
    date: '2026-04-03', startTime: '14:00', endTime: '16:00',
    status: BookingStatus.CONFIRMED, baseFee: 1600, serviceFee: 160, totalFee: 1760,
    createdAt: '2026-04-02T10:00:00Z',
  },
  {
    id: 'booking_2', userId: 'user_ali', listingId: 'listing_3',
    date: '2026-04-01', startTime: '09:00', endTime: '10:00',
    status: BookingStatus.COMPLETED, baseFee: 1200, serviceFee: 120, totalFee: 1320,
    createdAt: '2026-03-30T10:00:00Z',
  },
  {
    id: 'booking_3', userId: 'user_ali', listingId: 'listing_2',
    date: '2026-03-28', startTime: '12:00', endTime: '14:00',
    status: BookingStatus.COMPLETED, baseFee: 800, serviceFee: 80, totalFee: 880,
    createdAt: '2026-03-27T10:00:00Z',
  },
  {
    id: 'booking_4', userId: 'user_ali', listingId: 'listing_1',
    date: '2026-03-20', startTime: '10:00', endTime: '12:00',
    status: BookingStatus.CANCELLED, baseFee: 1600, serviceFee: 160, totalFee: 1760,
    createdAt: '2026-03-19T10:00:00Z',
  },

  // Sara's bookings
  {
    id: 'booking_5', userId: 'user_sara', listingId: 'listing_1',
    date: '2026-04-04', startTime: '09:00', endTime: '11:00',
    status: BookingStatus.PENDING, baseFee: 1600, serviceFee: 160, totalFee: 1760,
    createdAt: '2026-04-03T08:00:00Z',
  },
  {
    id: 'booking_6', userId: 'user_sara', listingId: 'listing_3',
    date: '2026-03-25', startTime: '15:00', endTime: '16:00',
    status: BookingStatus.COMPLETED, baseFee: 1200, serviceFee: 120, totalFee: 1320,
    createdAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'booking_7', userId: 'user_sara', listingId: 'listing_2',
    date: '2026-03-15', startTime: '10:00', endTime: '13:00',
    status: BookingStatus.COMPLETED, baseFee: 1200, serviceFee: 120, totalFee: 1320,
    createdAt: '2026-03-14T10:00:00Z',
  },

  // Fatima's bookings
  {
    id: 'booking_8', userId: 'user_fatima_driver', listingId: 'listing_1',
    date: '2026-04-05', startTime: '16:00', endTime: '18:00',
    status: BookingStatus.CONFIRMED, baseFee: 1600, serviceFee: 160, totalFee: 1760,
    createdAt: '2026-04-03T12:00:00Z',
  },
  {
    id: 'booking_9', userId: 'user_fatima_driver', listingId: 'listing_6',
    date: '2026-04-06', startTime: '11:00', endTime: '13:00',
    status: BookingStatus.PENDING, baseFee: 1800, serviceFee: 180, totalFee: 1980,
    createdAt: '2026-04-03T14:00:00Z',
  },
  {
    id: 'booking_10', userId: 'user_fatima_driver', listingId: 'listing_3',
    date: '2026-03-22', startTime: '08:00', endTime: '09:00',
    status: BookingStatus.COMPLETED, baseFee: 1200, serviceFee: 120, totalFee: 1320,
    createdAt: '2026-03-21T10:00:00Z',
  },

  // More completed bookings for stats
  {
    id: 'booking_11', userId: 'user_ali', listingId: 'listing_6',
    date: '2026-03-10', startTime: '10:00', endTime: '12:00',
    status: BookingStatus.COMPLETED, baseFee: 1800, serviceFee: 180, totalFee: 1980,
    createdAt: '2026-03-09T10:00:00Z',
  },
  {
    id: 'booking_12', userId: 'user_sara', listingId: 'listing_1',
    date: '2026-03-05', startTime: '14:00', endTime: '16:00',
    status: BookingStatus.COMPLETED, baseFee: 1600, serviceFee: 160, totalFee: 1760,
    createdAt: '2026-03-04T10:00:00Z',
  },
  {
    id: 'booking_13', userId: 'user_ali', listingId: 'listing_3',
    date: '2026-02-28', startTime: '11:00', endTime: '12:00',
    status: BookingStatus.COMPLETED, baseFee: 1200, serviceFee: 120, totalFee: 1320,
    createdAt: '2026-02-27T10:00:00Z',
  },
  {
    id: 'booking_14', userId: 'user_fatima_driver', listingId: 'listing_2',
    date: '2026-02-20', startTime: '10:00', endTime: '12:00',
    status: BookingStatus.COMPLETED, baseFee: 800, serviceFee: 80, totalFee: 880,
    createdAt: '2026-02-19T10:00:00Z',
  },
  {
    id: 'booking_15', userId: 'user_sara', listingId: 'listing_6',
    date: '2026-02-15', startTime: '12:00', endTime: '14:00',
    status: BookingStatus.COMPLETED, baseFee: 1800, serviceFee: 180, totalFee: 1980,
    createdAt: '2026-02-14T10:00:00Z',
  },
  // Zain's confirmed booking for Listing 1 (to test location unlock)
  {
    id: 'booking_verified_test', userId: 'user_verified', listingId: 'listing_1',
    date: '2026-04-10', startTime: '10:00', endTime: '12:00',
    status: BookingStatus.CONFIRMED, baseFee: 1600, serviceFee: 160, totalFee: 1760,
    createdAt: '2026-04-08T10:00:00Z',
  },
  // Tester's confirmed booking for Listing 3 (Johar Town)
  {
    id: 'booking_tester_test', userId: 'user_tester', listingId: 'listing_3',
    date: '2026-04-12', startTime: '15:00', endTime: '16:00',
    status: BookingStatus.CONFIRMED, baseFee: 1200, serviceFee: 120, totalFee: 1320,
    createdAt: '2026-04-08T11:00:00Z',
  },
];

// ─── REVIEWS ────────────────────────────────────────────

export const reviews = [
  {
    id: 'review_1', authorId: 'user_ali', listingId: 'listing_1',
    rating: 5, comment: 'Excellent experience! Charger was fast, location was safe, and Ahsan was very helpful. Will definitely book again.',
    createdAt: '2026-03-21T10:00:00Z',
  },
  {
    id: 'review_2', authorId: 'user_sara', listingId: 'listing_1',
    rating: 5, comment: 'Best charging spot in DHA. Clean, secure, and the WiFi is a nice bonus. My Atto 3 charged up in no time.',
    createdAt: '2026-03-06T10:00:00Z',
  },
  {
    id: 'review_3', authorId: 'user_fatima_driver', listingId: 'listing_1',
    rating: 5, comment: 'Super convenient! The host even offered tea while I waited. Very hospitable setup.',
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'review_4', authorId: 'user_ali', listingId: 'listing_3',
    rating: 5, comment: 'The DC fast charger is a game changer. Got to 80% in about 40 minutes. Great location near Canal Road.',
    createdAt: '2026-04-01T12:00:00Z',
  },
  {
    id: 'review_5', authorId: 'user_sara', listingId: 'listing_3',
    rating: 4, comment: 'Fast charging, good location. Only issue was parking was a bit tight during lunch hours.',
    createdAt: '2026-03-26T10:00:00Z',
  },
  {
    id: 'review_6', authorId: 'user_fatima_driver', listingId: 'listing_3',
    rating: 5, comment: 'This is the fastest charger I have used in Lahore. Highly recommended for long trips.',
    createdAt: '2026-03-23T10:00:00Z',
  },
  {
    id: 'review_7', authorId: 'user_ali', listingId: 'listing_2',
    rating: 4, comment: 'Good value for money. The 7kW charger is slow but perfect for longer stays. Nice neighborhood.',
    createdAt: '2026-03-29T10:00:00Z',
  },
  {
    id: 'review_8', authorId: 'user_sara', listingId: 'listing_2',
    rating: 5, comment: 'Love the Gulberg location — parked, charged, and walked to MM Alam Road for shopping. Perfect combo!',
    createdAt: '2026-03-16T10:00:00Z',
  },
  {
    id: 'review_9', authorId: 'user_ali', listingId: 'listing_6',
    rating: 5, comment: 'Premium experience in DHA Karachi. The gated community feel makes it very secure. Great host.',
    createdAt: '2026-03-11T10:00:00Z',
  },
  {
    id: 'review_10', authorId: 'user_sara', listingId: 'listing_6',
    rating: 4, comment: 'Good charger but weekend-only availability is limiting. Would love to see more weekday slots.',
    createdAt: '2026-02-16T10:00:00Z',
  },
  {
    id: 'review_11', authorId: 'user_fatima_driver', listingId: 'listing_2',
    rating: 5, comment: 'Charged my Honda e:NP1 here twice now. Reliable, no issues. The host is responsive.',
    createdAt: '2026-02-21T10:00:00Z',
  },
  {
    id: 'review_12', authorId: 'user_fatima_driver', listingId: 'listing_4',
    rating: 4, comment: 'Nice garden setting in Model Town. Tea was a wonderful touch. Charger worked perfectly.',
    createdAt: '2026-01-25T10:00:00Z',
  },
];

// ─── NOTIFICATIONS ──────────────────────────────────────

export const notifications = [
  { id: 'notif_1', userId: 'user_ali', type: 'BOOKING_UPDATE', message: 'Your booking at DHA Phase 6 Fast Charger has been confirmed for April 3rd, 2:00 PM.', isRead: false, createdAt: '2026-04-02T10:30:00Z' },
  { id: 'notif_2', userId: 'user_ali', type: 'SYSTEM', message: 'Welcome to EV-Net! Explore nearby chargers and book your first session.', isRead: true, createdAt: '2026-01-15T10:00:00Z' },
  { id: 'notif_3', userId: 'host_ahsan', type: 'BOOKING_UPDATE', message: 'New booking request from Sara Malik for DHA Phase 6 Fast Charger on April 4th.', isRead: false, createdAt: '2026-04-03T08:05:00Z' },
  { id: 'notif_4', userId: 'host_ahsan', type: 'PAYMENT', message: 'Payout of PKR 12,400 has been processed to your bank account.', isRead: true, createdAt: '2026-03-31T10:00:00Z' },
  { id: 'notif_5', userId: 'host_omar', type: 'VERIFICATION', message: 'Your charger photo is still pending. Upload it to complete verification.', isRead: false, createdAt: '2026-04-01T10:00:00Z' },
  { id: 'notif_6', userId: 'user_sara', type: 'BOOKING_UPDATE', message: 'Your booking at DHA Phase 6 Fast Charger is pending host confirmation.', isRead: false, createdAt: '2026-04-03T08:00:00Z' },
];

// ─── HELPER: Get data by ID ─────────────────────────────

export function getUserById(id) {
  return users.find(u => u.id === id) || null;
}

export function getListingById(id) {
  return listings.find(l => l.id === id) || null;
}

export function getHostProfile(userId) {
  return hostProfiles.find(h => h.userId === userId) || null;
}

export function getListingsByHost(hostId) {
  return listings.filter(l => l.hostId === hostId);
}

export function getBookingsByUser(userId) {
  return bookings.filter(b => b.userId === userId);
}

export function getBookingsByHost(hostId) {
  const hostListingIds = listings.filter(l => l.hostId === hostId).map(l => l.id);
  return bookings.filter(b => hostListingIds.includes(b.listingId));
}

export function getReviewsByListing(listingId) {
  return reviews.filter(r => r.listingId === listingId);
}

export function getAvailabilityByListing(listingId) {
  return availability.filter(a => a.listingId === listingId);
}

// ─── CONVERSATIONS & MESSAGES ───────────────────────────

export const conversations = [
  {
    id: 'conv_1', listingId: 'listing_1', userId: 'user_ali', hostId: 'host_ahsan',
    bookingId: null, type: 'INQUIRY', status: 'OPEN', messageCount: 1,
    createdAt: '2026-04-09T08:00:00Z', updatedAt: '2026-04-09T08:15:00Z',
  },
  {
    id: 'conv_2', listingId: 'listing_3', userId: 'user_sara', hostId: 'host_ahsan',
    bookingId: 'booking_6', type: 'BOOKING', status: 'ARCHIVED', messageCount: 4,
    createdAt: '2026-03-24T10:00:00Z', updatedAt: '2026-03-25T16:00:00Z',
  }
];

export const messages = [
  { id: 'msg_1', conversationId: 'conv_1', senderId: 'user_ali', type: 'USER', content: 'Hi Ahsan, is your driveway easy to access with a wider SUV?', isRead: true, createdAt: '2026-04-09T08:00:00Z' },
  { id: 'msg_2', conversationId: 'conv_1', senderId: 'host_ahsan', type: 'USER', content: 'Yes, no problem. The gate opens fully and there is plenty of turning radius.', isRead: false, createdAt: '2026-04-09T08:15:00Z' },
  { id: 'msg_3', conversationId: 'conv_2', senderId: 'SYSTEM', type: 'SYSTEM', content: 'Booking Confirmed. Chat is now open.', isRead: true, createdAt: '2026-03-24T10:00:00Z' },
  { id: 'msg_4', conversationId: 'conv_2', senderId: 'user_sara', type: 'USER', content: 'I should be arriving right at 3 PM today.', isRead: true, createdAt: '2026-03-25T14:00:00Z' },
  { id: 'msg_5', conversationId: 'conv_2', senderId: 'host_ahsan', type: 'USER', content: 'Great, the spot is empty and waiting for you.', isRead: true, createdAt: '2026-03-25T14:10:00Z' },
  { id: 'msg_6', conversationId: 'conv_2', senderId: 'SYSTEM', type: 'SYSTEM', content: 'Booking Completed. Chat is archived.', isRead: true, createdAt: '2026-03-25T16:00:00Z' }
];

export const messageReports = [];
export const moderationReviews = [];
export const disputes = [];
