-- 014_favorites.sql
create table public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.favorites enable row level security;

create policy "favorites_all_own"
  on favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
