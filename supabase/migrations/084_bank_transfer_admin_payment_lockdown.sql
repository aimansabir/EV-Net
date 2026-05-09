-- 084_bank_transfer_admin_payment_lockdown.sql
-- Finalize manual bank-transfer booking flow:
-- - New bookings must use BANK_TRANSFER with submitted proof.
-- - Admins verify payment; hosts accept/decline and can only complete paid bookings.
-- - Legacy pay-later rows remain readable.

alter table public.bookings
  add column if not exists payout_status text default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'valid_payout_status'
  ) then
    alter table public.bookings
      add constraint valid_payout_status
      check (payout_status in ('pending', 'paid_to_host'));
  end if;
end $$;

update public.bookings
set payout_status = 'pending'
where payout_status is null;

insert into storage.buckets (id, name, public)
values ('payment_proofs', 'payment_proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "users_upload_own_proof" on storage.objects;
drop policy if exists "users_read_own_proof" on storage.objects;
drop policy if exists "hosts_read_booking_proof" on storage.objects;
drop policy if exists "public_read_payment_proofs" on storage.objects;
drop policy if exists "admins_read_payment_proofs" on storage.objects;

create policy "users_upload_own_proof"
  on storage.objects for insert
  with check (
    bucket_id = 'payment_proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users_read_own_proof"
  on storage.objects for select
  using (
    bucket_id = 'payment_proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "hosts_read_booking_proof"
  on storage.objects for select
  using (
    bucket_id = 'payment_proofs'
    and exists (
      select 1
      from public.bookings b
      join public.listings l on l.id = b.listing_id
      where b.payment_proof_path = name
        and l.host_id = auth.uid()
    )
  );

create policy "admins_read_payment_proofs"
  on storage.objects for select
  using (
    bucket_id = 'payment_proofs'
    and public.is_admin()
  );

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('PENDING', 'CONFIRMED', 'ACCEPTED', 'COMPLETED', 'CANCELLED'));

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
  v_result public.bookings;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(nullif(btrim(p_payment_method), ''), 'BANK_TRANSFER') <> 'BANK_TRANSFER' then
    raise exception 'Legacy pay-later booking is unavailable for new bookings. Please use Bank Transfer.';
  end if;

  if p_payment_proof_path is null or btrim(p_payment_proof_path) = '' then
    raise exception 'Payment proof is required for bank transfer bookings.';
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

  v_pricing_band := case
    when p_start_time >= time '08:00' and p_start_time <= time '19:59' then 'DAY'
    else 'NIGHT'
  end;

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
  where l.id = p_listing_id
    and l.is_active = true
    and l.is_approved = true;

  if not found then
    raise exception 'Listing not available or not found: %', p_listing_id;
  end if;

  if v_host_id = v_user_id then
    raise exception 'Cannot book your own listing';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_listing_id::text), hashtext(p_date::text));

  if exists (
    select 1
    from public.bookings b
    where b.listing_id = p_listing_id
      and b.date = p_date
      and lower(b.status) not in ('declined', 'cancelled', 'rejected')
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
    payment_method, payment_status, payment_proof_path, payout_status,
    created_at, updated_at
  )
  values (
    v_user_id, p_listing_id, p_date, p_start_time, p_end_time, 'PENDING',
    p_vehicle_size, coalesce(p_estimated_kwh, v_vehicle_kwh), v_pricing_band,
    v_base_fee, v_user_service_fee, v_total_user_price,
    v_user_service_fee, v_host_platform_fee, v_gateway_fee,
    v_total_user_price, v_host_payout,
    'BANK_TRANSFER', 'proof_submitted', p_payment_proof_path, 'pending',
    now(), now()
  )
  returning id into v_booking_id;

  begin
    insert into public.notifications (user_id, type, title, message, data)
    values (
      v_user_id,
      'BOOKING_SUBMITTED',
      'Booking submitted',
      'Booking submitted. Waiting for EV-Net payment verification.',
      jsonb_build_object(
        'bookingId', v_booking_id,
        'booking_id', v_booking_id,
        'listingId', p_listing_id,
        'listing_id', p_listing_id,
        'route', '/app/bookings',
        'hostRoute', '/host/bookings'
      )
    );

    insert into public.notifications (user_id, type, title, message, data)
    values (
      v_host_id,
      'NEW_BOOKING_REQUEST',
      'New booking request',
      'New booking request received. EV-Net will verify payment before acceptance.',
      jsonb_build_object(
        'bookingId', v_booking_id,
        'booking_id', v_booking_id,
        'listingId', p_listing_id,
        'listing_id', p_listing_id,
        'route', '/app/bookings',
        'hostRoute', '/host/bookings'
      )
    );
  exception when others then
    null;
  end;

  select * into v_result
  from public.bookings
  where id = v_booking_id;

  return v_result;
end;
$$;

create or replace function public.verify_booking_payment(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
  v_listing_title text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only admins can verify payments.';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.payment_status is distinct from 'proof_submitted' then
    raise exception 'Payment verification requires payment_status to be proof_submitted.';
  end if;

  select title
  into v_listing_title
  from public.listings
  where id = v_booking.listing_id;

  update public.bookings
  set payment_status = 'paid',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, v_booking.status, v_booking.status, auth.uid(), 'EV-Net Admin verified payment proof'
  );

  insert into public.notifications (
    user_id, type, title, message, data
  ) values (
    v_booking.user_id,
    'PAYMENT',
    'Payment verified',
    format('Your payment for %s has been verified by EV-Net.', coalesce(v_listing_title, 'your booking')),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_booking.listing_id,
      'listing_id', v_booking.listing_id,
      'route', '/app/bookings',
      'type', 'PAYMENT_VERIFIED'
    )
  );

  return v_booking;
