-- 091_fix_host_onboarding_listing_insert_policy.sql
-- Host onboarding can be run by normal hosts and admin/self-test accounts.
-- The old insert policy only accepted public.is_host(), which blocks admins
-- from creating their own onboarding listing even after host initialization.

drop policy if exists "listings_insert_host" on public.listings;

create policy "listings_insert_host"
  on public.listings for insert
  with check (
    host_id = auth.uid()
    and (
      public.is_host()
      or public.is_admin()
    )
  );

notify pgrst, 'reload schema';
