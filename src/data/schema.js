/**
 * EV-Net — Canonical Data Schema
 * 
 * This is the SINGLE SOURCE OF TRUTH for all data shapes.
 * Both the mock service layer and future Supabase integration
 * must follow these definitions exactly.
 * 
 * When wiring Supabase, these become your table column definitions.
 */

// ─── Enums ──────────────────────────────────────────────

export const UserRole = {
  USER: 'USER',
  HOST: 'HOST',
  ADMIN: 'ADMIN',
};

export const VerificationStatus = {
  DRAFT: 'draft',
  PENDING_DOCS: 'pending_docs',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const PaymentType = {
  BOOKING: 'BOOKING',
  ACTIVATION_FEE: 'ACTIVATION_FEE',
  PAYOUT: 'PAYOUT',
};

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const NotificationType = {
  SYSTEM: 'SYSTEM',
  BOOKING_UPDATE: 'BOOKING_UPDATE',
  BOOKING_SUBMITTED: 'BOOKING_SUBMITTED',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  BOOKING_STATUS_UPDATE: 'BOOKING_STATUS_UPDATE',
  PAYMENT: 'PAYMENT',
  VERIFICATION: 'VERIFICATION',
  MESSAGE: 'MESSAGE',
};

export const ChargerType = {
  AC_7KW: '7kW AC Type 2',
  AC_11KW: '11kW AC Type 2',
  AC_22KW: '22kW AC Type 2',
  DC_50KW: '50kW DC CCS2',
  THREE_PIN: 'Standard 3-Pin Socket',
};

export const ConnectorType = {
  TYPE_2: 'Type 2',
  CCS2: 'CCS2',
  GBT: 'GB/T',
  THREE_PIN: '3-Pin',
};

export const ConversationType = {
  INQUIRY: 'INQUIRY',
  BOOKING: 'BOOKING',
};

export const ConversationStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  FLAGGED: 'FLAGGED',
  LOCKED: 'LOCKED',
  ARCHIVED: 'ARCHIVED',
};

export const MessageType = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
};

export const ReportStatus = {
  PENDING: 'PENDING',
  REVIEWING: 'REVIEWING',
  RESOLVED: 'RESOLVED',
};

// ─── Schema Shapes (JSDoc for IDE support) ──────────────

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} password - hashed in production
 * @property {string} name
 * @property {string} phone
 * @property {'USER'|'HOST'|'ADMIN'} role
 * @property {string} avatar - URL
 * @property {string|null} evBrand - EV Users only
 * @property {string|null} evModel - EV Users only
 * @property {string|null} connectorPreference - EV Users only
 * @property {string} createdAt - ISO string
 * @property {'draft'|'pending_docs'|'under_review'|'approved'|'rejected'} verificationStatus
 * @property {boolean} emailVerified
 * @property {boolean} phoneVerified
 * @property {boolean} cnicSubmitted
 * @property {boolean} evProofSubmitted
 * @property {boolean} canBook
 * @property {boolean} exactLocationUnlocked
 * @property {boolean} isRestrictedFromInquiry
 * @property {string|null} avatarPath
 * @property {boolean} isSuspended
 * @property {'email'|'google'} authProvider
 */

/**
 * @typedef {Object} HostProfile
 * @property {string} userId
 * @property {'draft'|'pending_docs'|'under_review'|'approved'|'rejected'} verificationStatus
 * @property {boolean} emailVerified
 * @property {boolean} phoneVerified
 * @property {boolean} cnicSubmitted
 * @property {boolean} propertyProofUploaded
 * @property {boolean} chargerProofUploaded
 * @property {boolean} payoutSetupComplete
 * @property {number} onboardingStep - 0-6
 * @property {string|null} moderationNotes - admin notes
 * @property {string|null} avatarPath
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Listing
 * @property {string} id
 * @property {string} hostId
 * @property {string} title
 * @property {string} description
 * @property {string} address
 * @property {string} city
 * @property {string} area
 * @property {number} lat
 * @property {number} lng
 * @property {string} chargerType - one of ChargerType values
 * @property {string} chargerSpeed - e.g. "22kW"
 * @property {number} pricePerHour - PKR
 * @property {string[]} images - URLs
 * @property {string[]} amenities
 * @property {string[]} houseRules
 * @property {boolean} isActive
 * @property {boolean} isApproved - admin moderation
 * @property {boolean} setupFeePaid - host verification fee
 * @property {number} rating - 1-5
 * @property {number} reviewCount
 * @property {number} sessionsCompleted
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Availability
 * @property {string} id
 * @property {string} listingId
 * @property {number} dayOfWeek - 0 (Sun) to 6 (Sat)
 * @property {string} startTime - "09:00"
 * @property {string} endTime - "17:00"
 */

