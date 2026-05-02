-- 072_fix_booking_rpc_return.sql
-- Fixes the "subquery must return only one column" error in create_booking RPC

create or replace function public.create_booking(
  p_listing_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_vehicle_size text,
  p_estimated_kwh numeric default null,
  p_pricing_band text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_price_per_hour numeric;
  v_price_day_per_kwh numeric;
  v_price_night_per_kwh numeric;
  v_vehicle_kwh numeric;
  v_pricing_band text;
  v_hours numeric;
  v_base_fee numeric;
  v_user_service_fee numeric;
  v_host_platform_fee numeric;
  v_gateway_fee numeric;
  v_total_user_price numeric;
  v_host_payout numeric;
  v_booking_id uuid;
  v_result public.bookings;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'end_time must be > start_time';
  end if;

  if p_vehicle_size not in ('SMALL', 'MEDIUM', 'LARGE') then
    raise exception 'Invalid vehicle_size: %', p_vehicle_size;
  end if;

  v_vehicle_kwh :=
    case p_vehicle_size
      when 'SMALL' then 40
      when 'MEDIUM' then 60
      when 'LARGE' then 80
    end;

  if p_start_time >= time '08:00' and p_start_time <= time '19:59' then
    v_pricing_band := 'DAY';
  else
    v_pricing_band := 'NIGHT';
  end if;

  if not exists (
    select 1
    from public.ev_profiles ep
    where ep.user_id = v_user_id
      and ep.verification_status = 'approved'
      and ep.email_verified is true
      and ep.cnic_submitted is true
      and ep.ev_proof_submitted is true
  ) then
    raise exception 'EV profile not verified/approved';
  end if;

  select
    l.host_id,
    l.price_per_hour,
    l.price_day_per_kwh,
    l.price_night_per_kwh
  into
    v_host_id,
    v_price_per_hour,
    v_price_day_per_kwh,
    v_price_night_per_kwh
  from public.listings l
  where l.id = p_listing_id
    and l.is_active = true
    and l.is_approved = true;

  if not found then
    raise exception 'Listing not available or not found: %', p_listing_id;
  end if;

  if v_host_id = v_user_id then
    raise exception 'Cannot book your own listing';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_listing_id::text),
    hashtext(p_date::text)
  );

  if exists (
    select 1
    from public.bookings b
    where b.listing_id = p_listing_id
      and b.date = p_date
      and b.status <> 'CANCELLED'
      and b.start_time < p_end_time
      and b.end_time > p_start_time
  ) then
    raise exception 'Booking overlaps an existing non-cancelled booking';
  end if;

  if v_pricing_band = 'DAY' and v_price_day_per_kwh is not null then
    v_base_fee := round(v_vehicle_kwh * v_price_day_per_kwh, 2);
  elsif v_pricing_band = 'NIGHT' and v_price_night_per_kwh is not null then
    v_base_fee := round(v_vehicle_kwh * v_price_night_per_kwh, 2);
  else
    if v_price_per_hour is null then
      raise exception 'No pricing available for listing %', p_listing_id;
    end if;

    v_hours := extract(epoch from (p_end_time - p_start_time)) / 3600.0;
    if v_hours <= 0 then
      raise exception 'Invalid time range';
    end if;

    v_base_fee := round(v_hours * v_price_per_hour, 2);
  end if;

  v_user_service_fee := round(v_base_fee * 0.15, 2);
  v_host_platform_fee := round(v_base_fee * 0.22, 2);
  v_gateway_fee := round(v_base_fee * 0.03, 2);
  v_total_user_price := v_base_fee + v_user_service_fee;
  v_host_payout := v_base_fee - v_host_platform_fee;

  insert into public.bookings (
    user_id,
    listing_id,
    date,
    start_time,
    end_time,
    status,
    vehicle_size,
    estimated_kwh,
    pricing_band,
    base_fee,
    service_fee,
    total_fee,
    user_service_fee,
    host_platform_fee,
    gateway_fee,
    total_user_price,
    host_payout,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_listing_id,
    p_date,
    p_start_time,
    p_end_time,
    'PENDING',
    p_vehicle_size,
    coalesce(p_estimated_kwh, v_vehicle_kwh),
    v_pricing_band,
    v_base_fee,
    v_user_service_fee,
    v_total_user_price,
    v_user_service_fee,
    v_host_platform_fee,
    v_gateway_fee,
    v_total_user_price,
    v_host_payout,
    now(),
    now()
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    old_status,
    new_status,
    changed_by,
    reason,
    created_at
  )
  values (
    v_booking_id,
    null,
    'PENDING',
    v_user_id,
    null,
    now()
  );

  select * into v_result
  from public.bookings b
  where b.id = v_booking_id;

  return v_result;
end;
$$;
