-- 076_manual_payment_flow.sql
-- Support for Bank Transfer and Pay After Charging

-- 1. Extend Bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method text 
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('BANK_TRANSFER', 'PAY_AFTER_CHARGING')),
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid'
    CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'pay_later', 'payment_due', 'proof_submitted', 'paid', 'rejected')),
  ADD COLUMN IF NOT EXISTS payment_proof_path text;

-- 1.1 Update Notification Types
ALTER TABLE public.notifications 
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'SYSTEM', 'BOOKING_UPDATE', 'PAYMENT', 'VERIFICATION', 'MESSAGE', 
    'BOOKING_SUBMITTED', 'NEW_BOOKING_REQUEST', 'BOOKING_STATUS_UPDATE', 
    'PAYMENT_PROOF_SUBMITTED'
  ));

-- 2. Storage for Payment Proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for payment proofs
CREATE POLICY "users_upload_own_proof"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment_proofs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "users_read_own_proof"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment_proofs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "hosts_read_booking_proof"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment_proofs' AND 
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE b.payment_proof_path = name
        AND l.host_id = auth.uid()
    )
  );

-- 3. Update create_booking RPC
CREATE OR REPLACE FUNCTION public.create_booking(
  p_listing_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_vehicle_size text,
  p_payment_method text,
  p_payment_proof_path text DEFAULT NULL,
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
  v_payment_status text;
  v_result public.bookings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_payment_method NOT IN ('BANK_TRANSFER', 'PAY_AFTER_CHARGING') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  v_payment_status := CASE 
    WHEN p_payment_method = 'BANK_TRANSFER' THEN 'proof_submitted'
    WHEN p_payment_method = 'PAY_AFTER_CHARGING' THEN 'pay_later'
  END;

  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'end_time must be > start_time';
  END IF;

  IF p_vehicle_size NOT IN ('SMALL', 'MEDIUM', 'LARGE') THEN
    RAISE EXCEPTION 'Invalid vehicle_size: %', p_vehicle_size;
  END IF;

  v_vehicle_kwh :=
    CASE p_vehicle_size
      WHEN 'SMALL' THEN 40
      WHEN 'MEDIUM' THEN 60
      WHEN 'LARGE' THEN 80
    END;

  IF p_start_time >= TIME '08:00' AND p_start_time <= TIME '19:59' THEN
    v_pricing_band := 'DAY';
  ELSE
    v_pricing_band := 'NIGHT';
  END IF;

  -- Gating (using normalized check to match frontend accessControl)
  IF NOT EXISTS (
    SELECT 1
    FROM public.ev_profiles ep
    WHERE ep.user_id = v_user_id
      AND LOWER(ep.verification_status) IN ('approved', 'verified')
  ) THEN
    RAISE EXCEPTION 'EV profile not verified/approved';
  END IF;

  SELECT
    l.host_id, l.price_per_hour, l.price_day_per_kwh, l.price_night_per_kwh
  INTO
    v_host_id, v_price_per_hour, v_price_day_per_kwh, v_price_night_per_kwh
  FROM public.listings l
  WHERE l.id = p_listing_id AND l.is_active = true AND l.is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not available or not found: %', p_listing_id;
  END IF;

  IF v_host_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot book your own listing';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_listing_id::text), hashtext(p_date::text));

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.listing_id = p_listing_id AND b.date = p_date AND b.status <> 'CANCELLED'
      AND b.start_time < p_end_time AND b.end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'Booking overlaps an existing non-cancelled booking';
  END IF;

  IF v_pricing_band = 'DAY' AND v_price_day_per_kwh IS NOT NULL THEN
    v_base_fee := ROUND(v_vehicle_kwh * v_price_day_per_kwh, 2);
  ELSIF v_pricing_band = 'NIGHT' AND v_price_night_per_kwh IS NOT NULL THEN
    v_base_fee := ROUND(v_vehicle_kwh * v_price_night_per_kwh, 2);
  ELSE
    v_hours := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600.0;
    v_base_fee := ROUND(v_hours * COALESCE(v_price_per_hour, 0), 2);
  END IF;

  v_user_service_fee := ROUND(v_base_fee * 0.15, 2);
  v_host_platform_fee := ROUND(v_base_fee * 0.22, 2);
  v_gateway_fee := ROUND(v_base_fee * 0.03, 2);
  v_total_user_price := v_base_fee + v_user_service_fee;
  v_host_payout := v_base_fee - v_host_platform_fee;

  INSERT INTO public.bookings (
    user_id, listing_id, date, start_time, end_time, status,
    vehicle_size, estimated_kwh, pricing_band,
    base_fee, service_fee, total_fee,
    user_service_fee, host_platform_fee, gateway_fee,
    total_user_price, host_payout,
    payment_method, payment_status, payment_proof_path,
    created_at, updated_at
  )
  VALUES (
    v_user_id, p_listing_id, p_date, p_start_time, p_end_time, 'PENDING',
    p_vehicle_size, COALESCE(p_estimated_kwh, v_vehicle_kwh), v_pricing_band,
    v_base_fee, v_user_service_fee, v_total_user_price,
    v_user_service_fee, v_host_platform_fee, v_gateway_fee,
    v_total_user_price, v_host_payout,
    p_payment_method, v_payment_status, p_payment_proof_path,
    NOW(), NOW()
  )
  RETURNING id INTO v_booking_id;

  -- 5. Notifications
  BEGIN
    -- To User
    INSERT INTO public.notifications (user_id, type, message, metadata)
    VALUES (v_user_id, 'BOOKING_SUBMITTED', 'Booking submitted. Waiting for host confirmation.', jsonb_build_object('booking_id', v_booking_id, 'listing_id', p_listing_id));
    
    -- To Host
    INSERT INTO public.notifications (user_id, type, message, metadata)
    VALUES (v_host_id, 'NEW_BOOKING_REQUEST', 'New booking request for your listing.', jsonb_build_object('booking_id', v_booking_id, 'listing_id', p_listing_id));
  EXCEPTION WHEN OTHERS THEN
    -- Don't fail booking if notification fails
    NULL;
  END;

  SELECT * INTO v_result FROM public.bookings WHERE id = v_booking_id;
  RETURN v_result;
END;
$$;

-- 4. Submit Payment Proof RPC
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_booking_id uuid,
  p_proof_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_host_id uuid;
  v_listing_title text;
BEGIN
  UPDATE public.bookings
  SET payment_proof_path = p_proof_path,
      payment_status = 'proof_submitted',
      updated_at = NOW()
  WHERE id = p_booking_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not owned by you.';
  END IF;

  -- Get host and listing info for notification
  SELECT l.host_id, l.title INTO v_host_id, v_listing_title
  FROM public.listings l
  JOIN public.bookings b ON b.listing_id = l.id
  WHERE b.id = p_booking_id;

  INSERT INTO public.booking_status_history (booking_id, old_status, new_status, changed_by, reason)
  SELECT id, status, status, auth.uid(), 'Payment proof uploaded'
  FROM public.bookings WHERE id = p_booking_id;

  -- Notify Host
  INSERT INTO public.notifications (user_id, type, message, metadata)
  VALUES (v_host_id, 'PAYMENT_PROOF_SUBMITTED', 'Payment proof uploaded for booking at ' || v_listing_title, jsonb_build_object('booking_id', p_booking_id));

END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, time, time, text, text, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO authenticated;
