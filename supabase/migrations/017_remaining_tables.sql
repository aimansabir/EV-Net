-- 017_remaining_tables.sql

-- Moderation reviews (admin-only)
create table public.moderation_reviews (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null
                 check (target_type in ('MESSAGE','CONVERSATION','LISTING','USER','BOOKING')),
  target_id    uuid not null,
  admin_id     uuid not null references public.profiles(id),
  action       text not null,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.moderation_reviews enable row level security;

create policy "moderation_reviews_admin"
  on moderation_reviews for all
  using (public.is_admin());

-- Disputes
create table public.disputes (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id),
  filed_by     uuid not null references public.profiles(id),
  reason       text not null,
  status       text not null default 'PENDING'
                 check (status in ('PENDING','UNDER_REVIEW','RESOLVED','DISMISSED')),
  admin_id     uuid references public.profiles(id),
  admin_notes  text,
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table public.disputes enable row level security;

create policy "disputes_select_participant"
  on disputes for select
  using (
    filed_by = auth.uid()
    or exists(
      select 1 from bookings b
      join listings l on l.id = b.listing_id
      where b.id = disputes.booking_id and l.host_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "disputes_insert_own"
  on disputes for insert
  with check (filed_by = auth.uid());

-- Payout accounts
create table public.payout_accounts (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid not null references public.profiles(id),
  bank_name      text not null,
  account_title  text not null,
  account_number text not null,
  iban           text,
  is_primary     boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;

create policy "payout_accounts_own"
  on payout_accounts for all
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "payout_accounts_admin"
  on payout_accounts for select
  using (public.is_admin());

-- Audit logs (immutable, admin-readable)
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_actor
  on public.audit_logs(actor_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin"
  on audit_logs for select
  using (public.is_admin());

-- audit_logs INSERT via Edge Function only (service_role)
