-- 067_messaging_rpc_simplified_return.sql
-- Returning only UUID to avoid schema mismatch with table types

DROP FUNCTION IF EXISTS public.create_or_get_inquiry(uuid);
DROP FUNCTION IF EXISTS public.create_or_get_inquiry(text);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(uuid);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(text);

-- 1. Create or Get Inquiry (Returns UUID)
CREATE OR REPLACE FUNCTION public.create_or_get_inquiry(p_listing_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_host_id uuid;
    v_conversation_id uuid;
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
    SELECT id INTO v_conversation_id FROM public.conversations 
    WHERE listing_id = p_listing_id 
      AND user_id = auth.uid() 
      AND type = 'INQUIRY'
    LIMIT 1;

    -- Create new if needed
    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (listing_id, user_id, host_id, type, status)
        VALUES (p_listing_id, auth.uid(), v_host_id, 'INQUIRY', 'OPEN')
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;

-- 2. Start Conversation with Host (Returns UUID)
CREATE OR REPLACE FUNCTION public.start_conversation_with_host(p_listing_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_or_get_inquiry(p_listing_id);
END;
$$;

-- Text overloads for safety
CREATE OR REPLACE FUNCTION public.create_or_get_inquiry(p_listing_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_or_get_inquiry(p_listing_id::uuid);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_conversation_with_host(p_listing_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_or_get_inquiry(p_listing_id::uuid);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(text) TO authenticated;
