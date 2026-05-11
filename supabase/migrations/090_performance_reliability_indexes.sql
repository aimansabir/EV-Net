-- 090_performance_reliability_indexes.sql
-- Target the repeated read paths used by listing detail availability,
-- dashboards, host listings, and verification document hydration.

create index if not exists idx_bookings_listing_date_active
  on public.bookings(listing_id, date, start_time)
  where archived_at is null
    and status <> 'CANCELLED';

create index if not exists idx_bookings_admin_financials
  on public.bookings(status, payment_status, payout_status, created_at desc)
  where archived_at is null
    and exclude_from_financials is false;

create index if not exists idx_listings_host_onboarding_lookup
  on public.listings(host_id, is_approved, setup_fee_paid, updated_at desc, created_at desc);

create index if not exists idx_onboarding_payments_admin_recent
  on public.onboarding_payments(status, created_at desc);

create index if not exists idx_verification_submissions_user_type_latest
  on public.verification_submissions(user_id, type, submitted_at desc);

notify pgrst, 'reload schema';
