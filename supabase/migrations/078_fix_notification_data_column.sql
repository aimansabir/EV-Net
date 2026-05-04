-- 078_fix_notification_data_column.sql
-- Notifications use public.notifications.data, not metadata.

create or replace function public.accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_listing_title text;
begin
  select l.title into v_listing_title
  from public.listings l
  join public.bookings b on b.listing_id = l.id
  where b.id = p_booking_id
    and l.host_id = v_user_id;

  if not found then
    raise exception 'Booking not found or you are not the host of this listing.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.status != 'PENDING' then
    raise exception 'Only PENDING bookings can be accepted.';
  end if;

  update public.bookings
  set status = 'CONFIRMED',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, 'PENDING', 'CONFIRMED', v_user_id, 'Host accepted the booking request'
  );

  insert into public.notifications (
    user_id, type, title, message, data
  ) values (
    v_booking.user_id,
    'BOOKING_STATUS_UPDATE',
    'Booking confirmed',
    format('Your booking for %s has been confirmed!', v_listing_title),
    jsonb_build_object(
      'bookingId', v_booking.id,
      'booking_id', v_booking.id,
      'listingId', v_booking.listing_id,
      'route', '/app/bookings',
      'hostRoute', '/host/bookings'
    )
  );

  return v_booking;
end;
$$;

create or replace function public.decline_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_listing_title text;
begin
  select l.title into v_listing_title
  from public.listings l
  join public.bookings b on b.listing_id = l.id
  where b.id = p_booking_id
    and l.host_id = v_user_id;

  if not found then
    raise exception 'Booking not found or you are not the host of this listing.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.status != 'PENDING' then
    raise exception 'Only PENDING bookings can be declined.';
  end if;

  update public.bookings
  set status = 'CANCELLED',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, 'PENDING', 'CANCELLED', v_user_id, 'Host declined the booking request'
  );

  insert into public.notifications (
    user_id, type, title, message, data
  ) values (
    v_booking.user_id,
    'BOOKING_STATUS_UPDATE',
    'Booking declined',
    format('Your booking for %s was declined by the host.', v_listing_title),
    jsonb_build_object(
      'bookingId', v_booking.id,
      'booking_id', v_booking.id,
      'listingId', v_booking.listing_id,
      'route', '/app/bookings',
      'hostRoute', '/host/bookings'
    )
  );

  return v_booking;
end;
$$;

