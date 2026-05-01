-- 062_auth_duplicate_check.sql
-- Add a secure way to check if an email already exists in the profiles table

CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE lower(email) = lower(trim(p_email))
  );
END;
$$;

-- Revoke execute from public/anon and grant to authenticated
REVOKE EXECUTE ON FUNCTION public.email_exists(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO authenticated;
-- Also grant to anon so it can be used during signup before login
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon;
