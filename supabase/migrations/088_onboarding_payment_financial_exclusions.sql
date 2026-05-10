-- 088_onboarding_payment_financial_exclusions.sql
-- Add the same "exclude test data from financials" workflow to host
-- registration payments that bookings already have.

alter table public.onboarding_payments
  add column if not exists exclude_from_financials boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id),
  add column if not exists archive_reason text;

create index if not exists idx_onboarding_payments_financials
  on public.onboarding_payments(status, exclude_from_financials, archived_at);

-- Best-effort cleanup for obvious seed/test hosts. Admins can still manually
-- exclude or restore rows from the dashboard after this migration.
update public.onboarding_payments op
set exclude_from_financials = true,
    archived_at = coalesce(op.archived_at, now()),
    archive_reason = coalesce(op.archive_reason, 'Test host registration cleanup')
from public.profiles p
where p.id = op.user_id
  and op.exclude_from_financials = false
  and (
    lower(p.email) ~ '(^|[._+\-])(test|testhost|demo|sample)'
    or lower(p.email) ~ '^(test|testhost|demo|sample)'
    or lower(p.name) in ('test', 'test host', 'testhost', 'host test', 'demo', 'demo host', 'sample host')
  );

create or replace function public.admin_archive_onboarding_payment(
  p_payment_id uuid,
  p_reason text default 'Test host registration cleanup'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  update public.onboarding_payments
  set archived_at = now(),
      archived_by = v_admin,
      archive_reason = p_reason,
      exclude_from_financials = true
  where id = p_payment_id;

  if not found then
    raise exception 'Onboarding payment not found.';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (
    v_admin,
    'ARCHIVE_ONBOARDING_PAYMENT',
    'ONBOARDING_PAYMENT',
    p_payment_id,
    jsonb_build_object('reason', p_reason, 'excluded_from_financials', true)
  );

  return jsonb_build_object('success', true, 'payment_id', p_payment_id);
end;
$$;

create or replace function public.admin_unarchive_onboarding_payment(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  update public.onboarding_payments
  set archived_at = null,
      archived_by = null,
      archive_reason = null,
      exclude_from_financials = false
  where id = p_payment_id;

  if not found then
    raise exception 'Onboarding payment not found.';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (
    v_admin,
    'UNARCHIVE_ONBOARDING_PAYMENT',
    'ONBOARDING_PAYMENT',
    p_payment_id,
    '{}'::jsonb
  );

  return jsonb_build_object('success', true, 'payment_id', p_payment_id);
end;
$$;

revoke execute on function public.admin_archive_onboarding_payment(uuid, text) from public, anon;
revoke execute on function public.admin_unarchive_onboarding_payment(uuid) from public, anon;
grant execute on function public.admin_archive_onboarding_payment(uuid, text) to authenticated;
grant execute on function public.admin_unarchive_onboarding_payment(uuid) to authenticated;

notify pgrst, 'reload schema';
