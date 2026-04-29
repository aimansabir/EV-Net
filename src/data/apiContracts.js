/**
 * EV-Net — API Contracts & Supabase Blueprint
 * 
 * This file documents all API endpoints, their request/response shapes,
 * and the Supabase infrastructure needed to implement them.
 * 
 * CANONICAL REFERENCE for backend implementation.
 */

// ═══════════════════════════════════════════════════════
// SUPABASE TABLE PLAN
// ═══════════════════════════════════════════════════════

export const SUPABASE_TABLES = {
  users: {
    columns: 'id (uuid, PK, default gen_random_uuid()), email (text, unique, not null), name (text, not null), phone (text), role (text, default USER, check USER/HOST/ADMIN), avatar_url (text), ev_brand (text), ev_model (text), connector_preference (text), created_at (timestamptz, default now()), updated_at (timestamptz, default now())',
    notes: 'Auth handled by Supabase Auth. This table extends auth.users via user_id FK.',
  },
  host_profiles: {
    columns: 'user_id (uuid, PK, FK users.id), verification_status (text, default draft, check draft/pending/approved/rejected), phone_verified (bool, default false), identity_verified (bool, default false), property_proof_uploaded (bool, default false), charger_proof_uploaded (bool, default false), payout_setup_complete (bool, default false), onboarding_step (int, default 0), moderation_notes (text), created_at (timestamptz)',
    notes: 'One-to-one with users where role=HOST.',
  },
  listings: {
    columns: 'id (uuid, PK), host_id (uuid, FK users.id, not null), title (text, not null), description (text), address (text), city (text), area (text), lat (float8), lng (float8), charger_type (text), charger_speed (text), price_per_hour (numeric, [LEGACY]), price_day_per_kwh (numeric), price_night_per_kwh (numeric), images (text[]), amenities (text[]), house_rules (text[]), is_active (bool, default false), is_approved (bool, default false), setup_fee_paid (bool, default false), rating (numeric, default 0), review_count (int, default 0), sessions_completed (int, default 0), created_at (timestamptz), updated_at (timestamptz)',
  },
  availability: {
    columns: 'id (uuid, PK), listing_id (uuid, FK listings.id), day_of_week (int, check 0-6), start_time (text), end_time (text)',
    notes: 'Recurring weekly schedule per listing.',
  },
  bookings: {
    columns: 'id (uuid, PK), user_id (uuid, FK users.id), listing_id (uuid, FK listings.id), date (date), start_time (text), end_time (text), status (text, check PENDING/CONFIRMED/COMPLETED/CANCELLED), vehicle_size (text), estimated_kwh (numeric), pricing_band (text), base_fee (numeric), user_service_fee (numeric), host_platform_fee (numeric), gateway_fee (numeric), total_fee (numeric), host_payout (numeric), created_at (timestamptz)',
  },
  reviews: {
    columns: 'id (uuid, PK), author_id (uuid, FK users.id), listing_id (uuid, FK listings.id), rating (int, check 1-5), comment (text), created_at (timestamptz)',
  },
  payments: {
    columns: 'id (uuid, PK), amount (numeric), type (text, check BOOKING/ACTIVATION_FEE/PAYOUT), status (text, check PENDING/COMPLETED/FAILED), reference_id (text), created_at (timestamptz)',
  },
  notifications: {
    columns: 'id (uuid, PK), user_id (uuid, FK users.id), type (text), message (text), is_read (bool, default false), created_at (timestamptz)',
  },
  verification_submissions: {
    columns: 'id (uuid, PK), user_id (uuid, FK users.id), profile_type (text, check USER/HOST), document_type (text, e.g. CNIC_FRONT, EV_PROOF), storage_path (text), status (text, default PENDING), submitted_at (timestamptz, default now()), admin_note (text), reviewed_at (timestamptz), reviewed_by (uuid, FK users.id)',
    notes: 'Normalized table for all document-based verifications.',
  },
};

