-- 068_messaging_rpc_rename.sql
-- Final messaging/notification fix without adding another migration:
-- - use one text signature per browser-facing RPC to avoid PostgREST overload ambiguity
-- - restore inquiry message limits in send_message
-- - remove notification de-duping so every new message can notify the recipient
-- - add notifications to realtime for live bell updates

DROP FUNCTION IF EXISTS public.initialize_inquiry(uuid);
DROP FUNCTION IF EXISTS public.initialize_inquiry(text);
DROP FUNCTION IF EXISTS public.create_or_get_inquiry(uuid);
DROP FUNCTION IF EXISTS public.create_or_get_inquiry(text);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(uuid);
DROP FUNCTION IF EXISTS public.start_conversation_with_host(text);
DROP FUNCTION IF EXISTS public.send_message(uuid, text);
DROP FUNCTION IF EXISTS public.send_message(text, text);
DROP FUNCTION IF EXISTS public.request_extension(uuid);
DROP FUNCTION IF EXISTS public.request_extension(text);
DROP FUNCTION IF EXISTS public.approve_extension(uuid);
DROP FUNCTION IF EXISTS public.approve_extension(text);

DROP INDEX IF EXISTS public.idx_notifications_dedupe_user_type_message;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_user_id_type_message_key'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT notifications_user_id_type_message_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.initialize_inquiry(p_listing_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_listing_id uuid;
  v_host_id uuid;
  v_conversation_id uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Please log in to message the host.';
  END IF;

  v_listing_id := p_listing_id::uuid;

  SELECT host_id
    INTO v_host_id
  FROM public.listings
  WHERE id = v_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_host_id = v_actor THEN
    RAISE EXCEPTION 'Cannot inquire on your own listing.';
  END IF;

  SELECT id
    INTO v_conversation_id
  FROM public.conversations
  WHERE listing_id = v_listing_id
    AND user_id = v_actor
    AND type = 'INQUIRY'
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (listing_id, user_id, host_id, type, status)
    VALUES (v_listing_id, v_actor, v_host_id, 'INQUIRY', 'OPEN')
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_or_get_inquiry(p_listing_id text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.initialize_inquiry(p_listing_id);
$$;

CREATE OR REPLACE FUNCTION public.start_conversation_with_host(p_listing_id text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.initialize_inquiry(p_listing_id);
$$;

CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id text, p_content text)
RETURNS SETOF public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_conversation_id uuid;
  v_content text;
  v_conv public.conversations;
  v_message public.messages;
  v_is_user boolean;
  v_is_host boolean;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Please log in to send messages.';
  END IF;

  v_conversation_id := p_conversation_id::uuid;
  v_content := btrim(coalesce(p_content, ''));

  IF v_content = '' THEN
    RAISE EXCEPTION 'Message cannot be empty.';
  END IF;

  SELECT *
    INTO v_conv
  FROM public.conversations
  WHERE id = v_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found.';
  END IF;

  v_is_user := (v_actor = v_conv.user_id);
  v_is_host := (v_actor = v_conv.host_id);

  IF NOT v_is_user AND NOT v_is_host THEN
    RAISE EXCEPTION 'Unauthorized to post in this conversation.';
  END IF;

  IF v_conv.status IN ('ARCHIVED', 'FLAGGED', 'CLOSED') THEN
    RAISE EXCEPTION 'Cannot send message. Conversation is %.', v_conv.status;
  END IF;

  IF v_conv.type = 'INQUIRY' THEN
    IF v_content ~* '\d{10,}'
      OR v_content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
      RAISE EXCEPTION 'Privacy Filter: Sharing direct contact info is restricted before a booking is confirmed.';
    END IF;

    IF v_is_user THEN
      IF v_conv.extension_approved THEN
        IF v_conv.status = 'LOCKED' AND v_conv.extension_count >= v_conv.extension_limit THEN
          RAISE EXCEPTION 'Extension limit reached. Booking is now required.';
        END IF;

        IF v_conv.extension_count >= v_conv.extension_limit THEN
          UPDATE public.conversations
          SET status = 'LOCKED'
          WHERE id = v_conversation_id;
          RAISE EXCEPTION 'Extension limit reached. Booking is now required.';
        END IF;

        UPDATE public.conversations
        SET
          extension_count = extension_count + 1,
          status = CASE
            WHEN extension_count + 1 >= extension_limit THEN 'LOCKED'
            ELSE 'OPEN'
          END
        WHERE id = v_conversation_id
        RETURNING * INTO v_conv;
      ELSE
        IF v_conv.status = 'LOCKED' OR v_conv.message_count >= 3 THEN
          UPDATE public.conversations
          SET status = 'LOCKED'
          WHERE id = v_conversation_id;
          RAISE EXCEPTION 'Inquiry limit reached. Book to continue chatting.';
        END IF;

        UPDATE public.conversations
        SET
          message_count = message_count + 1,
          status = CASE
            WHEN message_count + 1 >= 3 THEN 'LOCKED'
            ELSE status
          END
        WHERE id = v_conversation_id
        RETURNING * INTO v_conv;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, type, content)
  VALUES (v_conversation_id, v_actor, 'USER', v_content)
  RETURNING * INTO v_message;

  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = v_conversation_id;

  RETURN NEXT v_message;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_extension(p_conversation_id text)
RETURNS SETOF public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_conversation_id uuid;
  v_conv public.conversations;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Please log in to request an extension.';
  END IF;

  v_conversation_id := p_conversation_id::uuid;

  SELECT *
    INTO v_conv
  FROM public.conversations
  WHERE id = v_conversation_id
    AND user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or not found.';
  END IF;

  IF NOT v_conv.extension_requested THEN
    UPDATE public.conversations
    SET extension_requested = true, updated_at = now()
    WHERE id = v_conversation_id
    RETURNING * INTO v_conv;

    INSERT INTO public.messages (conversation_id, type, content)
    VALUES (v_conversation_id, 'SYSTEM', 'Guest requested to continue this inquiry.');
  END IF;

  RETURN NEXT v_conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_extension(p_conversation_id text)
RETURNS SETOF public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_conversation_id uuid;
  v_conv public.conversations;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Please log in to approve an extension.';
  END IF;

  v_conversation_id := p_conversation_id::uuid;

  SELECT *
    INTO v_conv
  FROM public.conversations
  WHERE id = v_conversation_id
    AND host_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or not found.';
  END IF;

  UPDATE public.conversations
  SET
    extension_approved = true,
    status = 'OPEN',
    updated_at = now()
  WHERE id = v_conversation_id
  RETURNING * INTO v_conv;

  INSERT INTO public.messages (conversation_id, type, content)
  VALUES (v_conversation_id, 'SYSTEM', 'Host approved 3 more messages for this inquiry.');

  RETURN NEXT v_conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initialize_inquiry(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_inquiry(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation_with_host(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_extension(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_extension(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
