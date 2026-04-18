/**
 * EV-Net — Centralized Fee Configuration
 * 
 * SINGLE SOURCE of all pricing/fee logic.
 * Used by: booking totals, checkout display, host payouts,
 * admin reporting, host activation, and Supabase edge functions.
 * 
 * All amounts in PKR unless stated otherwise.
 */

// ─── Service Fee Configuration ──────────────────────────

/** Platform service fee as a percentage of the base charging fee */
export const SERVICE_FEE_PERCENT = 0.10; // 10%

/** Minimum service fee in PKR (floor) */
export const SERVICE_FEE_MIN = 50;

/** Maximum service fee in PKR (cap) */
export const SERVICE_FEE_MAX = 2000;

// ─── Host Activation Fee ────────────────────────────────

/** One-time listing activation / host verification fee */
export const HOST_ACTIVATION_FEE = 1500;

/** Tax/service charge on activation fee */
export const HOST_ACTIVATION_TAX_PERCENT = 0.16; // 16% GST

/** Total activation fee including tax */
export const HOST_ACTIVATION_TOTAL = HOST_ACTIVATION_FEE * (1 + HOST_ACTIVATION_TAX_PERCENT);

// ─── Host Payout Configuration ──────────────────────────

/** Platform commission deducted from host earnings (percentage of base fee) */
export const PLATFORM_COMMISSION_PERCENT = 0.15; // 15%

/** Host receives this percentage of the base fee */
export const HOST_PAYOUT_PERCENT = 1 - PLATFORM_COMMISSION_PERCENT; // 85%

// ─── Booking Constraints ────────────────────────────────

/** Minimum booking duration in hours */
export const MIN_BOOKING_HOURS = 1;

/** Maximum booking duration in hours */
export const MAX_BOOKING_HOURS = 8;

/** Minimum advance booking time in hours */
export const MIN_ADVANCE_HOURS = 1;

/** Maximum advance booking days */
export const MAX_ADVANCE_DAYS = 30;

// ─── Fee Calculation Functions ──────────────────────────

/**
 * Calculate the service fee for a booking
 * @param {number} baseFee - Base charging fee in PKR
 * @returns {number} Service fee in PKR (rounded to nearest integer)
 */
export function calculateServiceFee(baseFee) {
  const raw = baseFee * SERVICE_FEE_PERCENT;
  const clamped = Math.max(SERVICE_FEE_MIN, Math.min(SERVICE_FEE_MAX, raw));
  return Math.round(clamped);
}

/**
 * Calculate total booking fee
 * @param {number} pricePerHour - Listing price per hour in PKR
 * @param {number} hours - Duration in hours
 * @returns {{ baseFee: number, serviceFee: number, totalFee: number }}
 */
export function calculateBookingFees(pricePerHour, hours) {
  const baseFee = pricePerHour * hours;
  const serviceFee = calculateServiceFee(baseFee);
  const totalFee = baseFee + serviceFee;
  return { baseFee, serviceFee, totalFee };
}

/**
 * Calculate host payout for a booking
 * @param {number} baseFee - Base charging fee collected
 * @returns {{ hostPayout: number, platformCommission: number }}
 */
export function calculateHostPayout(baseFee) {
  const platformCommission = Math.round(baseFee * PLATFORM_COMMISSION_PERCENT);
  const hostPayout = baseFee - platformCommission;
  return { hostPayout, platformCommission };
}

/**
 * Calculate host activation fee breakdown
 * @returns {{ baseFee: number, tax: number, total: number }}
 */
export function getActivationFeeBreakdown() {
  const tax = Math.round(HOST_ACTIVATION_FEE * HOST_ACTIVATION_TAX_PERCENT);
  return {
    baseFee: HOST_ACTIVATION_FEE,
    tax,
    total: HOST_ACTIVATION_FEE + tax,
  };
}

/**
 * Format PKR amount for display
 * @param {number} amount 
 * @returns {string} e.g. "PKR 1,600"
 */
export function formatPKR(amount) {
  return `PKR ${amount.toLocaleString()}`;
}
