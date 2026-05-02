-- 075_secure_booking_actions.sql
-- Secure RPCs for hosts to manage booking requests

-- 1. Accept Booking RPC
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
  -- 1. Authorization & Existence Check
  select l.title into v_listing_title
  from public.listings l
  join public.bookings b on b.listing_id = l.id
  where b.id = p_booking_id
    and l.host_id = v_user_id;

  if not found then
    raise exception 'Booking not found or you are not the host of this listing.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  -- 2. State Validation
  if v_booking.status != 'PENDING' then
    raise exception 'Only PENDING bookings can be accepted.';
  end if;

  -- 3. Update Status
  update public.bookings
  set status = 'CONFIRMED',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  -- 4. Status History
  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, 'PENDING', 'CONFIRMED', v_user_id, 'Host accepted the booking request'
  );

  -- 5. Notification to User
  insert into public.notifications (
    user_id, type, message, metadata
  ) values (
    v_booking.user_id, 
    'BOOKING_STATUS_UPDATE', 
    format('Your booking for %s has been confirmed!', v_listing_title),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_booking.listing_id,
      'route', '/app/bookings',
      'type', 'ACCEPT'
    )
  );

  return v_booking;
end;
$$;

-- 2. Decline Booking RPC
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
  -- 1. Authorization & Existence Check
  select l.title into v_listing_title
  from public.listings l
  join public.bookings b on b.listing_id = l.id
  where b.id = p_booking_id
    and l.host_id = v_user_id;

  if not found then
    raise exception 'Booking not found or you are not the host of this listing.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  -- 2. State Validation
  if v_booking.status != 'PENDING' then
    raise exception 'Only PENDING bookings can be declined.';
  end if;

  -- 3. Update Status
  update public.bookings
  set status = 'CANCELLED',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  -- 4. Status History
  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, 'PENDING', 'CANCELLED', v_user_id, 'Host declined the booking request'
  );

  -- 5. Notification to User
  insert into public.notifications (
    user_id, type, message, metadata
  ) values (
    v_booking.user_id, 
    'BOOKING_STATUS_UPDATE', 
    format('Your booking for %s was declined by the host.', v_listing_title),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_booking.listing_id,
      'route', '/app/bookings',
      'type', 'DECLINE'
    )
  );

  return v_booking;
end;
$$;

-- Permissions
revoke execute on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

revoke execute on function public.decline_booking(uuid) from public, anon;
grant execute on function public.decline_booking(uuid) to authenticated;
