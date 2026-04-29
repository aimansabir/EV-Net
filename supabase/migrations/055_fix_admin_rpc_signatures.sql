-- 055_fix_admin_rpc_signatures.sql
-- Corrective migration to ensure admin verification RPCs have consistent signatures
-- and clear any stale overloads in the schema cache.

-- 1. Drop existing versions to prevent overloads
DROP FUNCTION IF EXISTS public.admin_verify_user(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.admin_verify_host(uuid, boolean, text);

-- 2. Re-create admin_verify_host with explicit parameter order
CREATE OR REPLACE FUNCTION public.admin_verify_host(
  p_user_id uuid,
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  IF NOT p_approved AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'Moderation Error: Notes are strictly mandatory when rejecting a host profile.';
  END IF;

  -- Update host profile status
  UPDATE public.host_profiles
  SET verification_status = v_status,
      moderation_notes = p_notes
  WHERE user_id = p_user_id;

  -- Update specific pending submission to match the decision
  UPDATE public.verification_submissions
  SET status = v_status,
      reviewer_id = auth.uid(),
      reviewer_notes = p_notes,
      reviewed_at = now()
  WHERE user_id = p_user_id
    AND coalesce(type, profile_type) = 'HOST'
    AND status = 'pending';

  -- Log explicit moderation review
  INSERT INTO public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  VALUES ('USER', p_user_id, auth.uid(), v_action, p_notes);

  -- Log immutable audit event
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'VERIFY_HOST', 'USER', p_user_id, jsonb_build_object('approved', p_approved, 'notes', p_notes));
END;
$$;

-- 3. Re-create admin_verify_user with explicit parameter order
CREATE OR REPLACE FUNCTION public.admin_verify_user(
  p_user_id uuid,
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  IF NOT p_approved AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'Moderation Error: Notes are strictly mandatory when rejecting an EV User profile.';
  END IF;

  -- Update EV profile status
  UPDATE public.ev_profiles
  SET verification_status = v_status
  WHERE user_id = p_user_id;

  -- Update specific pending submission
  UPDATE public.verification_submissions
  SET status = v_status,
      reviewer_id = auth.uid(),
      reviewer_notes = p_notes,
      reviewed_at = now()
  WHERE user_id = p_user_id
    AND coalesce(type, profile_type) = 'EV_USER'
    AND status = 'pending';

  -- Log explicit moderation review
  INSERT INTO public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  VALUES ('USER', p_user_id, auth.uid(), v_action, p_notes);

  -- Log immutable audit event
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'VERIFY_USER', 'USER', p_user_id, jsonb_build_object('approved', p_approved, 'notes', p_notes));
END;
$$;

-- 4. Re-grant execute permissions (default is public, but let's be explicit for security definer functions)
GRANT EXECUTE ON FUNCTION public.admin_verify_host(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_user(uuid, boolean, text) TO authenticated;
