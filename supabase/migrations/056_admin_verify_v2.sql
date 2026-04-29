-- 056_admin_verify_v2.sql
-- Force schema cache refresh by using new function names (v2)
-- Also uses text for the ID to be extra resilient to frontend type handling

-- 1. admin_verify_host_v2
CREATE OR REPLACE FUNCTION public.admin_verify_host_v2(
  p_user_id text,
  p_approved boolean,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
  v_action text := CASE WHEN p_approved THEN 'APPROVE' ELSE 'REJECT' END;
  v_uid uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  v_uid := p_user_id::uuid;

  IF NOT p_approved AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'Moderation Error: Notes are strictly mandatory when rejecting a host profile.';
  END IF;

  UPDATE public.host_profiles
  SET verification_status = v_status,
      moderation_notes = p_notes
  WHERE user_id = v_uid;

  UPDATE public.verification_submissions
  SET status = v_status,
      reviewer_id = auth.uid(),
      reviewer_notes = p_notes,
      reviewed_at = now()
  WHERE user_id = v_uid
    AND coalesce(type, profile_type) = 'HOST'
    AND status = 'pending';

  INSERT INTO public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  VALUES ('USER', v_uid, auth.uid(), v_action, p_notes);

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'VERIFY_HOST', 'USER', v_uid, jsonb_build_object('approved', p_approved, 'notes', p_notes));
END;
$$;

-- 2. admin_verify_user_v2
CREATE OR REPLACE FUNCTION public.admin_verify_user_v2(
  p_user_id text,
  p_approved boolean,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
  v_action text := CASE WHEN p_approved THEN 'APPROVE' ELSE 'REJECT' END;
  v_uid uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  v_uid := p_user_id::uuid;

  IF NOT p_approved AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'Moderation Error: Notes are strictly mandatory when rejecting an EV User profile.';
  END IF;

  UPDATE public.ev_profiles
  SET verification_status = v_status
  WHERE user_id = v_uid;

  UPDATE public.verification_submissions
  SET status = v_status,
      reviewer_id = auth.uid(),
      reviewer_notes = p_notes,
      reviewed_at = now()
  WHERE user_id = v_uid
    AND coalesce(type, profile_type) = 'EV_USER'
    AND status = 'pending';

  INSERT INTO public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  VALUES ('USER', v_uid, auth.uid(), v_action, p_notes);

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'VERIFY_USER', 'USER', v_uid, jsonb_build_object('approved', p_approved, 'notes', p_notes));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_host_v2(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_user_v2(text, boolean, text) TO authenticated;
