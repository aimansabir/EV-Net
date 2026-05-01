-- 063_fix_messaging_rpcs.sql
-- Restoring and unifying messaging RPCs

-- 1. Create or Get Inquiry (Legacy/Fallback name)
CREATE OR REPLACE FUNCTION public.create_or_get_inquiry(p_listing_id uuid)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_host_id uuid;
    v_conversation public.conversations;
BEGIN
    -- 1. Get host_id from listing
    SELECT host_id INTO v_host_id FROM public.listings WHERE id = p_listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found.';
    END IF;

    -- 2. Prevent messaging own listing
    IF v_host_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot inquire on your own listing.';
    END IF;

    -- 3. Check for existing inquiry
    SELECT * INTO v_conversation FROM public.conversations 
    WHERE listing_id = p_listing_id 
      AND user_id = auth.uid() 
      AND type = 'INQUIRY'
    LIMIT 1;

    -- 4. Create new if not exists
    IF NOT FOUND THEN
        INSERT INTO public.conversations (listing_id, user_id, host_id, type, status)
        VALUES (p_listing_id, auth.uid(), v_host_id, 'INQUIRY', 'OPEN')
        RETURNING * INTO v_conversation;
    END IF;

    RETURN NEXT v_conversation;
END;
$$;

-- 2. Start Conversation with Host (New name used in api.supabase.js)
CREATE OR REPLACE FUNCTION public.start_conversation_with_host(p_listing_id uuid)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.create_or_get_inquiry(p_listing_id);
END;
$$;

-- 3. Send Message with Privacy and Limits
CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id uuid, p_content text)
RETURNS setof public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conv public.conversations;
    v_message public.messages;
    v_is_user boolean;
    v_is_host boolean;
BEGIN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found.'; END IF;

    v_is_user := (auth.uid() = v_conv.user_id);
    v_is_host := (auth.uid() = v_conv.host_id);

    IF NOT v_is_user AND NOT v_is_host THEN
        RAISE EXCEPTION 'Unauthorized to post in this conversation.';
    END IF;

    IF v_conv.status IN ('ARCHIVED', 'FLAGGED', 'CLOSED') THEN
        RAISE EXCEPTION 'Cannot send message. Conversation is %.', v_conv.status;
    END IF;

    -- Privacy Filter (Simple)
    IF v_conv.type = 'INQUIRY' THEN
        IF p_content ~* '\d{10,}' OR p_content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
            RAISE EXCEPTION 'Privacy Filter: Sharing direct contact info is restricted before a booking is confirmed.';
        END IF;
    END IF;

    -- Insert message
    INSERT INTO public.messages (conversation_id, sender_id, type, content)
    VALUES (p_conversation_id, auth.uid(), 'USER', p_content)
    RETURNING * INTO v_message;

    UPDATE public.conversations SET updated_at = now() WHERE id = p_conversation_id;

    RETURN NEXT v_message;
END;
$$;

-- 4. Extension Mechanics
CREATE OR REPLACE FUNCTION public.request_extension(p_conversation_id uuid)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conv public.conversations;
BEGIN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized or not found.'; END IF;

    IF NOT v_conv.extension_requested THEN
        UPDATE public.conversations SET extension_requested = true, updated_at = now() WHERE id = p_conversation_id RETURNING * INTO v_conv;
        INSERT INTO public.messages (conversation_id, type, content) VALUES (p_conversation_id, 'SYSTEM', 'Guest requested to continue this inquiry.');
    END IF;
    RETURN NEXT v_conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_extension(p_conversation_id uuid)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conv public.conversations;
BEGIN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id AND host_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized or not found.'; END IF;

    UPDATE public.conversations SET extension_approved = true, status = 'OPEN', updated_at = now() where id = p_conversation_id RETURNING * INTO v_conv;
    INSERT INTO public.messages (conversation_id, type, content) VALUES (p_conversation_id, 'SYSTEM', 'Host approved 3 more messages for this inquiry.');
    RETURN NEXT v_conv;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_extension(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_extension(uuid) TO authenticated;
