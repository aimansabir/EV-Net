-- 092_create_host_onboarding_listing_rpc.sql
-- Create onboarding listings through an explicit RPC so host onboarding is not
-- brittle when profile role changes and RLS policy cache/reload timing disagree.

create or replace function public.create_host_onboarding_listing(
  p_host_id uuid,
  p_title text,
  p_description text,
  p_city text,
  p_area text,
  p_charger_type text,
  p_charger_speed text,
  p_price_per_hour numeric,
  p_price_day_per_kwh numeric,
  p_price_night_per_kwh numeric,
  p_amenities text[] default '{}',
  p_house_rules text[] default '{}'
)
returns public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_listing public.listings;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_host_id <> v_user_id then
    raise exception 'Cannot create a listing for another host';
  end if;

  select role
    into v_role
  from public.profiles
  where id = v_user_id;

  if v_role not in ('HOST', 'ADMIN') then
    raise exception 'Only host accounts can create listings';
  end if;

  insert into public.host_profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.listings (
    host_id,
    title,
    description,
    city,
    area,
    charger_type,
    charger_speed,
    price_per_hour,
    price_day_per_kwh,
    price_night_per_kwh,
    amenities,
    house_rules
  )
  values (
    p_host_id,
    p_title,
    p_description,
    p_city,
    p_area,
    p_charger_type,
    p_charger_speed,
    coalesce(p_price_per_hour, 1),
    p_price_day_per_kwh,
    p_price_night_per_kwh,
    coalesce(p_amenities, '{}'),
    coalesce(p_house_rules, '{}')
  )
  returning * into v_listing;

  return v_listing;
end;
$$;

revoke execute on function public.create_host_onboarding_listing(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric, text[], text[]
) from public, anon;

grant execute on function public.create_host_onboarding_listing(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric, text[], text[]
) to authenticated;

notify pgrst, 'reload schema';
