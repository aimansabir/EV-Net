-- 065_messaging_rpc_final_fix.sql
-- Final attempt at making messaging RPCs visible and matching

-- Clean up all possible versions
DROP FUNCTION IF EXISTS public.create_or_get_inquiry(uuid);
DROP FUNCTION IF EXISTS public.create_or_get_inquiry(text);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(uuid);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(text);

-- 1. Create or Get Inquiry (accepts text/uuid)
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
    -- Get host_id
    SELECT host_id INTO v_host_id FROM public.listings WHERE id = p_listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found.';
    END IF;

    -- Prevent messaging own listing
    IF v_host_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot inquire on your own listing.';
    END IF;

    -- Look for existing
    SELECT * INTO v_conversation FROM public.conversations 
    WHERE listing_id = p_listing_id 
      AND user_id = auth.uid() 
      AND type = 'INQUIRY'
    LIMIT 1;

    -- Create new if needed
    IF NOT FOUND THEN
        INSERT INTO public.conversations (listing_id, user_id, host_id, type, status)
        VALUES (p_listing_id, auth.uid(), v_host_id, 'INQUIRY', 'OPEN')
        RETURNING * INTO v_conversation;
    END IF;

    RETURN NEXT v_conversation;
END;
$$;

-- 2. Start Conversation with Host (wrapper)
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

-- Alias for text to be safe
CREATE OR REPLACE FUNCTION public.create_or_get_inquiry(p_listing_id text)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.create_or_get_inquiry(p_listing_id::uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_conversation_with_host(p_listing_id text)
RETURNS setof public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.create_or_get_inquiry(p_listing_id::uuid);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(text) TO authenticated;
