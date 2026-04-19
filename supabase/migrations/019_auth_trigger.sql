-- 019_auth_trigger.sql
-- Automatically creates profile + role-specific profile on user signup.
-- Handles both email/password signup AND OAuth (Google) sign-in.
-- Idempotent: uses ON CONFLICT DO NOTHING for OAuth re-logins.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_role text;
  user_name text;
  user_avatar text;
  user_phone text;
begin
  -- Role: from signup metadata, default USER
  user_role := coalesce(
    new.raw_user_meta_data->>'role',
    'USER'
  );

  -- Name: from signup form, or Google full_name, or email prefix
  user_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- Avatar: from Google OAuth
  user_avatar := new.raw_user_meta_data->>'avatar_url';

  -- Phone: from signup form
  user_phone := new.raw_user_meta_data->>'phone';

  -- Upsert profile (idempotent for OAuth re-logins)
  insert into public.profiles (id, email, name, role, avatar_url)
  values (new.id, new.email, user_name, user_role, user_avatar)
  on conflict (id) do nothing;

  -- Create role-specific sub-profile
  if user_role = 'USER' then
    insert into public.ev_profiles (user_id, phone)
    values (new.id, user_phone)
    on conflict (user_id) do nothing;
  end if;

  if user_role = 'HOST' then
    insert into public.host_profiles (user_id, phone)
    values (new.id, user_phone)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Drop and recreate trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
