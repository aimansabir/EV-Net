-- 074_fix_booking_rls_and_notifications.sql
-- Allow hosts to update booking status and fix notification types

-- 1. RLS for Host Updates
create policy "bookings_update_host"
  on public.bookings for update
  using (
    exists(select 1 from public.listings where id = listing_id and host_id = auth.uid())
  )
  with check (
    exists(select 1 from public.listings where id = listing_id and host_id = auth.uid())
  );

-- 2. RLS for User Cancellations (Optional but helpful)
create policy "bookings_update_user"
  on public.bookings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Expand Notification Types Constraint
alter table public.notifications 
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check 
  check (type in (
    'SYSTEM',
    'BOOKING_UPDATE',
    'PAYMENT',
    'VERIFICATION',
    'MESSAGE',
    'BOOKING_SUBMITTED',
    'NEW_BOOKING_REQUEST',
    'BOOKING_STATUS_UPDATE' -- Added to match api.supabase.js
  ));
