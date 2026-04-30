-- Allow admins to send notifications to users
-- This fixes the error: "new row violates row-level security policy for table 'notifications'"

CREATE POLICY "notifications_insert_admin"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());
