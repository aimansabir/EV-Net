-- 077_fix_host_approval_activation.sql
-- Keep host approval as the single backend source of truth for activating listings.

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
      moderation_notes = case
        when p_approved then nullif(trim(coalesce(p_notes, '')), '')
        else p_notes
      end,
      updated_at = now()
  where user_id = v_uid;

  if not found then
    raise exception 'Host profile not found for user %', v_uid;
  end if;

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
    and upper(coalesce(type, profile_type, '')) = 'HOST'
    and lower(coalesce(status, '')) in ('pending', 'under_review');

  insert into public.moderation_reviews (target_type, target_id, admin_id, action, notes)
  values ('USER', v_uid, auth.uid(), v_action, p_notes);

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'VERIFY_HOST', 'USER', v_uid, jsonb_build_object('approved', p_approved, 'notes', p_notes));
end;
$$;

grant execute on function public.admin_verify_host_v2(text, boolean, text) to authenticated;
