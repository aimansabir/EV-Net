-- 021_bookings_rpc.sql
-- Phase 2: Booking transaction and verification gating

-- Drop if exists to allow clean replacement
drop function if exists public.create_booking(uuid, date, time, time);

create or replace function public.create_booking(
  p_listing_id uuid,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_ev_profile record;
  v_listing record;
  v_overlap boolean;
  v_hours numeric;
  v_base_fee numeric;
  v_service_fee numeric;
  v_total_fee numeric;
  v_booking_id uuid;
begin
  -- 1. Enforce Verification Gating
  select * into v_ev_profile from public.ev_profiles where user_id = auth.uid();
  
  if v_ev_profile is null 
     or v_ev_profile.verification_status != 'approved' 
     or not v_ev_profile.email_verified 
     or not v_ev_profile.phone_verified 
     or not v_ev_profile.cnic_submitted 
     or not v_ev_profile.ev_proof_submitted 
  then
    raise exception 'Verification Required: You must be fully verified to book a charger.';
  end if;

  -- 2. Lock listing for transaction safety
  select * into v_listing from public.listings 
  where id = p_listing_id and is_active = true and is_approved = true
  for update;

  if not found then
    raise exception 'Listing not available or not found.';
  end if;

  -- Cannot book own listing
  if v_listing.host_id = auth.uid() then
    raise exception 'You cannot book your own charger.';
  end if;

  -- 3. Check for overlap to prevent double bookings
  select exists(
    select 1 from public.bookings
    where listing_id = p_listing_id
      and date = p_date
      and status not in ('CANCELLED')
      and (
        (start_time < p_end_time) and (end_time > p_start_time)
      )
  ) into v_overlap;

  if v_overlap then
    raise exception 'Slot Unavailable: This time slot is already booked.';
  end if;

  -- 4. Calculate Fees (Matches src/data/feeConfig.js exactly)
  v_hours := extract(epoch from (p_end_time - p_start_time)) / 3600;
  if v_hours <= 0 then
    raise exception 'Invalid booking duration.';
  end if;

  v_base_fee := v_listing.price_per_hour * v_hours;
  
  v_service_fee := v_base_fee * 0.10; -- 10%
  if v_service_fee < 50 then v_service_fee := 50; end if;
  if v_service_fee > 2000 then v_service_fee := 2000; end if;
  v_service_fee := round(v_service_fee);
  
  v_total_fee := v_base_fee + v_service_fee;

  -- 5. Insert Booking
  insert into public.bookings (
    user_id, listing_id, date, start_time, end_time, 
    status, base_fee, service_fee, total_fee
  ) values (
    auth.uid(), p_listing_id, p_date, p_start_time, p_end_time,
    'PENDING', v_base_fee, v_service_fee, v_total_fee
  ) returning id into v_booking_id;

  -- 6. Log Status History
  insert into public.booking_status_history (
    booking_id, new_status, changed_by, reason
  ) values (
    v_booking_id, 'PENDING', auth.uid(), 'Initial booking requested'
  );

  return v_booking_id;
end;
$$;
