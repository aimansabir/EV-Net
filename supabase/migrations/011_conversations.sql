-- 011_conversations.sql (CORRECTED with partial unique indexes)
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  listing_id           uuid not null references public.listings(id),
  user_id              uuid not null references public.profiles(id),
  host_id              uuid not null references public.profiles(id),
  booking_id           uuid references public.bookings(id),
  type                 text not null default 'INQUIRY'
                         check (type in ('INQUIRY','BOOKING')),
  status               text not null default 'OPEN'
                         check (status in ('OPEN','CLOSED','FLAGGED','LOCKED','ARCHIVED')),
  message_count        integer not null default 0,
  extension_requested  boolean not null default false,
  extension_approved   boolean not null default false,
  extension_limit      integer not null default 3,
  extension_count      integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One inquiry per user per listing (prevents duplicate inquiries)
create unique index idx_conversations_inquiry_unique
  on conversations (listing_id, user_id)
  where type = 'INQUIRY';

-- One conversation per booking (each booking gets its own thread)
create unique index idx_conversations_booking_unique
  on conversations (booking_id)
  where type = 'BOOKING' and booking_id is not null;

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.update_updated_at();

alter table public.conversations enable row level security;

-- Participants can read their conversations
create policy "conversations_select_participant"
  on conversations for select
  using (user_id = auth.uid() or host_id = auth.uid());

-- Admin reads all
create policy "conversations_select_admin"
  on conversations for select
  using (public.is_admin());

-- INSERT and UPDATE via Edge Functions only
