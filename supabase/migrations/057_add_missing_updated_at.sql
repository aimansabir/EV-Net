-- 057_add_missing_updated_at.sql
-- Fixes "record 'new' has no field 'updated_at'" by ensuring all tables 
-- that might be involved in admin workflows have the expected timestamp column and triggers.

-- 1. verification_submissions
ALTER TABLE public.verification_submissions 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS verification_submissions_updated_at ON public.verification_submissions;
CREATE TRIGGER verification_submissions_updated_at
  BEFORE UPDATE ON public.verification_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. moderation_reviews
ALTER TABLE public.moderation_reviews 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS moderation_reviews_updated_at ON public.moderation_reviews;
CREATE TRIGGER moderation_reviews_updated_at
  BEFORE UPDATE ON public.moderation_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. audit_logs
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS audit_logs_updated_at ON public.audit_logs;
CREATE TRIGGER audit_logs_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
