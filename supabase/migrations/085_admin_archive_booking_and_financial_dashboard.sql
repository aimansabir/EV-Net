-- 085_admin_archive_booking_and_financial_dashboard.sql
-- Soft-archive system for bookings + admin financial tracking.
-- Archived bookings are hidden from dashboards/lists but preserved for audit.

-- ─── 1. Archive columns on bookings ───────────────────────
alter table public.bookings
  add column if not exists archived_at   timestamptz,
  add column if not exists archived_by   uuid references public.profiles(id),
  add column if not exists archive_reason text;

create index if not exists idx_bookings_archived
  on public.bookings(archived_at)
  where archived_at is null;

-- ─── 2. Admin archive RPC ─────────────────────────────────
create or replace function public.admin_archive_booking(
  p_booking_id uuid,
  p_reason text default 'Test data cleanup'
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

  update public.bookings
  set archived_at    = now(),
      archived_by    = v_admin,
      archive_reason = p_reason
  where id = p_booking_id
    and archived_at is null;

  if not found then
    raise exception 'Booking not found or already archived.';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (v_admin, 'ARCHIVE_BOOKING', 'BOOKING', p_booking_id,
          jsonb_build_object('reason', p_reason));

  return jsonb_build_object('success', true, 'booking_id', p_booking_id);
end;
$$;

grant execute on function public.admin_archive_booking(uuid, text) to authenticated;

-- ─── 3. Admin unarchive RPC (restore) ─────────────────────
create or replace function public.admin_unarchive_booking(
  p_booking_id uuid
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

  update public.bookings
  set archived_at    = null,
      archived_by    = null,
      archive_reason = null
  where id = p_booking_id
    and archived_at is not null;

  if not found then
    raise exception 'Booking not found or not archived.';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (v_admin, 'UNARCHIVE_BOOKING', 'BOOKING', p_booking_id, '{}'::jsonb);

  return jsonb_build_object('success', true, 'booking_id', p_booking_id);
end;
$$;

grant execute on function public.admin_unarchive_booking(uuid) to authenticated;
