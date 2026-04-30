-- 058_notification_rls_and_cnic_back.sql
-- Fix: Allow authenticated users to insert notifications (was blocked by missing RLS policy).
-- Fix: Widen the type CHECK constraint to allow new notification types used in the codebase.
-- Feature: Add CNIC back side support to verification flow.

-- ═══════════════════════════════════════════════════════════
-- 1. NOTIFICATION INSERT POLICY (ROOT CAUSE FIX)
-- ═══════════════════════════════════════════════════════════
-- The original migration 015 had no INSERT policy, so every
-- notificationService.create() call from the frontend was silently
-- blocked by RLS. We allow any authenticated user to insert a
-- notification for any user_id (the admin inserts notifications
-- for OTHER users during verification).

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- 2. WIDEN NOTIFICATION TYPE CHECK CONSTRAINT
-- ═══════════════════════════════════════════════════════════
-- The codebase uses types like 'BOOKING_SUBMITTED', 'NEW_BOOKING_REQUEST',
-- 'BOOKING_STATUS_UPDATE', 'MESSAGE' that the original CHECK didn't allow.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'SYSTEM',
    'BOOKING_UPDATE',
    'BOOKING_SUBMITTED',
    'NEW_BOOKING_REQUEST',
    'BOOKING_STATUS_UPDATE',
    'PAYMENT',
    'VERIFICATION',
    'MESSAGE'
  ));

-- ═══════════════════════════════════════════════════════════
-- 3. CNIC BACK SIDE SUPPORT
-- ═══════════════════════════════════════════════════════════

-- Add cnic_back_path column to verification_submissions
ALTER TABLE public.verification_submissions
  ADD COLUMN IF NOT EXISTS cnic_back_path text;

-- Add cnic_back_submitted flag to ev_profiles
ALTER TABLE public.ev_profiles
  ADD COLUMN IF NOT EXISTS cnic_back_submitted boolean NOT NULL DEFAULT false;

-- Add cnic_back_submitted flag to host_profiles (hosts also upload CNIC)
ALTER TABLE public.host_profiles
  ADD COLUMN IF NOT EXISTS cnic_back_submitted boolean NOT NULL DEFAULT false;
