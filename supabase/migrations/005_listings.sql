-- 005_listings.sql
-- No sensitive location data in this table. Safe for public reads.
create table public.listings (
  id                  uuid primary key default gen_random_uuid(),
  host_id             uuid not null references public.profiles(id),
  title               text not null,
  description         text,
  city                text not null,
  area                text not null,
  charger_type        text,
  charger_speed       text,
  price_per_hour      numeric not null check (price_per_hour > 0),
  amenities           text[] not null default '{}',
  house_rules         text[] not null default '{}',
  is_active           boolean not null default false,
  is_approved         boolean not null default false,
  setup_fee_paid      boolean not null default false,
  rating              numeric not null default 0,
  review_count        integer not null default 0,
  sessions_completed  integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.update_updated_at();

alter table public.listings enable row level security;

-- Anon + authenticated can browse published listings
create policy "listings_select_published"
  on listings for select
  using (is_active = true and is_approved = true);

-- Host reads own listings (any status, including drafts)
create policy "listings_select_own"
  on listings for select
  using (host_id = auth.uid());

-- Admin reads all
create policy "listings_select_admin"
  on listings for select
  using (public.is_admin());

-- Host inserts own
create policy "listings_insert_host"
  on listings for insert
  with check (host_id = auth.uid() and public.is_host());

-- Host updates own (cannot change is_approved)
create policy "listings_update_own"
  on listings for update
  using (host_id = auth.uid())
  with check (
    host_id = auth.uid()
    and is_approved = (select is_approved from listings where id = listings.id)
  );

-- Admin updates any (for approval)
create policy "listings_update_admin"
  on listings for update
  using (public.is_admin());

-- Host deletes own drafts only
create policy "listings_delete_draft"
  on listings for delete
  using (host_id = auth.uid() and is_approved = false);
