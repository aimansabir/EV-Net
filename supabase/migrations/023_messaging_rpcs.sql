-- 023_messaging_rpcs.sql
-- Enables Realtime on messages and defines the structured inquiry RPCs

-- Ensure messages table is broadcasted over Realtime
alter publication supabase_realtime add table public.messages;

-- 1. Create or Get Inquiry
create or replace function public.create_or_get_inquiry(p_listing_id uuid)
returns setof public.conversations
language plpgsql
security definer
as $$
declare
    v_host_id uuid;
    v_conversation public.conversations;
begin
    select host_id into v_host_id from public.listings where id = p_listing_id;
    if not found then
        raise exception 'Listing not found.';
    end if;

    if v_host_id = auth.uid() then
        raise exception 'Cannot inquire on your own listing.';
    end if;

    -- Look for existing inquiry
    select * into v_conversation from public.conversations 
    where listing_id = p_listing_id and user_id = auth.uid() and type = 'INQUIRY'
    limit 1;

    if not found then
        insert into public.conversations (listing_id, user_id, host_id, type, status)
        values (p_listing_id, auth.uid(), v_host_id, 'INQUIRY', 'OPEN')
        returning * into v_conversation;
    end if;

    return next v_conversation;
end;
$$;

-- 2. Send Message with Privacy and Limits
create or replace function public.send_message(p_conversation_id uuid, p_content text)
returns setof public.messages
language plpgsql
security definer
as $$
declare
    v_conv public.conversations;
    v_message public.messages;
    v_is_user boolean;
    v_is_host boolean;
begin
    select * into v_conv from public.conversations where id = p_conversation_id for update;
    if not found then raise exception 'Conversation not found.'; end if;

    v_is_user := (auth.uid() = v_conv.user_id);
    v_is_host := (auth.uid() = v_conv.host_id);

    if not v_is_user and not v_is_host then
        raise exception 'Unauthorized to post in this conversation.';
    end if;

    if v_conv.status in ('ARCHIVED', 'FLAGGED', 'CLOSED') then
        raise exception 'Cannot send message. Conversation is %.', v_conv.status;
    end if;

    -- Limits & Privacy Filters
    if v_conv.type = 'INQUIRY' then
        -- Simple server-side regex filter for 10+ digits or email shapes
        if p_content ~* '\d{10,}' or p_content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' then
            raise exception 'Privacy Filter: Sharing direct contact info is restricted before a booking is confirmed.';
        end if;

        if v_is_user then
            if v_conv.status = 'LOCKED' then
                if not v_conv.extension_approved or v_conv.extension_count >= v_conv.extension_limit then
                    raise exception 'Inquiry limit reached. Book to continue chatting.';
                end if;
            end if;

            if not v_conv.extension_approved then
                if v_conv.message_count >= 3 then
                    update public.conversations set status = 'LOCKED' where id = p_conversation_id;
                    raise exception 'Inquiry limit reached. Book to continue chatting.';
                end if;
                
                update public.conversations set message_count = message_count + 1 where id = p_conversation_id;
                v_conv.message_count := v_conv.message_count + 1;

                if v_conv.message_count >= 3 then
                    update public.conversations set status = 'LOCKED' where id = p_conversation_id;
                end if;
            else
                if v_conv.extension_count >= v_conv.extension_limit then
                    update public.conversations set status = 'LOCKED' where id = p_conversation_id;
                    raise exception 'Extension limit reached. Booking is now required.';
                end if;
                
                update public.conversations set extension_count = extension_count + 1 where id = p_conversation_id;
                v_conv.extension_count := v_conv.extension_count + 1;

                if v_conv.extension_count >= v_conv.extension_limit then
                    update public.conversations set status = 'LOCKED' where id = p_conversation_id;
                end if;
            end if;
        end if;
    end if;

    -- Insert message securely
    insert into public.messages (conversation_id, sender_id, type, content)
    values (p_conversation_id, auth.uid(), 'USER', p_content)
    returning * into v_message;

    update public.conversations set updated_at = now() where id = p_conversation_id;

    return next v_message;
end;
$$;

-- 3. Extension Mechanics
create or replace function public.request_extension(p_conversation_id uuid)
returns setof public.conversations
language plpgsql
security definer
as $$
declare
    v_conv public.conversations;
begin
    select * into v_conv from public.conversations where id = p_conversation_id and user_id = auth.uid() for update;
    if not found then raise exception 'Unauthorized or not found.'; end if;

    if not v_conv.extension_requested then
        update public.conversations set extension_requested = true, updated_at = now() where id = p_conversation_id returning * into v_conv;
        insert into public.messages (conversation_id, type, content) values (p_conversation_id, 'SYSTEM', 'Guest requested to continue this inquiry.');
    else 
        v_conv := v_conv;
    end if;
    return next v_conv;
end;
$$;

create or replace function public.approve_extension(p_conversation_id uuid)
returns setof public.conversations
language plpgsql
security definer
as $$
declare
    v_conv public.conversations;
begin
    select * into v_conv from public.conversations where id = p_conversation_id and host_id = auth.uid() for update;
    if not found then raise exception 'Unauthorized or not found.'; end if;

    update public.conversations set extension_approved = true, status = 'OPEN', updated_at = now() where id = p_conversation_id returning * into v_conv;
    insert into public.messages (conversation_id, type, content) values (p_conversation_id, 'SYSTEM', 'Host approved 3 more messages for this inquiry.');
    return next v_conv;
end;
$$;
