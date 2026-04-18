-- 008_availability_rules.sql
create table public.availability_rules (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  constraint valid_time_range check (start_time < end_time)
);

alter table public.availability_rules enable row level security;

-- Anon can read availability for published listings
create policy "availability_rules_select_public"
  on availability_rules for select
  using (
    exists(
      select 1 from listings
      where id = availability_rules.listing_id
        and is_active = true
        and is_approved = true
    )
  );

-- Host/admin can read availability for own/all listings
create policy "availability_rules_select_owner"
  on availability_rules for select
  using (
    public.owns_listing(listing_id)
    or public.is_admin()
  );

create policy "availability_rules_insert_host"
  on availability_rules for insert
  with check (public.owns_listing(listing_id));

create policy "availability_rules_update_host"
  on availability_rules for update
  using (public.owns_listing(listing_id));

create policy "availability_rules_delete_host"
  on availability_rules for delete
  using (public.owns_listing(listing_id));
