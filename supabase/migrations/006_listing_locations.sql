-- 006_listing_locations.sql
-- SENSITIVE TABLE: Contains exact address, latitude, longitude.
-- RLS restricts access to: listing owner, booked users, admins.
create table public.listing_locations (
  listing_id  uuid primary key references public.listings(id) on delete cascade,
  address     text not null,
  lat         double precision not null,
  lng         double precision not null
);

alter table public.listing_locations enable row level security;

-- Host reads own listing locations
create policy "listing_locations_select_host"
  on listing_locations for select
  using (public.owns_listing(listing_id));

-- User reads only if they have a confirmed/completed booking
create policy "listing_locations_select_booked_user"
  on listing_locations for select
  using (public.has_booking_for_listing(listing_id));

-- Admin reads all
create policy "listing_locations_select_admin"
  on listing_locations for select
  using (public.is_admin());

-- Host inserts for own listings
create policy "listing_locations_insert_host"
  on listing_locations for insert
  with check (public.owns_listing(listing_id));

-- Host updates own
create policy "listing_locations_update_host"
  on listing_locations for update
  using (public.owns_listing(listing_id));
