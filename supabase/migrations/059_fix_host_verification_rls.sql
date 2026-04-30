-- Fix host_profiles RLS to allow users to submit for review
-- Previous policy blocked ANY change to verification_status

DROP POLICY IF EXISTS "host_profiles_update_own" ON public.host_profiles;

CREATE POLICY "host_profiles_update_own"
  ON public.host_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Case 1: Keeping same status (updating other fields like phone)
      verification_status = (SELECT verification_status FROM host_profiles WHERE user_id = auth.uid())
      OR
      -- Case 2: Submitting for review
      (
        (SELECT verification_status FROM host_profiles WHERE user_id = auth.uid()) = 'draft'
        AND verification_status = 'under_review'
      )
    )
  );
