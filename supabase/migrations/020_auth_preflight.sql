-- 020_auth_preflight.sql
-- Phase 0: Auth Preflight Migrations

-- 1. Harden Auth Trigger
-- Prevents transaction rollbacks if sub-profile inserts fail, and heals duplicate inserts.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
begin
  -- Robust role extraction
  user_role := coalesce(new.raw_user_meta_data->>'role', 'USER');
  if user_role not in ('USER', 'HOST', 'ADMIN') then
    user_role := 'USER';
  end if;

  -- Insert profile, fallback to update if collision occurs
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    user_role
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role;

  -- Try to insert sub-profiles safely
  begin
    if user_role = 'USER' or user_role = 'ADMIN' then
      insert into public.ev_profiles (user_id, phone)
      values (new.id, coalesce(new.raw_user_meta_data->>'phone', ''))
      on conflict (user_id) do nothing;
    end if;

    if user_role = 'HOST' or user_role = 'ADMIN' then
      insert into public.host_profiles (user_id, phone)
      values (new.id, coalesce(new.raw_user_meta_data->>'phone', ''))
      on conflict (user_id) do nothing;
    end if;
  exception when others then
    -- Swallow sub-profile errors so auth.users insertion isn't rolled back
    raise warning 'Failed to insert sub-profile for user %', new.id;
  end;

  return new;
end;
$$ language plpgsql security definer;


-- 2. Data Backfill (Heal missing profiles)
-- One-off script to ensure any previously broken signups are fully populated.
do $$
declare
  u record;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    -- Ensure basic profile exists
    insert into public.profiles (id, email, name, role)
    values (
      u.id, 
      u.email, 
      coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), 
      coalesce(u.raw_user_meta_data->>'role', 'USER')
    ) on conflict (id) do nothing;

    -- Heal sub-profiles based on current profile role
    if (select role from public.profiles where id = u.id) in ('USER', 'ADMIN') then
       insert into public.ev_profiles (user_id, phone)
       values (u.id, coalesce(u.raw_user_meta_data->>'phone', ''))
       on conflict (user_id) do nothing;
    end if;

    if (select role from public.profiles where id = u.id) in ('HOST', 'ADMIN') then
       insert into public.host_profiles (user_id, phone)
       values (u.id, coalesce(u.raw_user_meta_data->>'phone', ''))
       on conflict (user_id) do nothing;
    end if;
  end loop;
end;
$$;


-- 3. Seed Primary Admin & Host Promotion Helper
-- Safely promotes standard users to host (and creates host_profile) if approved by admin
create or replace function public.promote_to_host(target_user_id uuid)
returns boolean as $$
begin
  -- public.is_admin() exists in 018_helper_functions.sql
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  update public.profiles set role = 'HOST' where id = target_user_id;
  
  insert into public.host_profiles (user_id) 
  values (target_user_id) 
  on conflict (user_id) do nothing;
  
  return true;
end;
$$ language plpgsql security definer restrict;

-- Admin Seed: If admin exists in auth.users, promote them.
update public.profiles 
set role = 'ADMIN' 
where email = 'admin@EV-Net.pk';
