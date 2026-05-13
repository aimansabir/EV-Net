-- 094_archive_listings.sql
-- Adds safe soft-archive functionality for admin moderation

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'archived_at') THEN
        ALTER TABLE public.listings ADD COLUMN archived_at timestamptz DEFAULT null;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'archived_by') THEN
        ALTER TABLE public.listings ADD COLUMN archived_by uuid DEFAULT null REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'archive_reason') THEN
        ALTER TABLE public.listings ADD COLUMN archive_reason text DEFAULT null;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_archive_listing(
  p_listing_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can archive listings';
  END IF;

  UPDATE public.listings
  SET
    archived_at = now(),
    archived_by = v_admin,
    archive_reason = COALESCE(p_reason, 'Archived by admin'),
    is_active = false
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_unarchive_listing(
  p_listing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can unarchive listings';
  END IF;

  UPDATE public.listings
  SET
    archived_at = null,
    archived_by = null,
    archive_reason = null
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END $$;