end;
$$;

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
  v_old_status text;
begin
  select b.*
  into v_booking
  from public.bookings b
  join public.listings l on l.id = b.listing_id
  where b.id = p_booking_id
    and l.host_id = v_user_id
  for update of b;

  if not found then
    raise exception 'Booking not found or you are not the host of this listing.';
  end if;

  select title
  into v_listing_title
  from public.listings
  where id = v_booking.listing_id;

  if lower(v_booking.status) <> 'pending' then
    raise exception 'Only PENDING bookings can be accepted.';
  end if;

  if v_booking.payment_status is distinct from 'paid' then
    raise exception 'EV-Net must verify payment before the host can accept this booking.';
  end if;

  v_old_status := v_booking.status;

  update public.bookings
  set status = 'CONFIRMED',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  update public.conversations
  set
    type = 'BOOKING',
    status = 'OPEN',
    extension_approved = true,
    updated_at = now()
  where user_id = v_booking.user_id
    and listing_id = v_booking.listing_id;

  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, v_old_status, 'CONFIRMED', v_user_id, 'Host accepted the booking request'
  );

  insert into public.notifications (
    user_id, type, title, message, data
  ) values (
    v_booking.user_id,
    'BOOKING_STATUS_UPDATE',
    'Booking confirmed',
    format('Your booking for %s has been confirmed!', coalesce(v_listing_title, 'this listing')),
    jsonb_build_object(
      'bookingId', v_booking.id,
      'booking_id', v_booking.id,
      'listingId', v_booking.listing_id,
      'listing_id', v_booking.listing_id,
      'route', '/app/bookings',
      'hostRoute', '/host/bookings'
    )
  );

  return v_booking;
end;
$$;

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_listing_title text;
  v_old_status text;
begin
  select b.*
  into v_booking
  from public.bookings b
  join public.listings l on l.id = b.listing_id
  where b.id = p_booking_id
    and l.host_id = v_user_id
  for update of b;

  if not found then
    raise exception 'Booking not found or you are not the host.';
  end if;

  select title
  into v_listing_title
  from public.listings
  where id = v_booking.listing_id;

  if lower(v_booking.status) not in ('confirmed', 'accepted') then
    raise exception 'Booking must be CONFIRMED or ACCEPTED to be marked as completed.';
  end if;

  if v_booking.payment_status is distinct from 'paid' then
    raise exception 'Booking must be paid before it can be marked as completed.';
  end if;

  v_old_status := v_booking.status;

  update public.bookings
  set status = 'COMPLETED',
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (
    booking_id, old_status, new_status, changed_by, reason
  ) values (
    p_booking_id, v_old_status, 'COMPLETED', v_user_id, 'Host marked charging session as completed'
  );

  insert into public.notifications (
    user_id, type, title, message, data
  ) values (
    v_booking.user_id,
    'BOOKING_STATUS_UPDATE',
    'Session completed',
    format('Your charging session at %s has been marked as completed.', coalesce(v_listing_title, 'this listing')),
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'listingId', v_booking.listing_id,
      'listing_id', v_booking.listing_id,
      'route', '/app/bookings',
      'type', 'COMPLETED'
    )
  );

  return v_booking;
end;
$$;

create or replace function public.admin_mark_payout_paid(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
  v_host_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status <> 'COMPLETED' then
    raise exception 'Booking must be COMPLETED before payout can be marked paid.';
  end if;

  if v_booking.payment_status is distinct from 'paid' then
    raise exception 'Booking payment must be paid by user before payout.';
  end if;

  if v_booking.payout_status is distinct from 'pending' then
    raise exception 'Payout is not pending.';
  end if;

  select l.host_id
  into v_host_id
  from public.listings l
  where l.id = v_booking.listing_id;

  update public.bookings
  set payout_status = 'paid_to_host',
      updated_at = now()
  where id = p_booking_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'MARK_PAYOUT_PAID',
    'BOOKING',
    p_booking_id,
    jsonb_build_object('amount', v_booking.host_payout)
  );

  insert into public.notifications (
    user_id, type, title, message, data
  ) values (
    v_host_id,
    'PAYMENT',
    'Payout sent',
    'Your payout for a completed booking has been transferred.',
    jsonb_build_object(
      'bookingId', p_booking_id,
      'booking_id', p_booking_id,
      'route', '/host/earnings',
      'type', 'PAYOUT_PAID'
    )
  );
end;
$$;

revoke execute on function public.create_booking(uuid, date, time, time, text, text, text, numeric, text) from public, anon;
grant execute on function public.create_booking(uuid, date, time, time, text, text, text, numeric, text) to authenticated;

revoke execute on function public.verify_booking_payment(uuid) from public, anon;
grant execute on function public.verify_booking_payment(uuid) to authenticated;

revoke execute on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

revoke execute on function public.complete_booking(uuid) from public, anon;
grant execute on function public.complete_booking(uuid) to authenticated;

revoke execute on function public.admin_mark_payout_paid(uuid) from public, anon;
grant execute on function public.admin_mark_payout_paid(uuid) to authenticated;

notify pgrst, 'reload schema';
