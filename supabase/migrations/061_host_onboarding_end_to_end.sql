-- 061_host_onboarding_end_to_end.sql
-- Internal beta host onboarding hardening:
-- - no listings.status usage
-- - self-service host promotion for onboarding
-- - no-arg finalize_host_onboarding RPC
-- - idempotent onboarding payment rows per listing
-- - admin host approval/rejection updates listing state the app reads

insert into storage.buckets (id, name, public)
values ('verification_documents', 'verification_documents', false)
on conflict (id) do nothing;

alter table public.host_profiles
  drop constraint if exists host_profiles_verification_status_check;

alter table public.host_profiles
  add constraint host_profiles_verification_status_check
  check (verification_status in ('draft','pending','pending_docs','under_review','approved','rejected'));

alter table public.onboarding_payments
  add column if not exists listing_id uuid references public.listings(id) on delete set null;

create index if not exists idx_onboarding_payments_user_listing
  on public.onboarding_payments(user_id, listing_id, created_at desc);

create unique index if not exists idx_onboarding_payments_one_open_per_listing
  on public.onboarding_payments(user_id, listing_id)
  where listing_id is not null and status in ('pending','verified');

drop policy if exists "onboarding_payments_update_own_pending" on public.onboarding_payments;
create policy "onboarding_payments_update_own_pending"
  on public.onboarding_payments for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "verification_update_own_pending" on public.verification_submissions;
create policy "verification_update_own_pending"
  on public.verification_submissions for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

-- Remove the broad notification insert policy from migration 058.
-- Keep admin inserts and allow users to create notifications only for themselves.
drop policy if exists "notifications_insert_authenticated" on public.notifications;

drop policy if exists "notifications_insert_self" on public.notifications;
create policy "notifications_insert_self"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

with ranked_notifications as (
  select
    ctid,
    row_number() over (
      partition by user_id, type, message
      order by created_at asc, id asc
    ) as rn
  from public.notifications
)
delete from public.notifications n
using ranked_notifications r
where n.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_notifications_dedupe_user_type_message
  on public.notifications(user_id, type, message);

create or replace function public.promote_to_host(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if v_actor <> target_user_id and not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  select role into v_role
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_role = 'ADMIN' and not public.is_admin() then
    raise exception 'Cannot promote an ADMIN to HOST';
  end if;

  if v_role <> 'ADMIN' then
    update public.profiles
    set role = 'HOST'
    where id = target_user_id;
  end if;

  insert into public.host_profiles (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.promote_to_host(uuid) to authenticated;

create or replace function public.finalize_host_onboarding()
returns public.host_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.host_profiles;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.promote_to_host(v_user_id);

  update public.host_profiles
  set verification_status = 'pending',
      onboarding_step = 8,
      property_proof_uploaded = true,
      charger_proof_uploaded = true,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Host profile not found';
  end if;

  return v_profile;
end;
$$;

grant execute on function public.finalize_host_onboarding() to authenticated;

create or replace function public.admin_verify_host_v2(
  p_user_id text,
  p_approved boolean,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := case when p_approved then 'approved' else 'rejected' end;
  v_action text := case when p_approved then 'APPROVE' else 'REJECT' end;
  v_uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  v_uid := p_user_id::uuid;

  if not p_approved and (p_notes is null or trim(p_notes) = '') then
    raise exception 'Moderation Error: Notes are strictly mandatory when rejecting a host profile.';
  end if;

  update public.host_profiles
  set verification_status = v_status,
      onboarding_step = 8,
      payout_setup_complete = p_approved,
      moderation_notes = p_notes,
      updated_at = now()
  where user_id = v_uid;

  if p_approved then
    update public.listings
    set is_active = true,
        is_approved = true,
        setup_fee_paid = true,
        updated_at = now()
    where host_id = v_uid;
  else
    update public.listings
    set is_active = false,
        is_approved = false,
        updated_at = now()
    where host_id = v_uid;
  end if;

  update public.verification_submissions
  set status = v_status,
      reviewer_id = auth.uid(),
      reviewer_notes = p_notes,
      reviewed_at = now()
  where user_id = v_uid
    and coalesce(type, profile_type) = 'HOST'
    and status = 'pending';

  insert into public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  values ('USER', v_uid, auth.uid(), v_action, p_notes);

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'VERIFY_HOST', 'USER', v_uid, jsonb_build_object('approved', p_approved, 'notes', p_notes));
end;
$$;

grant execute on function public.admin_verify_host_v2(text, boolean, text) to authenticated;
