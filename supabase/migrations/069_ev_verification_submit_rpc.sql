-- 069_ev_verification_submit_rpc.sql
-- Resubmission lifecycle fixes for EV users and hosts.
-- Current profile verification_status is the source of truth; submission rows
-- are reset to pending only to give admins a fresh review prompt.

create or replace function public.submit_ev_verification_for_review()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.ev_profiles
  set verification_status = 'under_review',
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    raise exception 'EV profile not found for user %', auth.uid();
  end if;

  update public.verification_submissions
  set status = 'pending',
      reviewer_id = null,
      reviewer_notes = null,
      reviewed_at = null,
      submitted_at = case when status <> 'pending' then now() else submitted_at end
  where user_id = auth.uid()
    and coalesce(type, profile_type) = 'EV_USER';
end;
$$;

grant execute on function public.submit_ev_verification_for_review() to authenticated;

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
  set verification_status = 'under_review',
      onboarding_step = 8,
      identity_verified = true,
      property_proof_uploaded = true,
      charger_proof_uploaded = true,
      moderation_notes = null,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Host profile not found';
  end if;

  update public.listings
  set is_active = false,
      is_approved = false,
      updated_at = now()
  where host_id = v_user_id;

  update public.verification_submissions
  set status = 'pending',
      reviewer_id = null,
      reviewer_notes = null,
      reviewed_at = null,
      submitted_at = case when status <> 'pending' then now() else submitted_at end
  where user_id = v_user_id
    and coalesce(type, profile_type) = 'HOST';

  return v_profile;
end;
$$;

grant execute on function public.finalize_host_onboarding() to authenticated;

create or replace function public.resubmit_host_onboarding()
returns public.host_profiles
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.finalize_host_onboarding();
$$;

grant execute on function public.resubmit_host_onboarding() to authenticated;

create or replace function public.admin_verify_user_v2(
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
    raise exception 'Moderation Error: Notes are strictly mandatory when rejecting an EV User profile.';
  end if;

  update public.ev_profiles
  set verification_status = v_status,
      updated_at = now()
  where user_id = v_uid;

  update public.verification_submissions
  set status = v_status,
      reviewer_id = auth.uid(),
      reviewer_notes = p_notes,
      reviewed_at = now()
  where user_id = v_uid
    and coalesce(type, profile_type) = 'EV_USER'
    and status = 'pending';

  insert into public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  values ('USER', v_uid, auth.uid(), v_action, p_notes);

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'VERIFY_USER', 'USER', v_uid, jsonb_build_object('approved', p_approved, 'notes', p_notes));
end;
$$;

grant execute on function public.admin_verify_user_v2(text, boolean, text) to authenticated;

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
