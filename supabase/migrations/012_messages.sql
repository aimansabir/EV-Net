-- 012_messages.sql (improved sender modeling)
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid references public.profiles(id),   -- NULL for SYSTEM messages
  type             text not null default 'USER'
                     check (type in ('USER','SYSTEM')),
  content          text not null,
  is_read          boolean not null default false,
  created_at       timestamptz not null default now(),
  -- Enforce: USER messages must have a sender, SYSTEM messages must not
  constraint sender_required_for_user_messages
    check (type = 'SYSTEM' or sender_id is not null)
);

create index idx_messages_conversation
  on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;

-- Conversation participants can read messages
create policy "messages_select_participant"
  on messages for select
  using (
    exists(
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_id = auth.uid() or c.host_id = auth.uid())
    )
  );

-- Admin reads all
create policy "messages_select_admin"
  on messages for select
  using (public.is_admin());

-- INSERT via Edge Function only (enforces message limits)
