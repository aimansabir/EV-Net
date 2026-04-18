-- 013_reviews.sql
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id),
  listing_id  uuid not null references public.listings(id),
  booking_id  uuid references public.bookings(id),
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (author_id, booking_id)
);

alter table public.reviews enable row level security;

-- Anon + authenticated can read all reviews (for listing pages)
create policy "reviews_select_all"
  on reviews for select
  using (true);

-- Users can only review completed bookings they participated in
create policy "reviews_insert_booked_user"
  on reviews for insert
  with check (
    author_id = auth.uid()
    and exists(
      select 1 from bookings
      where id = reviews.booking_id
        and user_id = auth.uid()
        and status = 'COMPLETED'
    )
  );
