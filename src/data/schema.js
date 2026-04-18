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
  PAYMENT: 'PAYMENT',
  VERIFICATION: 'VERIFICATION',
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
 * @property {boolean} isSuspended
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
 * @property {number} baseFee - PKR
 * @property {number} serviceFee - PKR
 * @property {number} totalFee - PKR
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
  isSuspended: false,
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
  pricePerHour: 500,
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
  baseFee: 0,
  serviceFee: 0,
  totalFee: 0,
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
  { city: 'Lahore', areas: ['DHA Phase 1-9', 'Gulberg I-V', 'Johar Town', 'Model Town', 'Bahria Town', 'Cavalry Ground', 'Cantt', 'Garden Town', 'Valencia', 'WAPDA Town'] },
  { city: 'Karachi', areas: ['DHA Phase 1-8', 'Clifton', 'Gulshan-e-Iqbal', 'Nazimabad', 'PECHS', 'KDA Scheme 1', 'North Nazimabad', 'Bahria Town', 'Malir Cantt', 'FB Area'] },
  { city: 'Islamabad', areas: ['F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-6', 'G-11', 'E-7', 'I-8', 'DHA Phase 1-5', 'Bahria Town Phase 1-8', 'Bani Gala'] },
  { city: 'Rawalpindi', areas: ['Bahria Town Phase 7-8', 'DHA Phase 1', 'Saddar', 'Cantt', 'Satellite Town', 'Gulraiz', 'Chaklala Scheme 3', 'Westridge'] },
  { city: 'Faisalabad', areas: ['Madina Town', 'Lyallpur Town', 'Jinnah Town', 'Peoples Colony', 'Samanabad', 'Millat Town', 'Canal Road', 'Gulberg'] },
  { city: 'Multan', areas: ['Gulgasht Colony', 'Multan Cantt', 'Shah Rukn-e-Alam', 'Wapda Town', 'Garden Town', 'New Multan', 'Bosan Road', 'Model Town'] },
  { city: 'Peshawar', areas: ['Hayatabad Phase 1-7', 'University Town', 'Peshawar Cantt', 'Ring Road', 'Warsak Road', 'Gulbahar', 'Shami Road'] },
  { city: 'Quetta', areas: ['Quetta Cantt', 'Samungli Road', 'Jinnah Town', 'Satellite Town', 'Gulberg', 'Model Town', 'Ziarat Road'] },
  { city: 'Gujranwala', areas: ['Satellite Town', 'Model Town', 'DC Road', 'Garden Town', 'Wapda Town', 'Cantt', 'Rahwali'] },
  { city: 'Sialkot', areas: ['Sialkot Cantt', 'Model Town', 'Paris Road', 'Defence', 'Sambrial', 'Kashmir Road'] },
  { city: 'Abbottabad', areas: ['Mandian', 'Supply', 'Nawan Shehr', 'Cantt', 'Kakul', 'Jinnahabad'] },
  { city: 'Sukkur', areas: ['Barrage Road', 'Military Road', 'New Sukkur', 'Rohri', 'Shikarpur Road'] },
  { city: 'Sargodha', areas: ['Satellite Town', 'Model Town', 'University Road', 'Sargodha Cantt', 'Pearls Valley'] },
  { city: 'Bahawalpur', areas: ['Model Town', 'Satellite Town', 'Wapda Town', 'Yazman Road', 'Cheema Town'] },
  { city: 'Jhelum', areas: ['Jhelum Cantt', 'Kala Gujran', 'Citi Housing', 'Civil Lines', 'Saeela'] },
];
