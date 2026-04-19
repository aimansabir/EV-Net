-- 024_admin_workflows.sql
-- Phase 4: Admin workflows, Mandatory Moderation Notes, and Audit Logging

-- 1. Admin Listing Review RPC
create or replace function public.admin_review_listing(
  p_listing_id uuid,
  p_approved boolean,
  p_notes text
)
returns void
language plpgsql
security definer
as $$
declare
  v_action text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if not p_approved and (p_notes is null or trim(p_notes) = '') then
    raise exception 'Moderation Error: Notes are strictly mandatory when rejecting or requesting resubmission for a listing.';
  end if;

  v_action := case when p_approved then 'APPROVE' else 'REJECT' end;

  -- Update listing status
  update public.listings 
  set is_approved = p_approved,
      is_active = case when p_approved then true else false end
  where id = p_listing_id;

  -- Log explicit moderation review
  insert into public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  values ('LISTING', p_listing_id, auth.uid(), v_action, p_notes);

  -- Log immutable audit event
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'REVIEW_LISTING', 'LISTING', p_listing_id, jsonb_build_object('approved', p_approved, 'notes', p_notes));
end;
$$;

-- 2. Admin Verify Host RPC
create or replace function public.admin_verify_host(
  p_user_id uuid,
  p_approved boolean,
  p_notes text
)
returns void
language plpgsql
security definer
as $$
declare
  v_action text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if not p_approved and (p_notes is null or trim(p_notes) = '') then
    raise exception 'Moderation Error: Notes are strictly mandatory when rejecting a host profile.';
  end if;

  v_action := case when p_approved then 'APPROVE' else 'REJECT' end;

  update public.host_profiles
  set verification_status = case when p_approved then 'approved' else 'rejected' end
  where user_id = p_user_id;

  -- Log explicit moderation review
  insert into public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  values ('USER', p_user_id, auth.uid(), v_action, p_notes);

  -- Log immutable audit event
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'VERIFY_HOST', 'USER', p_user_id, jsonb_build_object('approved', p_approved, 'notes', p_notes));
end;
$$;

-- 3. Admin Verify User RPC (EV Profile)
create or replace function public.admin_verify_user(
  p_user_id uuid,
  p_approved boolean,
  p_notes text
)
returns void
language plpgsql
security definer
as $$
declare
  v_action text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required.';
  end if;

  if not p_approved and (p_notes is null or trim(p_notes) = '') then
    raise exception 'Moderation Error: Notes are strictly mandatory when rejecting an EV User profile.';
  end if;

  v_action := case when p_approved then 'APPROVE' else 'REJECT' end;

  update public.ev_profiles
  set verification_status = case when p_approved then 'approved' else 'rejected' end
  where user_id = p_user_id;

  insert into public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  values ('USER', p_user_id, auth.uid(), v_action, p_notes);

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'VERIFY_USER', 'USER', p_user_id, jsonb_build_object('approved', p_approved, 'notes', p_notes));
end;
$$;
