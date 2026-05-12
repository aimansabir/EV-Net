-- 093_test_account_flag.sql
-- Adds an is_test_account flag to profiles so admins can mark test users/hosts.
-- When toggled, all their bookings and onboarding payments get exclude_from_financials updated.

-- 1. Add column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_test_account') THEN
        ALTER TABLE public.profiles ADD COLUMN is_test_account boolean DEFAULT false;
    END IF;
END $$;

-- 2. RPC: admin_toggle_test_account
CREATE OR REPLACE FUNCTION public.admin_toggle_test_account(
  p_user_id uuid,
  p_is_test boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_name text;
  v_bookings_updated int := 0;
  v_host_bookings_updated int := 0;
  v_payments_updated int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  -- Update profile flag
  UPDATE public.profiles
  SET is_test_account = p_is_test
  WHERE id = p_user_id
  RETURNING name INTO v_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- Cascade: mark all their bookings' exclude_from_financials
  UPDATE public.bookings
  SET exclude_from_financials = p_is_test
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_bookings_updated = ROW_COUNT;

  -- Also cascade to bookings on their listings (if they're a host)
  UPDATE public.bookings
  SET exclude_from_financials = p_is_test
  WHERE listing_id IN (SELECT id FROM public.listings WHERE host_id = p_user_id)
    AND user_id != p_user_id;
  GET DIAGNOSTICS v_host_bookings_updated = ROW_COUNT;

  v_bookings_updated := v_bookings_updated + v_host_bookings_updated;

  -- Cascade: mark their onboarding payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'onboarding_payments') THEN
    UPDATE public.onboarding_payments
    SET exclude_from_financials = p_is_test
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_payments_updated = ROW_COUNT;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (v_admin,
          CASE WHEN p_is_test THEN 'MARK_TEST_ACCOUNT' ELSE 'UNMARK_TEST_ACCOUNT' END,
          'USER', p_user_id,
          jsonb_build_object(
            'user_name', v_name,
            'is_test', p_is_test,
            'bookings_updated', v_bookings_updated,
            'payments_updated', v_payments_updated
          ));

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'is_test_account', p_is_test,
    'bookings_updated', v_bookings_updated,
    'payments_updated', v_payments_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_test_account(uuid, boolean) TO authenticated;
