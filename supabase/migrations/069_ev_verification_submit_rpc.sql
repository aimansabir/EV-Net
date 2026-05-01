CREATE OR REPLACE FUNCTION public.submit_ev_verification_for_review()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.ev_profiles
  SET
    verification_status = 'under_review',
    moderation_notes = null,
    updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV profile not found for user %', auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ev_verification_for_review() TO authenticated;
