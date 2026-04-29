-- 025_onboarding_payments.sql
create table public.onboarding_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount numeric not null,
  method text not null check (method in ('CARD', 'BANK_TRANSFER')),
  screenshot_path text, -- for bank transfer
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  admin_notes text,
  created_at timestamptz default now(),
  verified_at timestamptz
);

alter table public.onboarding_payments enable row level security;

create policy "onboarding_payments_select_own"
  on onboarding_payments for select
  using (user_id = auth.uid());

create policy "onboarding_payments_select_admin"
  on onboarding_payments for select
  using (public.is_admin());

create policy "onboarding_payments_insert_own"
  on onboarding_payments for insert
  with check (user_id = auth.uid());

-- Admin can update status
create policy "onboarding_payments_update_admin"
  on onboarding_payments for update
  using (public.is_admin());