create or replace function public.create_booking(
  p_listing_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_vehicle_size text,
  p_payment_method text,
  p_payment_proof_path text default null,
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
  v_payment_status text;
  v_result public.bookings;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_payment_method not in ('BANK_TRANSFER', 'PAY_AFTER_CHARGING') then
    raise exception 'Invalid payment method: %', p_payment_method;
  end if;

  v_payment_status := case
    when p_payment_method = 'BANK_TRANSFER' then 'proof_submitted'
    when p_payment_method = 'PAY_AFTER_CHARGING' then 'pay_later'
  end;

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
      and lower(ep.verification_status) in ('approved', 'verified')
  ) then
    raise exception 'EV profile not verified/approved';
  end if;

  select
    l.host_id, l.price_per_hour, l.price_day_per_kwh, l.price_night_per_kwh
  into
    v_host_id, v_price_per_hour, v_price_day_per_kwh, v_price_night_per_kwh
  from public.listings l
  where l.id = p_listing_id and l.is_active = true and l.is_approved = true;

  if not found then
    raise exception 'Listing not available or not found: %', p_listing_id;
  end if;

  if v_host_id = v_user_id then
    raise exception 'Cannot book your own listing';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_listing_id::text), hashtext(p_date::text));

  if exists (
    select 1 from public.bookings b
    where b.listing_id = p_listing_id and b.date = p_date and b.status <> 'CANCELLED'
      and b.start_time < p_end_time and b.end_time > p_start_time
  ) then
    raise exception 'Booking overlaps an existing non-cancelled booking';
  end if;

  if v_pricing_band = 'DAY' and v_price_day_per_kwh is not null then
    v_base_fee := round(v_vehicle_kwh * v_price_day_per_kwh, 2);
  elsif v_pricing_band = 'NIGHT' and v_price_night_per_kwh is not null then
    v_base_fee := round(v_vehicle_kwh * v_price_night_per_kwh, 2);
  else
    v_hours := extract(epoch from (p_end_time - p_start_time)) / 3600.0;
    v_base_fee := round(v_hours * coalesce(v_price_per_hour, 0), 2);
  end if;

  v_user_service_fee := round(v_base_fee * 0.15, 2);
  v_host_platform_fee := round(v_base_fee * 0.22, 2);
  v_gateway_fee := round(v_base_fee * 0.03, 2);
  v_total_user_price := v_base_fee + v_user_service_fee;
  v_host_payout := v_base_fee - v_host_platform_fee;

  insert into public.bookings (
    user_id, listing_id, date, start_time, end_time, status,
    vehicle_size, estimated_kwh, pricing_band,
    base_fee, service_fee, total_fee,
    user_service_fee, host_platform_fee, gateway_fee,
    total_user_price, host_payout,
    payment_method, payment_status, payment_proof_path,
    created_at, updated_at
  )
  values (
    v_user_id, p_listing_id, p_date, p_start_time, p_end_time, 'PENDING',
    p_vehicle_size, coalesce(p_estimated_kwh, v_vehicle_kwh), v_pricing_band,
    v_base_fee, v_user_service_fee, v_total_user_price,
    v_user_service_fee, v_host_platform_fee, v_gateway_fee,
    v_total_user_price, v_host_payout,
    p_payment_method, v_payment_status, p_payment_proof_path,
    now(), now()
  )
  returning id into v_booking_id;

  begin
    insert into public.notifications (user_id, type, title, message, data)
    values (
      v_user_id,
      'BOOKING_SUBMITTED',
      'Booking submitted',
      'Booking submitted. Waiting for host confirmation.',
      jsonb_build_object(
        'bookingId', v_booking_id,
        'booking_id', v_booking_id,
        'listingId', p_listing_id,
        'route', '/app/bookings',
        'hostRoute', '/host/bookings'
      )
    );

    insert into public.notifications (user_id, type, title, message, data)
    values (
      v_host_id,
      'NEW_BOOKING_REQUEST',
      'New booking request',
      'New booking request for your listing.',
      jsonb_build_object(
        'bookingId', v_booking_id,
        'booking_id', v_booking_id,
        'listingId', p_listing_id,
        'route', '/app/bookings',
        'hostRoute', '/host/bookings'
      )
    );
  exception when others then
    null;
  end;

  select * into v_result from public.bookings where id = v_booking_id;
  return v_result;
end;
$$;

create or replace function public.submit_payment_proof(
  p_booking_id uuid,
  p_proof_path text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_host_id uuid;
  v_listing_title text;
  v_listing_id uuid;
begin
  update public.bookings
  set payment_proof_path = p_proof_path,
      payment_status = 'proof_submitted',
      updated_at = now()
  where id = p_booking_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Booking not found or not owned by you.';
  end if;

  select l.host_id, l.title, l.id into v_host_id, v_listing_title, v_listing_id
  from public.listings l
  join public.bookings b on b.listing_id = l.id
  where b.id = p_booking_id;

  insert into public.booking_status_history (booking_id, old_status, new_status, changed_by, reason)
  select id, status, status, auth.uid(), 'Payment proof uploaded'
  from public.bookings where id = p_booking_id;

  insert into public.notifications (user_id, type, title, message, data)
  values (
    v_host_id,
    'PAYMENT_PROOF_SUBMITTED',
    'Payment proof uploaded',
    'Payment proof uploaded for booking at ' || v_listing_title,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_listing_id,
      'route', '/app/bookings',
      'hostRoute', '/host/bookings'
    )
  );
end;
$$;

revoke execute on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

revoke execute on function public.decline_booking(uuid) from public, anon;
grant execute on function public.decline_booking(uuid) to authenticated;

grant execute on function public.create_booking(uuid, date, time, time, text, text, text, numeric, text) to authenticated;
grant execute on function public.submit_payment_proof(uuid, text) to authenticated;