/**
 * @typedef {Object} TimeSlot
 * @property {string} id
 * @property {string} listingId
 * @property {string} date - "2026-04-05"
 * @property {string} startTime - "14:00"
 * @property {string} endTime - "15:00"
 * @property {boolean} isBooked
 */

/**
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} userId
 * @property {string} listingId
 * @property {string} date - "2026-04-05"
 * @property {string} startTime - "14:00"
 * @property {string} endTime - "16:00"
 * @property {'PENDING'|'CONFIRMED'|'COMPLETED'|'CANCELLED'} status
 * @property {string} vehicleSize - SMALL, MEDIUM, or LARGE
 * @property {string} pricingBand - DAY or NIGHT
 * @property {number} estimatedKwh
 * @property {number} baseCharge - PKR
 * @property {number} userServiceFee - PKR
 * @property {number} hostPlatformFee - PKR
 * @property {number} gatewayFee - PKR
 * @property {number} userTotal - PKR
 * @property {number} hostPayout - PKR
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Review
 * @property {string} id
 * @property {string} authorId
 * @property {string} listingId
 * @property {number} rating - 1-5
 * @property {string} comment
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {number} amount
 * @property {'BOOKING'|'ACTIVATION_FEE'|'PAYOUT'} type
 * @property {'PENDING'|'COMPLETED'|'FAILED'} status
 * @property {string} referenceId
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} userId
 * @property {'SYSTEM'|'BOOKING_UPDATE'|'PAYMENT'|'VERIFICATION'} type
 * @property {string} message
 * @property {boolean} isRead
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string} listingId
 * @property {string} userId - EV Driver
 * @property {string} hostId
 * @property {string|null} bookingId - null if Inquiry
 * @property {'INQUIRY'|'BOOKING'} type
 * @property {'OPEN'|'CLOSED'|'FLAGGED'|'LOCKED'|'ARCHIVED'} status
 * @property {number} messageCount - user-originated messages
 * @property {boolean} extensionRequested - one-time request flag
 * @property {boolean} extensionApproved - host approved flag
 * @property {number} extensionLimit - extra messages allowed (usually 3)
 * @property {number} extensionCount - extra user messages sent
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} conversationId
 * @property {string} senderId - userId, hostId, or 'SYSTEM'
 * @property {'USER'|'SYSTEM'} type
 * @property {string} content
 * @property {boolean} isRead
 * @property {string} createdAt
 */

/**
 * @typedef {Object} MessageReport
 * @property {string} id
 * @property {string} conversationId
 * @property {string} messageId
 * @property {string} reporterId
 * @property {string} reason
 * @property {'PENDING'|'REVIEWING'|'RESOLVED'} status
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ModerationReview
 * @property {string} id
 * @property {string} targetId - messageId, conversationId, listingId, userId
 * @property {string} adminId
 * @property {string} actionTaken - e.g., 'WARN_USER', 'RESTRICT_INQUIRY', 'CLOSE_THREAD', 'ESCALATE_TO_DISPUTE', 'SUSPEND_ACCOUNT'
 * @property {string} notes
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Dispute
 * @property {string} id
 * @property {string} bookingId
 * @property {string} userOrHostId
 * @property {string} reason
 * @property {'PENDING'|'INITIALIZING'|'UNDER_REVIEW'|'RESOLVED'} status
 * @property {string} adminNotes
 * @property {string} createdAt
 */

// ─── Schema Factories (for creating new records) ────────

let _idCounter = 1000;
const generateId = () => `cbnb_${Date.now()}_${_idCounter++}`;