// ═══════════════════════════════════════════════════════
// RLS (Row Level Security) POLICY PLAN
// ═══════════════════════════════════════════════════════

export const RLS_POLICIES = {
  users: [
    'SELECT: Users can read own profile. Admins can read all.',
    'UPDATE: Users can update own profile.',
  ],
  host_profiles: [
    'SELECT: Host can read own profile. Admins can read all.',
    'UPDATE: Admins can update verification_status and moderation_notes.',
    'INSERT: Only when user.role = HOST.',
  ],
  listings: [
    'SELECT: Active+approved listings readable by all authenticated users.',
    'SELECT: Host can read own listings regardless of status.',
    'SELECT: Admins can read all.',
    'INSERT: Only hosts with role=HOST.',
    'UPDATE: Host can update own. Admin can update is_approved/is_active.',
    'DELETE: Host can delete own draft listings.',
  ],
  bookings: [
    'SELECT: User can read own bookings. Host can read bookings for their listings. Admin all.',
    'INSERT: Authenticated users only. Validate no self-booking via Edge Function.',
    'UPDATE: Status changes handled via Edge Function with validation.',
  ],
  reviews: [
    'SELECT: All authenticated users can read reviews.',
    'INSERT: Only users who have a COMPLETED booking for the listing.',
  ],
};

// ═══════════════════════════════════════════════════════
// STORAGE BUCKET PLAN
// ═══════════════════════════════════════════════════════

