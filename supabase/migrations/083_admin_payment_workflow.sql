-- 083_admin_payment_workflow.sql
-- Shift payment verification authority to EV-Net Admin and enforce strict completion rules.

-- 1. Verify Payment RPC (Admin action)
CREATE OR REPLACE FUNCTION public.verify_booking_payment(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.bookings;
  v_listing_title text;
BEGIN
  -- Authorization Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can verify payments.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_booking.payment_status != 'proof_submitted' THEN
    RAISE EXCEPTION 'Payment verification requires payment_status to be proof_submitted.';
  END IF;

  SELECT title INTO v_listing_title FROM public.listings WHERE id = v_booking.listing_id;

  -- Update Payment Status
  UPDATE public.bookings
  SET payment_status = 'paid',
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  -- Status History
  INSERT INTO public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) VALUES (
    p_booking_id, v_booking.status, v_booking.status, auth.uid(), 'EV-Net Admin verified payment proof'
  );

  -- Notification to User
  INSERT INTO public.notifications (
    user_id, type, title, message, data
  ) VALUES (
    v_booking.user_id, 
    'PAYMENT', 
    'Payment Verified',
    format('Your payment for %s has been verified by EV-Net.', v_listing_title),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_booking.listing_id,
      'route', '/app/bookings',
      'type', 'PAYMENT_VERIFIED'
    )
  );

  RETURN v_booking;
END;
$$;

-- 2. Complete Booking RPC (Host action)
CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_listing_title text;
BEGIN
  -- Authorization Check
  SELECT l.title INTO v_listing_title
  FROM public.listings l
  JOIN public.bookings b ON b.listing_id = l.id
  WHERE b.id = p_booking_id AND l.host_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or you are not the host.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  -- Validation: Must be confirmed/accepted
  IF v_booking.status NOT IN ('CONFIRMED', 'ACCEPTED') THEN
    RAISE EXCEPTION 'Booking must be CONFIRMED to be marked as completed.';
  END IF;

  -- Validation: Must be paid
  IF v_booking.payment_status != 'paid' THEN
    RAISE EXCEPTION 'Booking must be paid before it can be marked as completed.';
  END IF;

  -- Update Status
  UPDATE public.bookings
  SET status = 'COMPLETED',
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  -- Status History
  INSERT INTO public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) VALUES (
    p_booking_id, v_booking.status, 'COMPLETED', v_user_id, 'Host marked charging session as completed'
  );

  -- Notification to User
  INSERT INTO public.notifications (
    user_id, type, title, message, data
  ) VALUES (
    v_booking.user_id, 
    'BOOKING_STATUS_UPDATE', 
    'Session Completed',
    format('Your charging session at %s has been marked as completed.', v_listing_title),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_booking.listing_id,
      'route', '/app/bookings',
      'type', 'COMPLETED'
    )
  );

  RETURN v_booking;
END;
$$;

-- 3. Admin Mark Payout Paid RPC
CREATE OR REPLACE FUNCTION public.admin_mark_payout_paid(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.bookings;
  v_host_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_booking.status != 'COMPLETED' THEN
    RAISE EXCEPTION 'Booking must be COMPLETED before payout can be marked paid.';
  END IF;

  IF v_booking.payment_status != 'paid' THEN
    RAISE EXCEPTION 'Booking payment must be paid by user before payout.';
  END IF;

  IF v_booking.payout_status != 'pending' THEN
    RAISE EXCEPTION 'Payout is not pending.';
  END IF;

  SELECT l.host_id INTO v_host_id
  FROM public.listings l
  WHERE l.id = v_booking.listing_id;

  UPDATE public.bookings
  SET payout_status = 'paid_to_host',
      updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'MARK_PAYOUT_PAID', 'BOOKING', p_booking_id, jsonb_build_object('amount', v_booking.host_payout));

  -- Notify Host
  INSERT INTO public.notifications (
    user_id, type, title, message, data
  ) VALUES (
    v_host_id, 
    'PAYMENT', 
    'Payout Sent',
    'Your payout for a completed booking has been transferred.',
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'route', '/host/earnings',
      'type', 'PAYOUT_PAID'
    )
  );
END;
$$;
