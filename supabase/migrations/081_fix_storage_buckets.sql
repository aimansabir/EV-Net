-- 081_fix_storage_buckets.sql
-- Ensures all required buckets exist and have correct privacy settings.

-- 1. Ensure 'payment_proofs' bucket exists and is PUBLIC
-- This is necessary because the frontend uses getPublicUrl to display proofs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Ensure 'listing_photos' bucket exists and is PUBLIC
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing_photos', 'listing_photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Ensure 'verification_documents' bucket exists and is PRIVATE
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification_documents', 'verification_documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4. Storage Policies for payment_proofs (ensure they are correct)
-- Drop old policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "users_upload_own_proof" ON storage.objects;
DROP POLICY IF EXISTS "users_read_own_proof" ON storage.objects;
DROP POLICY IF EXISTS "hosts_read_booking_proof" ON storage.objects;
DROP POLICY IF EXISTS "public_read_payment_proofs" ON storage.objects;

-- Allow authenticated users to upload their own proofs
CREATE POLICY "users_upload_own_proof"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment_proofs' AND (auth.role() = 'authenticated'));

-- Since we set public = true, we need a SELECT policy for public access if we want getPublicUrl to work without a session
-- However, getPublicUrl on a public bucket doesn't strictly require an RLS policy if "public" is true, 
-- but it's safer to have one.
CREATE POLICY "public_read_payment_proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment_proofs');

-- Ensure verification_documents has correct private policies
DROP POLICY IF EXISTS "users_read_own_verification" ON storage.objects;
DROP POLICY IF EXISTS "admins_read_all_verification" ON storage.objects;

CREATE POLICY "users_read_own_verification"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verification_documents' AND auth.uid() = owner);

CREATE POLICY "admins_read_all_verification"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verification_documents' AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  ));
