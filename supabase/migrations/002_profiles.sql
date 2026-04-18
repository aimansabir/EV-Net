-- 002_profiles.sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  name          text not null,
  role          text not null default 'USER'
                  check (role in ('USER', 'HOST', 'ADMIN')),
  avatar_url    text,
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

alter table public.profiles enable row level security;

-- Anyone authenticated can read basic profile info (host cards, message headers)
create policy "profiles_select_public"
  on profiles for select
  using (true);

-- Users update own profile (cannot change own role)
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from profiles where id = auth.uid())
  );

-- Admins can update any profile (suspend, etc.)
create policy "profiles_update_admin"
  on profiles for update
  using (public.is_admin());
