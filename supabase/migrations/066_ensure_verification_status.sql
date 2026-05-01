-- 066_ensure_verification_status.sql
-- Ensuring verification_status exists in host_profiles

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'host_profiles' AND column_name = 'verification_status') THEN
        ALTER TABLE public.host_profiles ADD COLUMN verification_status text NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft','pending_docs','under_review','approved','rejected'));
    END IF;
END $$;
