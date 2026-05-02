-- 070_add_cnic_to_host_profiles.sql
-- Add cnic_number column to host_profiles to allow restoration during onboarding resubmission.

ALTER TABLE public.host_profiles
ADD COLUMN IF NOT EXISTS cnic_number text;

-- Allow users to update their own cnic_number
-- (RLS policies already exist for update, but ensure it's not restricted)
