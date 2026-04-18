-- 009_bookings.sql
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id),
  listing_id          uuid not null references public.listings(id),
  date                date not null,
  start_time          time not null,
  end_time            time not null,
  status              text not null default 'PENDING'
                        check (status in ('PENDING','CONFIRMED','COMPLETED','CANCELLED')),
  base_fee            numeric not null,
  service_fee         numeric not null,
  total_fee           numeric not null,
  cancellation_reason text,
  cancelled_by        uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.update_updated_at();

alter table public.bookings enable row level security;

-- User reads own bookings
create policy "bookings_select_own"
  on bookings for select
  using (user_id = auth.uid());

-- Host reads bookings for their listings
create policy "bookings_select_host"
  on bookings for select
  using (
    exists(select 1 from listings where id = bookings.listing_id and host_id = auth.uid())
  );

-- Admin reads all
create policy "bookings_select_admin"
  on bookings for select
  using (public.is_admin());

-- INSERT and UPDATE restricted to Edge Functions (service_role key)
-- No direct insert/update policies for anon/authenticated
