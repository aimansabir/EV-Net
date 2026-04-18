-- 003_ev_profiles.sql
create table public.ev_profiles (
  user_id                    uuid primary key references public.profiles(id) on delete cascade,
  phone                      text,
  ev_brand                   text,
  ev_model                   text,
  connector_preference       text,
  verification_status        text not null default 'draft'
                               check (verification_status in ('draft','pending_docs','under_review','approved','rejected')),
  email_verified             boolean not null default false,
  phone_verified             boolean not null default false,
  cnic_submitted             boolean not null default false,
  ev_proof_submitted         boolean not null default false,
  is_restricted_from_inquiry boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger ev_profiles_updated_at
  before update on public.ev_profiles
  for each row execute function public.update_updated_at();

alter table public.ev_profiles enable row level security;

create policy "ev_profiles_select_own"
  on ev_profiles for select
  using (user_id = auth.uid());

create policy "ev_profiles_select_admin"
  on ev_profiles for select
  using (public.is_admin());

create policy "ev_profiles_update_own"
  on ev_profiles for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and verification_status = (select verification_status from ev_profiles where user_id = auth.uid())
  );

create policy "ev_profiles_update_admin"
  on ev_profiles for update
  using (public.is_admin());
