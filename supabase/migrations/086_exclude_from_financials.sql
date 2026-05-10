-- 086_exclude_from_financials.sql

-- Add exclude_from_financials flag if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'exclude_from_financials') THEN
        ALTER TABLE public.bookings ADD COLUMN exclude_from_financials boolean DEFAULT false;
    END IF;
END $$;

-- Update existing archived test bookings to set exclude_from_financials = true
UPDATE public.bookings 
SET exclude_from_financials = true 
WHERE archived_at IS NOT NULL OR archive_reason = 'Test data cleanup';

-- Redefine admin_archive_booking to also set exclude_from_financials
CREATE OR REPLACE FUNCTION public.admin_archive_booking(
  p_booking_id uuid,
  p_reason text default 'Test data cleanup'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  UPDATE public.bookings
  SET archived_at    = now(),
      archived_by    = v_admin,
      archive_reason = p_reason,
      exclude_from_financials = true
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (v_admin, 'ARCHIVE_BOOKING', 'BOOKING', p_booking_id,
          jsonb_build_object('reason', p_reason, 'excluded_from_financials', true));

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_archive_booking(uuid, text) TO authenticated;

-- Redefine admin_unarchive_booking to also clear exclude_from_financials
CREATE OR REPLACE FUNCTION public.admin_unarchive_booking(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  UPDATE public.bookings
  SET archived_at    = null,
      archived_by    = null,
      archive_reason = null,
      exclude_from_financials = false
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (v_admin, 'UNARCHIVE_BOOKING', 'BOOKING', p_booking_id, '{}'::jsonb);

  RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unarchive_booking(uuid) TO authenticated;
