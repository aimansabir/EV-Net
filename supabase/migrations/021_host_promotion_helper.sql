-- 021_host_promotion_helper.sql
-- 1. Fix existing data: Backfill missing host_profiles for users with role = 'HOST'
INSERT INTO public.host_profiles (user_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.host_profiles hp ON hp.user_id = p.id
WHERE p.role = 'HOST'
  AND hp.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. Create a formal helper function to promote users to HOST safely
CREATE OR REPLACE FUNCTION public.promote_user_to_host(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the main profile role
  UPDATE public.profiles
  SET role = 'HOST'
  WHERE id = p_user_id;

  -- Ensure the host_profile entry exists
  INSERT INTO public.host_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
