-- 020_auth_preflight.sql
-- Phase 0: Auth Preflight Migrations

-- 1. Harden Auth Trigger
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'USER');

  if user_role not in ('USER', 'HOST', 'ADMIN') then
    user_role := 'USER';
  end if;

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

  begin
    if user_role in ('USER', 'ADMIN') then
      insert into public.ev_profiles (user_id, phone)
      values (new.id, nullif(new.raw_user_meta_data->>'phone', ''))
      on conflict (user_id) do nothing;
    end if;

    if user_role in ('HOST', 'ADMIN') then
      insert into public.host_profiles (user_id, phone)
      values (new.id, nullif(new.raw_user_meta_data->>'phone', ''))
      on conflict (user_id) do nothing;
    end if;
  exception when others then
    raise warning 'Failed to insert sub-profile for user %', new.id;
  end;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Recreate trigger only if needed
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


-- 2. Data Backfill (Heal missing profiles)
do $$
declare
  u record;
  healed_role text;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    healed_role := coalesce(u.raw_user_meta_data->>'role', 'USER');

    if healed_role not in ('USER', 'HOST', 'ADMIN') then
      healed_role := 'USER';
    end if;

    insert into public.profiles (id, email, name, role)
    values (
      u.id,
      u.email,
      coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
      healed_role
    )
    on conflict (id) do nothing;

    if (select role from public.profiles where id = u.id) in ('USER', 'ADMIN') then
      insert into public.ev_profiles (user_id, phone)
      values (u.id, nullif(u.raw_user_meta_data->>'phone', ''))
      on conflict (user_id) do nothing;
    end if;

    if (select role from public.profiles where id = u.id) in ('HOST', 'ADMIN') then
      insert into public.host_profiles (user_id, phone)
      values (u.id, nullif(u.raw_user_meta_data->>'phone', ''))
      on conflict (user_id) do nothing;
    end if;
  end loop;
end;
$$;


-- 3. Seed Primary Admin & Host Promotion Helper
create or replace function public.promote_to_host(target_user_id uuid)
returns boolean as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if exists (
    select 1 from public.profiles
    where id = target_user_id and role = 'ADMIN'
  ) then
    raise exception 'Cannot promote an ADMIN to HOST';
  end if;

  update public.profiles
  set role = 'HOST'
  where id = target_user_id;

  insert into public.host_profiles (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- Admin Seed: If admin exists in profiles, promote them.
update public.profiles
set role = 'ADMIN'
where email = 'admin@EV-Net.pk';