export const createUser = (overrides = {}) => ({
  id: generateId(),
  email: '',
  password: '',
  name: '',
  phone: '',
  role: UserRole.USER,
  avatar: '',
  evBrand: null,
  evModel: null,
  connectorPreference: null,
  verificationStatus: VerificationStatus.DRAFT,
  emailVerified: false,
  phoneVerified: false,
  cnicSubmitted: false,
  evProofSubmitted: false,
  canBook: false,
  exactLocationUnlocked: false,
  isRestrictedFromInquiry: false,
  avatarPath: null,
  isSuspended: false,
  authProvider: 'email',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createHostProfile = (overrides = {}) => ({
  userId: '',
  verificationStatus: VerificationStatus.DRAFT,
  emailVerified: false,
  phoneVerified: false,
  cnicSubmitted: false,
  propertyProofUploaded: false,
  chargerProofUploaded: false,
  payoutSetupComplete: false,
  onboardingStep: 0,
  moderationNotes: null,
  avatarPath: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createListing = (overrides = {}) => ({
  id: generateId(),
  hostId: '',
  title: '',
  description: '',
  address: '',
  city: '',
  area: '',
  lat: 0,
  lng: 0,
  chargerType: ChargerType.AC_7KW,
  chargerSpeed: '7kW',
  pricePerHour: 0, // LEGACY
  price_day_per_kwh: 40,
  price_night_per_kwh: 60,
  images: [],
  amenities: [],
  houseRules: [],
  isActive: false,
  isApproved: false,
  setupFeePaid: false,
  rating: 0,
  reviewCount: 0,
  sessionsCompleted: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createBooking = (overrides = {}) => ({
  id: generateId(),
  userId: '',
  listingId: '',
  date: '',
  startTime: '',
  endTime: '',
  status: BookingStatus.PENDING,
  vehicleSize: 'SMALL',
  pricingBand: 'DAY',
  estimatedKwh: 0,
  baseCharge: 0,
  userServiceFee: 0,
  hostPlatformFee: 0,
  gatewayFee: 0,
  userTotal: 0,
  hostPayout: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createReview = (overrides = {}) => ({
  id: generateId(),
  authorId: '',
  listingId: '',
  rating: 5,
  comment: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createNotification = (overrides = {}) => ({
  id: generateId(),
  userId: '',
  type: NotificationType.SYSTEM,
  message: '',
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createConversation = (overrides = {}) => ({
  id: generateId(),
  listingId: '',
  userId: '',
  hostId: '',
  bookingId: null,
  type: ConversationType.INQUIRY,
  status: ConversationStatus.OPEN,
  messageCount: 0,
  extensionRequested: false,
  extensionApproved: false,
  extensionLimit: 3,
  extensionCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMessage = (overrides = {}) => ({
  id: generateId(),
  conversationId: '',
  senderId: '',
  type: MessageType.USER,
  content: '',
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMessageReport = (overrides = {}) => ({
  id: generateId(),
  conversationId: '',
  messageId: '',
  reporterId: '',
  reason: '',
  status: ReportStatus.PENDING,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createModerationReview = (overrides = {}) => ({
  id: generateId(),
  targetId: '',
  adminId: '',
  actionTaken: '',
  notes: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createDispute = (overrides = {}) => ({
  id: generateId(),
  bookingId: '',
  userOrHostId: '',
  reason: '',
  status: 'PENDING',
  adminNotes: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ─── Pakistani EV Market Data ───────────────────────────

export const PakistanEVBrands = [
  { brand: 'MG', models: ['ZS EV', 'MG4 EV'] },
  { brand: 'Honda', models: ['e:NP1'] },
  { brand: 'BYD', models: ['Atto 3', 'Seal', 'Dolphin'] },
  { brand: 'Changan', models: ['Oshan X5 EV', 'Lumin'] },
  { brand: 'Audi', models: ['e-tron', 'Q4 e-tron'] },
  { brand: 'BMW', models: ['iX3', 'i4'] },
  { brand: 'Tesla', models: ['Model 3', 'Model Y'] },
  { brand: 'Hyundai', models: ['Ioniq 5', 'Kona Electric'] },
  { brand: 'KIA', models: ['EV6'] },
  { brand: 'Other', models: ['Other'] },
];

export const PakistanCities = [
  {
    city: 'Karachi',
    areas: [
      'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 7', 'DHA Phase 8', 'DHA Phase 8 Ext',
      'Clifton Block 1', 'Clifton Block 2', 'Clifton Block 3', 'Clifton Block 4', 'Clifton Block 5', 'Clifton Block 7', 'Clifton Block 8', 'Clifton Block 9',
      'PECHS Block 2', 'PECHS Block 3', 'PECHS Block 6',
      'Gulshan-e-Iqbal Block 1', 'Gulshan-e-Iqbal Block 2', 'Gulshan-e-Iqbal Block 3', 'Gulshan-e-Iqbal Block 4', 'Gulshan-e-Iqbal Block 5', 'Gulshan-e-Iqbal Block 10', 'Gulshan-e-Iqbal Block 13',
      'Bahria Town Karachi - Precinct 1', 'Bahria Town Karachi - Precinct 2', 'Bahria Town Karachi - Precinct 12', 'Bahria Town Karachi - Precinct 19',
      'Scheme 33', 'KDA Scheme 1', 'Malir Cantt', 'North Nazimabad Block A', 'North Nazimabad Block B', 'North Nazimabad Block F', 'North Nazimabad Block H',
      'Emaar Crescent Bay', 'Garden', 'Federal B Area', 'Karsaz', 'Naval Anchorage', 'Gulistan-e-Jauhar Block 1', 'Gulistan-e-Jauhar Block 12', 'Gulistan-e-Jauhar Block 15'
    ]
  },
  {
    city: 'Lahore',
    areas: [
      'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 7', 'DHA Phase 8', 'DHA Phase 9 Prism', 'DHA Phase 9 Town', 'DHA Phase 11 (Rahbar)',
      'Gulberg I', 'Gulberg II', 'Gulberg III', 'Gulberg V',
      'Model Town', 'Johar Town Phase 1', 'Johar Town Phase 2', 'Bahria Town Sector A', 'Bahria Town Sector B', 'Bahria Town Sector C', 'Bahria Town Sector D', 'Bahria Town Sector E',
      'Defense Raya', 'Cavalry Ground', 'Cantt', 'Garden Town', 'Faisal Town', 'Valencia Town', 'WAPDA Town', 'Lake City', 'State Life', 'Sui Gas Society',
      'Green City', 'Paragon City', 'New Lahore City', 'Zaitoon City', 'Al Kabir Town', 'Park View City', 'Etihad Town', 'Central Park', 'LDA City'
    ]
  },
  {
    city: 'Islamabad',
    areas: [
      'E-7', 'F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11', 'G-13', 'G-15', 'H-13', 'I-8', 'I-9', 'I-10',
      'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5', 'DHA Valley',
      'Bahria Town Phase 1', 'Bahria Town Phase 2', 'Bahria Town Phase 3', 'Bahria Town Phase 4', 'Bahria Town Phase 5', 'Bahria Town Phase 6', 'Bahria Town Phase 7', 'Bahria Town Phase 8', 'Bahria Enclave',
      'Gulberg Residencia', 'Gulberg Greens', 'Park View City', 'Eighteen', 'Top City-1', 'Mumtaz City', 'University Town', 'B-17 Multi Gardens', 'D-12', 'E-11'
    ]
  },
  {
    city: 'Rawalpindi',
    areas: [
      'Bahria Town Phase 7', 'Bahria Town Phase 8', 'Chaklala Scheme 3', 'Saddar', 'Rawalpindi Cantt', 'Satellite Town', 'Westridge', 'Gulraiz', 'Airport Housing Society', 'DHA Phase 1'
    ]
  },
  {
    city: 'Faisalabad',
    areas: [
      'Madina Town', 'Peoples Colony', 'Samanabad', 'Lyallpur Town', 'Canal Road', 'Citi Housing', 'Faisalabad Motorway City', 'Sargodha Road', 'Jinnah Town'
    ]
  },
  {
    city: 'Multan',
    areas: [
      'DHA Multan', 'Bosan Road', 'Gulgasht Colony', 'Multan Cantt', 'Wapda Town', 'Buch Villas', 'Model Town', 'Garden Town'
    ]
  },
  {
    city: 'Peshawar',
    areas: [
      'DHA Peshawar', 'Hayatabad Phase 1', 'Hayatabad Phase 3', 'Hayatabad Phase 5', 'Hayatabad Phase 7', 'University Town', 'Peshawar Cantt', 'Regi Model Town'
    ]
  },
  {
    city: 'Quetta',
    areas: [
        'Quetta Cantt', 'Jinnah Town', 'Satellite Town', 'Samungli Road', 'DHA Quetta'
    ]
  },
  {
    city: 'Gujranwala',
    areas: [
        'Citi Housing', 'DHA Gujranwala', 'Satellite Town', 'Model Town', 'Garden Town', 'Master City'
    ]
  },
  {
    city: 'Sialkot',
    areas: [
        'Sialkot Cantt', 'Citi Housing', 'Model Town', 'Defence'
    ]
  }
];