export const STORAGE_BUCKETS = {
  avatars: { public: true, maxSize: '2MB', allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  listing_images: { public: true, maxSize: '5MB', allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  verification_documents: { public: false, maxSize: '10MB', allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'], notes: 'Only accessible by uploading host and admins.' },
};

// ═══════════════════════════════════════════════════════
// AUTH ROLE MAPPING
// ═══════════════════════════════════════════════════════

export const AUTH_ROLE_MAPPING = {
  signup_user: 'Creates auth.users entry + public.users with role=USER',
  signup_host: 'Creates auth.users entry + public.users with role=HOST + public.host_profiles with status=draft',
  login: 'Supabase Auth handles JWT. Frontend reads role from public.users.',
  jwt_claims: 'Custom claims via Supabase hook: { role, user_id } added to JWT for RLS.',
};

// ═══════════════════════════════════════════════════════
// EDGE FUNCTION LIST
// ═══════════════════════════════════════════════════════

export const EDGE_FUNCTIONS = [
  {
    name: 'create-booking',
    method: 'POST',
    description: 'Validates slot availability, prevents double-booking, prevents self-booking, calculates fees using feeConfig, creates booking record.',
    inputs: '{ p_listing_id, p_date, p_start_time, p_end_time, p_vehicle_size }',
    outputs: '{ booking }',
  },
  {
    name: 'update-booking-status',
    method: 'PATCH',
    description: 'Host confirms/cancels. Validates ownership. Updates booking status.',
    inputs: '{ booking_id, status }',
    outputs: '{ booking }',
  },
  {
    name: 'submit-host-verification',
    method: 'POST',
    description: 'Sets host_profile verification_status to pending. Validates all required fields are complete.',
    inputs: '{ user_id }',
    outputs: '{ host_profile }',
  },
  {
    name: 'admin-review-listing',
    method: 'PATCH',
    description: 'Admin approves/rejects listing. Sets is_approved, optionally activates listing.',
    inputs: '{ listing_id, approved, notes? }',
    outputs: '{ listing }',
  },
  {
    name: 'admin-verify-host',
    method: 'PATCH',
    description: 'Admin approves/rejects host. Updates verification_status and moderation_notes.',
    inputs: '{ user_id, approved, notes? }',
    outputs: '{ host_profile }',
  },
  {
    name: 'generate-slots',
    method: 'GET',
    description: 'Given a listing + date, generates hourly time slots from availability, marking booked ones.',
    inputs: '?listing_id&date',
    outputs: '{ slots[] }',
  },
  {
    name: 'host-dashboard',
    method: 'GET',
    description: 'Aggregates host stats: earnings, bookings, sessions, ratings.',
    inputs: 'JWT (host user)',
    outputs: '{ totalEarnings, activeBookings, sessions, listings, upcomingBookings }',
  },
  {
    name: 'host-earnings',
    method: 'GET',
    description: 'Monthly earnings breakdown with payout and commission calculations using feeConfig.',
    inputs: 'JWT (host user)',
    outputs: '{ totalRevenue, totalPayout, byMonth }',
  },
];

// ═══════════════════════════════════════════════════════
// REST API ENDPOINT CONTRACTS
// ═══════════════════════════════════════════════════════

export const API_ENDPOINTS = {
  // Auth
  'POST /api/auth/signup-user': { body: '{ name, email, password, phone, evBrand, evModel, connectorPreference }', response: '{ user, session }', auth: 'none' },
  'POST /api/auth/signup-host': { body: '{ name, email, password, phone }', response: '{ user, hostProfile, session }', auth: 'none' },
  'POST /api/auth/login': { body: '{ email, password }', response: '{ user, session }', auth: 'none' },
  'GET /api/auth/me': { response: '{ user }', auth: 'JWT' },

  // Listings
  'GET /api/listings': { query: '?city&chargerType&maxPrice&search&isActive&isApproved', response: '{ listings[] }', auth: 'JWT' },
  'GET /api/listings/:id': { response: '{ listing, host, hostProfile, reviews[], availability[] }', auth: 'JWT' },
  'POST /api/listings': { body: '{ title, description, address, city, area, lat, lng, chargerType, chargerSpeed, priceDay, priceNight, images, amenities, houseRules }', auth: 'JWT (host)' },
  'PATCH /api/listings/:id': { body: 'partial listing fields', auth: 'JWT (owner host)' },
  'DELETE /api/listings/:id': { auth: 'JWT (owner host)' },

  // Availability
  'GET /api/listings/:id/availability': { response: '{ availability[] }', auth: 'JWT' },
  'POST /api/listings/:id/availability': { body: '{ schedules: [{ dayOfWeek, startTime, endTime }] }', auth: 'JWT (owner host)' },
  'GET /api/listings/:id/slots?date=': { response: '{ slots[] }', auth: 'JWT', notes: 'Edge Function: generate-slots' },

  // Bookings
  'POST /api/bookings': { body: '{ listingId, date, startTime, endTime, vehicleSize }', auth: 'JWT (user)', notes: 'Edge Function: create-booking' },
  'GET /api/bookings/me': { response: '{ bookings[] }', auth: 'JWT (user)' },
  'PATCH /api/bookings/:id/status': { body: '{ status }', auth: 'JWT (host/admin)', notes: 'Edge Function: update-booking-status' },

  // Host
  'GET /api/host/dashboard': { auth: 'JWT (host)', notes: 'Edge Function: host-dashboard' },
  'GET /api/host/listings': { auth: 'JWT (host)' },
  'GET /api/host/bookings': { auth: 'JWT (host)' },
  'GET /api/host/earnings': { auth: 'JWT (host)', notes: 'Edge Function: host-earnings' },
  'POST /api/host/verification': { auth: 'JWT (host)', notes: 'Edge Function: submit-host-verification' },

  // Admin
  'GET /api/admin/listings': { auth: 'JWT (admin)' },
  'GET /api/admin/users': { auth: 'JWT (admin)' },
  'GET /api/admin/bookings': { auth: 'JWT (admin)' },
  'PATCH /api/admin/listings/:id/review': { body: '{ approved, notes? }', auth: 'JWT (admin)', notes: 'Edge Function: admin-review-listing' },
  'PATCH /api/admin/hosts/:id/verification': { body: '{ approved, notes? }', auth: 'JWT (admin)', notes: 'Edge Function: admin-verify-host' },
};
