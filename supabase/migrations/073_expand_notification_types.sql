-- 073_expand_notification_types.sql
-- Allow more notification types for booking flow

alter table public.notifications 
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check 
  check (type in ('SYSTEM','BOOKING_UPDATE','PAYMENT','VERIFICATION','MESSAGE','BOOKING_SUBMITTED','NEW_BOOKING_REQUEST'));
