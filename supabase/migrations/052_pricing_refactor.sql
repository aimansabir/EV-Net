-- =========================================================
-- EV-Net Pricing Refactor (Phase 1: DB Migration)
-- - Supports energy-based pricing (per kWh)
-- - Supports granular fee tracking
-- - Maintains backward compatibility for hourly pricing
-- =========================================================

-- 1) Listings table updates (Power Rates)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS price_day_per_kwh numeric 
    CONSTRAINT positive_price_day CHECK (price_day_per_kwh >= 0),
  ADD COLUMN IF NOT EXISTS price_night_per_kwh numeric 
    CONSTRAINT positive_price_night CHECK (price_night_per_kwh >= 0);

-- 2) Bookings table updates (Detailed breakdown)
ALTER TABLE public.bookings
  -- New metadata for the energy model
  ADD COLUMN IF NOT EXISTS vehicle_size text 
    CONSTRAINT valid_vehicle_size CHECK (vehicle_size IN ('SMALL', 'MEDIUM', 'LARGE')),
  ADD COLUMN IF NOT EXISTS estimated_kwh numeric 
    CONSTRAINT positive_estimated_kwh CHECK (estimated_kwh >= 0),
  ADD COLUMN IF NOT EXISTS pricing_band text 
    CONSTRAINT valid_pricing_band CHECK (pricing_band IN ('DAY', 'NIGHT')),
  
  -- Explicit fee breakdowns (Migrating from generic total_fee/service_fee)
  ADD COLUMN IF NOT EXISTS user_service_fee numeric 
    CONSTRAINT positive_user_service_fee CHECK (user_service_fee >= 0),
  ADD COLUMN IF NOT EXISTS host_platform_fee numeric 
    CONSTRAINT positive_host_platform_fee CHECK (host_platform_fee >= 0),
  ADD COLUMN IF NOT EXISTS gateway_fee numeric 
    CONSTRAINT positive_gateway_fee CHECK (gateway_fee >= 0),
  ADD COLUMN IF NOT EXISTS total_user_price numeric 
    CONSTRAINT positive_total_user_price CHECK (total_user_price >= 0),
  ADD COLUMN IF NOT EXISTS host_payout numeric 
    CONSTRAINT positive_host_payout CHECK (host_payout >= 0);
