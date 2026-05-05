-- 079_fix_booking_messaging_unlock.sql
-- Unlock inquiry conversations once the user has a valid booking for the same listing.

create or replace function public.initialize_inquiry(p_listing_id text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_listing_id uuid;
  v_host_id uuid;
  v_conversation_id uuid;
  v_has_valid_booking boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Please log in to message the host.';
  end if;

  v_listing_id := p_listing_id::uuid;

  select host_id
    into v_host_id
  from public.listings
  where id = v_listing_id;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if v_host_id = v_actor then
    raise exception 'Cannot inquire on your own listing.';
  end if;

  select exists (
    select 1
    from public.bookings b
    where b.user_id = v_actor
      and b.listing_id = v_listing_id
      and lower(b.status) in ('pending', 'confirmed', 'accepted', 'active', 'completed')
  ) into v_has_valid_booking;

  if v_has_valid_booking then
    select id
      into v_conversation_id
    from public.conversations
    where listing_id = v_listing_id
      and user_id = v_actor
    order by
      case when type = 'BOOKING' then 0 else 1 end,
      updated_at desc
    limit 1;

    if v_conversation_id is not null then
      update public.conversations
      set
        type = 'BOOKING',
        status = 'OPEN',
        extension_approved = true,
        updated_at = now()
      where id = v_conversation_id;

      return v_conversation_id;
    end if;
  end if;

  select id
    into v_conversation_id
  from public.conversations
  where listing_id = v_listing_id
    and user_id = v_actor
    and type = 'INQUIRY'
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations (listing_id, user_id, host_id, type, status)
    values (v_listing_id, v_actor, v_host_id, 'INQUIRY', 'OPEN')
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

create or replace function public.create_or_get_inquiry(p_listing_id text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.initialize_inquiry(p_listing_id);
$$;

create or replace function public.start_conversation_with_host(p_listing_id text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.initialize_inquiry(p_listing_id);
$$;

create or replace function public.send_message(p_conversation_id text, p_content text)
returns setof public.messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_conversation_id uuid;
  v_content text;
  v_conv public.conversations;
  v_message public.messages;
  v_is_user boolean;
  v_is_host boolean;
  v_has_valid_booking boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Please log in to send messages.';
  end if;

  v_conversation_id := p_conversation_id::uuid;
  v_content := btrim(coalesce(p_content, ''));

  if v_content = '' then
    raise exception 'Message cannot be empty.';
  end if;

  select *
    into v_conv
  from public.conversations
  where id = v_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  v_is_user := (v_actor = v_conv.user_id);
  v_is_host := (v_actor = v_conv.host_id);

  if not v_is_user and not v_is_host then
    raise exception 'Unauthorized to post in this conversation.';
  end if;

  if v_conv.status in ('ARCHIVED', 'FLAGGED', 'CLOSED') then
    raise exception 'Cannot send message. Conversation is %.', v_conv.status;
  end if;

  select exists (
    select 1
    from public.bookings b
    where b.user_id = v_conv.user_id
      and b.listing_id = v_conv.listing_id
      and lower(b.status) in ('pending', 'confirmed', 'accepted', 'active', 'completed')
  ) into v_has_valid_booking;

  if v_has_valid_booking then
    update public.conversations
    set
      type = 'BOOKING',
      status = 'OPEN',
      extension_approved = true,
      updated_at = now()
    where id = v_conversation_id
    returning * into v_conv;
  end if;

  if v_conv.type = 'INQUIRY' then
    if v_content ~* '\d{10,}'
      or v_content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' then
      raise exception 'Privacy Filter: Sharing direct contact info is restricted before a booking is confirmed.';
    end if;

    if v_is_user then
      if v_conv.extension_approved then
        if v_conv.status = 'LOCKED' and v_conv.extension_count >= v_conv.extension_limit then
          raise exception 'Extension limit reached. Booking is now required.';
        end if;

        if v_conv.extension_count >= v_conv.extension_limit then
          update public.conversations
          set status = 'LOCKED'
          where id = v_conversation_id;
          raise exception 'Extension limit reached. Booking is now required.';
        end if;

        update public.conversations
        set
          extension_count = extension_count + 1,
          status = case
            when extension_count + 1 >= extension_limit then 'LOCKED'
            else 'OPEN'
          end
        where id = v_conversation_id
        returning * into v_conv;
      else
        if v_conv.status = 'LOCKED' or v_conv.message_count >= 3 then
          update public.conversations
          set status = 'LOCKED'
          where id = v_conversation_id;
          raise exception 'Inquiry limit reached. Book to continue chatting.';
        end if;

        update public.conversations
        set
          message_count = message_count + 1,
          status = case
            when message_count + 1 >= 3 then 'LOCKED'
            else status
          end
        where id = v_conversation_id
        returning * into v_conv;
      end if;
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, type, content)
  values (v_conversation_id, v_actor, 'USER', v_content)
  returning * into v_message;

  update public.conversations
  set updated_at = now()
  where id = v_conversation_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    data
  )
  values (
    case when v_is_user then v_conv.host_id else v_conv.user_id end,
    'MESSAGE',
    'New message',
    'You have a new message.',
    jsonb_build_object(
      'conversationId', v_conversation_id,
      'conversation_id', v_conversation_id,
      'listingId', v_conv.listing_id,
      'senderId', v_actor,
      'route', '/app/messages?conversation=' || v_conversation_id,
      'hostRoute', '/host/messages?conversation=' || v_conversation_id
    )
  );

  return next v_message;
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

  update public.conversations
  set
    type = 'BOOKING',
    status = 'OPEN',
    extension_approved = true,
    updated_at = now()
  where user_id = v_user_id
    and listing_id = p_listing_id;

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
  select l.title into v_listing_title
  from public.listings l
  join public.bookings b on b.listing_id = l.id
  where b.id = p_booking_id
    and l.host_id = v_user_id;

  if not found then
    raise exception 'Booking not found or you are not the host of this listing.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if lower(v_booking.status) != 'pending' then
    raise exception 'Only PENDING bookings can be accepted.';
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

update public.conversations c
set
  type = 'BOOKING',
  status = 'OPEN',
  extension_approved = true,
  updated_at = now()
where exists (
  select 1
  from public.bookings b
  where b.user_id = c.user_id
    and b.listing_id = c.listing_id
    and lower(b.status) in ('pending', 'confirmed', 'accepted', 'active', 'completed')
)
and (
  c.type is distinct from 'BOOKING'
  or c.status is distinct from 'OPEN'
  or c.extension_approved is distinct from true
);

grant execute on function public.initialize_inquiry(text) to authenticated;
grant execute on function public.create_or_get_inquiry(text) to authenticated;
grant execute on function public.start_conversation_with_host(text) to authenticated;
grant execute on function public.send_message(text, text) to authenticated;

revoke execute on function public.accept_booking(uuid) from public, anon;
grant execute on function public.accept_booking(uuid) to authenticated;

grant execute on function public.create_booking(uuid, date, time, time, text, text, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';
