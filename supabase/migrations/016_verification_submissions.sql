-- 016_verification_submissions.sql
create table public.verification_submissions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id),
  type                text not null check (type in ('EV_USER','HOST')),
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  cnic_path           text,
  ev_proof_path       text,
  property_proof_path text,
  charger_proof_path  text,
  reviewer_id         uuid references public.profiles(id),
  reviewer_notes      text,
  submitted_at        timestamptz not null default now(),
  reviewed_at         timestamptz
);

alter table public.verification_submissions enable row level security;

create policy "verification_select_own"
  on verification_submissions for select
  using (user_id = auth.uid());

create policy "verification_select_admin"
  on verification_submissions for select
  using (public.is_admin());

create policy "verification_insert_own"
  on verification_submissions for insert
  with check (user_id = auth.uid());

-- UPDATE (review) via Edge Function only (admin service_role)
