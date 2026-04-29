-- 022_auth_repair_rpc.sql

-- RPC to ensure a host profile exists (idempotent repair)
create or replace function public.ensure_host_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.host_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- RPC to ensure an EV profile exists (idempotent repair)
create or replace function public.ensure_ev_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ev_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;
