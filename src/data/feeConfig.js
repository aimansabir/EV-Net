/**
 * EV-Net — Centralized Fee Configuration
 * 
 * SINGLE SOURCE of all pricing/fee logic.
 * Used by: booking totals, checkout display, host payouts,
 * admin reporting, host activation, and Supabase edge functions.
 * 
 * All amounts in PKR unless stated otherwise.
 */

// ─── Constants ──────────────────────────────────────────

export const VEHICLE_SIZES = {
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE'
};

export const ENERGY_BY_SIZE = {
  [VEHICLE_SIZES.SMALL]: 40,
  [VEHICLE_SIZES.MEDIUM]: 60,
  [VEHICLE_SIZES.LARGE]: 80
};

export const PRICING_BAND = {
  DAY: 'DAY',
  NIGHT: 'NIGHT'
};

/** Fee Rates (Percentages as decimals) */
export const FEE_RATES = {
  USER_SERVICE: 0.15,   // 15%
  HOST_PLATFORM: 0.22,  // 22%
  GATEWAY: 0.03         // 3%
};

// ─── Legacy Constants (Phase-out in progress) ────────────

/** @deprecated */
export const SERVICE_FEE_PERCENT = 0.10; 
/** @deprecated */
export const SERVICE_FEE_MIN = 50;
/** @deprecated */
export const SERVICE_FEE_MAX = 2000;
/** @deprecated */
export const PLATFORM_COMMISSION_PERCENT = 0.15; 
/** @deprecated */
export const HOST_PAYOUT_PERCENT = 0.85; 

// ─── Host Activation Fee (Remaining static) ─────────────

export const HOST_ACTIVATION_FEE = 1500;
export const HOST_ACTIVATION_TAX_PERCENT = 0.16; // 16% GST
export const HOST_ACTIVATION_TOTAL = Math.round(HOST_ACTIVATION_FEE * (1 + HOST_ACTIVATION_TAX_PERCENT));

// ─── Helpers ────────────────────────────────────────────

/**
 * rounds to nearest integer for PKR
 */
const roundMoney = (val) => Math.round(val || 0);

/**
 * Determines pricing band based on 24h time string
 * DAY: 08:00 to 19:59
 * NIGHT: 20:00 to 07:59
 */
export function getPricingBand(time24) {
  if (!time24) return PRICING_BAND.DAY;
  
  // Extract hour (e.g. "08:00" -> 8)
  const hour = parseInt(time24.split(':')[0]);
  
  // Rule: Day is 08:00 to 19:59 (inclusive 8, exclusive 20)
  if (hour >= 8 && hour < 20) {
    return PRICING_BAND.DAY;
  }
  
  return PRICING_BAND.NIGHT;
}

// ─── ENERGY PRICING CALCULATOR (NEW MODEL) ──────────────

/**
 * Low-level pure calculator for energy-based fees.
 * Matches backend create_booking RPC logic exactly.
 * 
 * @param {string} vehicleSize - SMALL, MEDIUM, or LARGE
 * @param {number} ratePerKwh - Applied rate for the session
 * @returns {object} Full financial breakdown
 */
export function calculateEnergyFees(vehicleSize, ratePerKwh) {
  // 1. Guards & Validation
  if (!vehicleSize || !ENERGY_BY_SIZE[vehicleSize]) {
    throw new Error(`Invalid vehicle size: ${vehicleSize}`);
  }
  if (typeof ratePerKwh !== 'number' || ratePerKwh < 0) {
    throw new Error(`Invalid or negative rate: ${ratePerKwh}`);
  }

  const energyKwh = ENERGY_BY_SIZE[vehicleSize];
  
  // 2. Calculations
  const baseCharge = roundMoney(energyKwh * ratePerKwh);
  
  const userServiceFee = roundMoney(baseCharge * FEE_RATES.USER_SERVICE);
  const hostPlatformFee = roundMoney(baseCharge * FEE_RATES.HOST_PLATFORM);
  const gatewayCost = roundMoney(baseCharge * FEE_RATES.GATEWAY);
  
  const userTotal = baseCharge + userServiceFee;
  const hostPayout = baseCharge - hostPlatformFee;
  
  const platformGrossRevenue = userServiceFee + hostPlatformFee;
  const platformNetRevenue = platformGrossRevenue - gatewayCost;

  return {
    baseCharge,
    userServiceFee,
    hostPlatformFee,
    gatewayCost,
    userTotal,
    hostPayout,
    platformGrossRevenue,
    platformNetRevenue,
    energyKwh,
    rateUsed: ratePerKwh
  };
}

/**
 * High-level wrapper for energy bookings.
 * 
 * @param {string} vehicleSize 
 * @param {string} band - DAY or NIGHT
 * @param {number} dayRate 
 * @param {number} nightRate 
 */
export function calculateEnergyBookingFees(vehicleSize, band, dayRate, nightRate) {
  const rate = band === PRICING_BAND.NIGHT ? nightRate : dayRate;
  
  // Propagate incomplete state if rate is missing
  if (rate === undefined || rate === null) {
    return { 
      isIncomplete: true,
      error: 'MISSING_RATE',
      band 
    };
  }

  return calculateEnergyFees(vehicleSize, rate);
}

// ─── LEGACY CALCULATORS (BACKWARD COMPATIBILITY) ────────

/**
 * @deprecated Use calculateEnergyFees or calculateEnergyBookingFees instead.
 * @param {number} baseFee 
 */
export function calculateServiceFee(baseFee) {
  const raw = baseFee * SERVICE_FEE_PERCENT;
  const clamped = Math.max(SERVICE_FEE_MIN, Math.min(SERVICE_FEE_MAX, raw));
  return roundMoney(clamped);
}

/**
 * @deprecated Use calculateEnergyFees or calculateEnergyBookingFees instead.
 */
export function calculateBookingFees(pricePerHour, hours) {
  const baseFee = pricePerHour * hours;
  const serviceFee = calculateServiceFee(baseFee);
  const totalFee = baseFee + serviceFee;
  return { 
    baseFee, 
    serviceFee, 
    totalFee,
    // Add compatibility aliases for the new fee model
    baseCharge: baseFee,
    userServiceFee: serviceFee,
    userTotal: totalFee
  };
}

/**
 * @deprecated Use calculateEnergyFees or calculateEnergyBookingFees instead.
 */
export function calculateHostPayout(baseFee) {
  const platformCommission = roundMoney(baseFee * PLATFORM_COMMISSION_PERCENT);
  const hostPayout = baseFee - platformCommission;
  return { hostPayout, platformCommission };
}

// ─── ACTIVATION HELPERS ─────────────────────────────────

export function getActivationFeeBreakdown() {
  const tax = roundMoney(HOST_ACTIVATION_FEE * HOST_ACTIVATION_TAX_PERCENT);
  return {
    baseFee: HOST_ACTIVATION_FEE,
    tax,
    total: HOST_ACTIVATION_FEE + tax,
  };
}

export function formatPKR(amount) {
  if (amount === undefined || amount === null) return 'PKR 0';
  return `PKR ${Math.round(amount).toLocaleString()}`;
}
export function formatEnergy(kwh) {
  if (kwh === undefined || kwh === null) return '0 kWh';
  return `${kwh} kWh`;
}
