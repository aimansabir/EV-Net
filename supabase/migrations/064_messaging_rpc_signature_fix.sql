-- 064_messaging_rpc_signature_fix.sql
-- Adjusting signature to be more robust for PostgREST matching

DROP FUNCTION IF EXISTS public.create_or_get_inquiry(uuid);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(uuid);

-- 1. Create or Get Inquiry
CREATE OR REPLACE FUNCTION public.create_or_get_inquiry(p_listing_id text)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_listing_id uuid;
    v_host_id uuid;
    v_conversation public.conversations;
BEGIN
    v_listing_id := p_listing_id::uuid;

    -- 1. Get host_id from listing
    SELECT host_id INTO v_host_id FROM public.listings WHERE id = v_listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found.';
    END IF;

    -- 2. Prevent messaging own listing
    IF v_host_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot inquire on your own listing.';
    END IF;

    -- 3. Check for existing inquiry
    SELECT * INTO v_conversation FROM public.conversations 
    WHERE listing_id = v_listing_id 
      AND user_id = auth.uid() 
      AND type = 'INQUIRY'
    LIMIT 1;

    -- 4. Create new if not exists
    IF NOT FOUND THEN
        INSERT INTO public.conversations (listing_id, user_id, host_id, type, status)
        VALUES (v_listing_id, auth.uid(), v_host_id, 'INQUIRY', 'OPEN')
        RETURNING * INTO v_conversation;
    END IF;

    RETURN NEXT v_conversation;
END;
$$;

-- 2. Start Conversation with Host
CREATE OR REPLACE FUNCTION public.start_conversation_with_host(p_listing_id text)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.create_or_get_inquiry(p_listing_id);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(text) TO authenticated;
