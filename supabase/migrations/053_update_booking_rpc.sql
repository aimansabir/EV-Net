CREATE OR REPLACE FUNCTION public.create_booking(
  p_listing_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,

  -- Frontend may still send these for backward compatibility,
  -- but pricing_band is derived server-side.
  p_vehicle_size text,
  p_estimated_kwh numeric DEFAULT NULL,
  p_pricing_band text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();

  v_host_id uuid;

  v_price_per_hour numeric;

  v_price_day_per_kwh numeric;
  v_price_night_per_kwh numeric;

  v_vehicle_kwh numeric;

  v_pricing_band text;

  v_hours numeric;
  v_base_fee numeric;

  v_user_service_fee numeric;
  v_host_platform_fee numeric;
  v_gateway_fee numeric;

  v_total_user_price numeric;

  v_host_payout numeric;

  v_booking_id uuid;

BEGIN
  -- 1) Validate authenticated user exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Validate end_time > start_time
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'end_time must be > start_time';
  END IF;

  -- 3) Validate vehicle_size
  IF p_vehicle_size NOT IN ('SMALL', 'MEDIUM', 'LARGE') THEN
    RAISE EXCEPTION 'Invalid vehicle_size: %', p_vehicle_size;
  END IF;

  v_vehicle_kwh :=
    CASE p_vehicle_size
      WHEN 'SMALL' THEN 40
      WHEN 'MEDIUM' THEN 60
      WHEN 'LARGE' THEN 80
    END;

  -- 4) Derive pricing_band from p_start_time (do not trust frontend input)
  -- DAY = 08:00 to 19:59, NIGHT = 20:00 to 07:59
  IF p_start_time >= TIME '08:00' AND p_start_time <= TIME '19:59' THEN
    v_pricing_band := 'DAY';
  ELSE
    v_pricing_band := 'NIGHT';
  END IF;

  -- 5) Verification gating (approved EV profile + verified contact + submitted docs)
  -- NOTE: This matches your confirmed schema expectations for ev_profiles fields.
  IF NOT EXISTS (
    SELECT 1
    FROM public.ev_profiles ep
    WHERE ep.user_id = v_user_id
      AND ep.verification_status = 'approved'
      AND ep.email_verified IS TRUE
      AND ep.phone_verified IS TRUE
      AND ep.cnic_submitted IS TRUE
      AND ep.ev_proof_submitted IS TRUE
  ) THEN
    RAISE EXCEPTION 'EV profile not verified/approved';
  END IF;

  -- 6) Load listing + pricing (ONLY allow active + approved listings)
  SELECT
    l.host_id,
    l.price_per_hour,
    l.price_day_per_kwh,
    l.price_night_per_kwh
  INTO
    v_host_id,
    v_price_per_hour,
    v_price_day_per_kwh,
    v_price_night_per_kwh
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND l.is_active = true
    AND l.is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not available or not found: %', p_listing_id;
  END IF;

  -- 7) Prevent booking own listing
  IF v_host_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot book your own listing';
  END IF;

  -- 8) Concurrency guard before overlap check (serializes per listing+date)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_listing_id::text),
    hashtext(p_date::text)
  );

  -- 9) Prevent overlap with existing non-cancelled bookings
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.listing_id = p_listing_id
      AND b.date = p_date
      AND b.status <> 'CANCELLED'
      AND b.start_time < p_end_time
      AND b.end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'Booking overlaps an existing non-cancelled booking';
  END IF;

  -- 10) Compute base_fee
  -- Uses energy pricing if listing has kWh price for the derived band; otherwise fallback to hourly.
  IF v_pricing_band = 'DAY' AND v_price_day_per_kwh IS NOT NULL THEN
    -- rounding alignment: 2 decimals
    v_base_fee := round(v_vehicle_kwh * v_price_day_per_kwh, 2);

  ELSIF v_pricing_band = 'NIGHT' AND v_price_night_per_kwh IS NOT NULL THEN
    v_base_fee := round(v_vehicle_kwh * v_price_night_per_kwh, 2);

  ELSE
    -- Legacy fallback
    IF v_price_per_hour IS NULL THEN
      RAISE EXCEPTION 'No pricing available for listing %', p_listing_id;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600.0;
    IF v_hours <= 0 THEN
      RAISE EXCEPTION 'Invalid time range';
    END IF;

    v_base_fee := round(v_hours * v_price_per_hour, 2);
  END IF;

  -- 11) Fee split (based on base_fee) with 2-decimal rounding
  v_user_service_fee := round(v_base_fee * 0.15, 2);
  v_host_platform_fee := round(v_base_fee * 0.22, 2);
  -- gateway fee is stored, but NOT subtracted from host_payout (your requirement)
  v_gateway_fee := round(v_base_fee * 0.03, 2);

  v_total_user_price := v_base_fee + v_user_service_fee;

  -- 12) Host payout: base_fee - host_platform_fee (do not subtract gateway fee)
  v_host_payout := v_base_fee - v_host_platform_fee;

  -- 13) Insert booking
  -- Legacy compatibility mapping:
  -- service_fee = user_service_fee
  -- total_fee = total_user_price
  INSERT INTO public.bookings (
    user_id,
    listing_id,
    date,
    start_time,
    end_time,
    status,

    -- energy-model support
    vehicle_size,
    estimated_kwh,
    pricing_band,

    -- legacy hourly compatibility mapping fields (do not redefine semantics)
    base_fee,
    service_fee,
    total_fee,

    -- fee breakdown fields
    user_service_fee,
    host_platform_fee,
    gateway_fee,
    total_user_price,
    host_payout,

    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_listing_id,
    p_date,
    p_start_time,
    p_end_time,
    'PENDING',

    -- vehicle size is server-truth from validated text
    p_vehicle_size,

    -- store provided estimated_kwh if frontend sends it; otherwise store fixed mapping
    COALESCE(p_estimated_kwh, v_vehicle_kwh),

    v_pricing_band,

    v_base_fee,
    v_user_service_fee,
    v_total_user_price,

    v_user_service_fee,
    v_host_platform_fee,
    v_gateway_fee,
    v_total_user_price,
    v_host_payout,

    now(),
    now()
  )
  RETURNING id INTO v_booking_id;

  -- 14) Insert into booking_status_history with initial PENDING status
  INSERT INTO public.booking_status_history (
    booking_id,
    old_status,
    new_status,
    changed_by,
    reason,
    created_at
  )
  VALUES (
    v_booking_id,
    NULL,
    'PENDING',
    v_user_id,
    NULL,
    now()
  );

  -- 15) Return created booking row
  RETURN (
    SELECT b.*
    FROM public.bookings b
    WHERE b.id = v_booking_id
  );
END;
$$;

-- 16) After creating/updating the function:
-- revoke execution from public; grant execute to authenticated
REVOKE EXECUTE ON FUNCTION public.create_booking(
  uuid, date, time, time, text, numeric, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_booking(
  uuid, date, time, time, text, numeric, text
) TO authenticated;