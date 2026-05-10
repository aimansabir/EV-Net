-- 089_fast_verification_document_rpc.sql
-- Record verification document uploads in one database round trip.

create index if not exists idx_verification_submissions_pending_document
  on public.verification_submissions(user_id, profile_type, document_type, status, submitted_at desc);

create or replace function public.record_verification_document(
  p_profile_type text,
  p_document_type text,
  p_storage_path text,
  p_update_profile_flags boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_type text := upper(coalesce(p_profile_type, 'EV_USER'));
  v_document_type text := upper(coalesce(p_document_type, ''));
  v_storage_path text := nullif(btrim(coalesce(p_storage_path, '')), '');
  v_submission_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized: Active session required.';
  end if;

  if v_profile_type = 'USER' then
    v_profile_type := 'EV_USER';
  end if;

  if v_profile_type not in ('EV_USER', 'HOST') then
    raise exception 'Unsupported profile type: %', p_profile_type;
  end if;

  if v_document_type not in ('CNIC_FRONT', 'CNIC_BACK', 'EV_PROOF', 'PROPERTY_PROOF', 'CHARGER_PROOF') then
    raise exception 'Unsupported document type: %', p_document_type;
  end if;

  if v_storage_path is null then
    raise exception 'Storage path is required.';
  end if;

  select id
    into v_submission_id
  from public.verification_submissions
  where user_id = v_user_id
    and profile_type = v_profile_type
    and document_type = v_document_type
    and status = 'pending'
  order by submitted_at desc
  limit 1;

  if v_submission_id is null then
    insert into public.verification_submissions (
      user_id,
      profile_type,
      type,
      document_type,
      storage_path,
      status,
      submitted_at,
      cnic_path,
      cnic_back_path,
      ev_proof_path,
      property_proof_path,
      charger_proof_path
    )
    values (
      v_user_id,
      v_profile_type,
      v_profile_type,
      v_document_type,
      v_storage_path,
      'pending',
      now(),
      case when v_document_type = 'CNIC_FRONT' then v_storage_path end,
      case when v_document_type = 'CNIC_BACK' then v_storage_path end,
      case when v_document_type = 'EV_PROOF' then v_storage_path end,
      case when v_document_type = 'PROPERTY_PROOF' then v_storage_path end,
      case when v_document_type = 'CHARGER_PROOF' then v_storage_path end
    )
    returning id into v_submission_id;
  else
    update public.verification_submissions
    set profile_type = v_profile_type,
        type = v_profile_type,
        document_type = v_document_type,
        storage_path = v_storage_path,
        status = 'pending',
        submitted_at = now(),
        cnic_path = case when v_document_type = 'CNIC_FRONT' then v_storage_path else cnic_path end,
        cnic_back_path = case when v_document_type = 'CNIC_BACK' then v_storage_path else cnic_back_path end,
        ev_proof_path = case when v_document_type = 'EV_PROOF' then v_storage_path else ev_proof_path end,
        property_proof_path = case when v_document_type = 'PROPERTY_PROOF' then v_storage_path else property_proof_path end,
        charger_proof_path = case when v_document_type = 'CHARGER_PROOF' then v_storage_path else charger_proof_path end
    where id = v_submission_id;
  end if;

  if p_update_profile_flags then
    if v_profile_type = 'HOST' then
      update public.host_profiles
      set identity_verified = case when v_document_type = 'CNIC_FRONT' then true else identity_verified end,
          cnic_back_submitted = case when v_document_type = 'CNIC_BACK' then true else cnic_back_submitted end,
          property_proof_uploaded = case when v_document_type = 'PROPERTY_PROOF' then true else property_proof_uploaded end,
          charger_proof_uploaded = case when v_document_type = 'CHARGER_PROOF' then true else charger_proof_uploaded end
      where user_id = v_user_id;
    else
      update public.ev_profiles
      set cnic_submitted = case when v_document_type = 'CNIC_FRONT' then true else cnic_submitted end,
          cnic_back_submitted = case when v_document_type = 'CNIC_BACK' then true else cnic_back_submitted end,
          ev_proof_submitted = case when v_document_type = 'EV_PROOF' then true else ev_proof_submitted end
      where user_id = v_user_id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'storage_path', v_storage_path,
    'profile_type', v_profile_type,
    'document_type', v_document_type
  );
end;
$$;

revoke execute on function public.record_verification_document(text, text, text, boolean) from public, anon;
grant execute on function public.record_verification_document(text, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
