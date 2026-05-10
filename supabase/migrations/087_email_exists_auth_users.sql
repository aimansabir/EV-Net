-- 087_email_exists_auth_users.sql
-- Prevent duplicate signup attempts from hammering Supabase Auth rate limits.
-- Checks both the app profile row and Auth user table in case a profile trigger
-- previously failed or a user exists before profile repair completes.

create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where lower(email) = lower(btrim(p_email))
  )
  or exists (
    select 1
    from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;

revoke execute on function public.email_exists(text) from public, anon, authenticated;
grant execute on function public.email_exists(text) to anon, authenticated;
