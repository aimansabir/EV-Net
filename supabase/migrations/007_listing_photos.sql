-- 007_listing_photos.sql
create table public.listing_photos (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  storage_path  text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.listing_photos enable row level security;

-- Anon can read photos for published listings
create policy "listing_photos_select_public"
  on listing_photos for select
  using (
    exists(
      select 1 from listings
      where id = listing_photos.listing_id
        and is_active = true
        and is_approved = true
    )
  );

-- Host/admin can read photos for own/all listings
create policy "listing_photos_select_owner"
  on listing_photos for select
  using (
    public.owns_listing(listing_id)
    or public.is_admin()
  );

-- Host inserts for own listings
create policy "listing_photos_insert_host"
  on listing_photos for insert
  with check (public.owns_listing(listing_id));

-- Host deletes own listing photos
create policy "listing_photos_delete_host"
  on listing_photos for delete
  using (public.owns_listing(listing_id));
