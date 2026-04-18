-- 010_booking_status_history.sql
create table public.booking_status_history (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  old_status  text,
  new_status  text not null,
  changed_by  uuid not null references public.profiles(id),
  reason      text,
  created_at  timestamptz not null default now()
);

alter table public.booking_status_history enable row level security;

-- Booking participants can read history
create policy "booking_history_select_participant"
  on booking_status_history for select
  using (
    exists(
      select 1 from bookings b
      where b.id = booking_status_history.booking_id
        and (
          b.user_id = auth.uid()
          or exists(select 1 from listings l where l.id = b.listing_id and l.host_id = auth.uid())
        )
    )
    or public.is_admin()
  );

-- INSERT via Edge Function only (service_role)
