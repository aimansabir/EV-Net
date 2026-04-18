-- 004_host_profiles.sql
create table public.host_profiles (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  phone                   text,
  verification_status     text not null default 'draft'
                            check (verification_status in ('draft','pending_docs','under_review','approved','rejected')),
  phone_verified          boolean not null default false,
  identity_verified       boolean not null default false,
  property_proof_uploaded boolean not null default false,
  charger_proof_uploaded  boolean not null default false,
  payout_setup_complete   boolean not null default false,
  onboarding_step         integer not null default 0,
  moderation_notes        text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger host_profiles_updated_at
  before update on public.host_profiles
  for each row execute function public.update_updated_at();

alter table public.host_profiles enable row level security;

create policy "host_profiles_select_own"
  on host_profiles for select
  using (user_id = auth.uid());

create policy "host_profiles_select_admin"
  on host_profiles for select
  using (public.is_admin());

create policy "host_profiles_update_own"
  on host_profiles for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and verification_status = (select verification_status from host_profiles where user_id = auth.uid())
  );

create policy "host_profiles_update_admin"
  on host_profiles for update
  using (public.is_admin());
