-- 015_notifications.sql
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null
               check (type in ('SYSTEM','BOOKING_UPDATE','PAYMENT','VERIFICATION','MESSAGE')),
  title      text,
  message    text not null,
  data       jsonb,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT via Edge Function / trigger only
