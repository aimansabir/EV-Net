-- 071_update_auth_trigger_for_ev_metadata.sql
-- Update handle_new_user() to capture EV-specific metadata (brand, model, connector) 
-- during signup, ensuring data is preserved even if email verification is required.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_role text;
  user_name text;
  user_avatar text;
  user_phone text;
  -- EV specific metadata
  v_ev_brand text;
  v_ev_model text;
  v_connector_pref text;
begin
  -- Role: from signup metadata, default USER
  user_role := coalesce(
    new.raw_user_meta_data->>'role',
    'USER'
  );

  -- Name: from signup form, or Google full_name, or email prefix
  user_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- Avatar: from Google OAuth
  user_avatar := new.raw_user_meta_data->>'avatar_url';

  -- Phone: from signup form
  user_phone := new.raw_user_meta_data->>'phone';

  -- EV Metadata
  v_ev_brand := new.raw_user_meta_data->>'ev_brand';
  v_ev_model := new.raw_user_meta_data->>'ev_model';
  v_connector_pref := new.raw_user_meta_data->>'connector_preference';

  -- Upsert profile
  insert into public.profiles (id, email, name, role, avatar_url)
  values (new.id, new.email, user_name, user_role, user_avatar)
  on conflict (id) do nothing;

  -- Create role-specific sub-profile
  if user_role = 'USER' then
    insert into public.ev_profiles (
      user_id, 
      phone, 
      ev_brand, 
      ev_model, 
      connector_preference
    )
    values (
      new.id, 
      user_phone, 
      v_ev_brand, 
      v_ev_model, 
      v_connector_pref
    )
    on conflict (user_id) do update 
    set 
      ev_brand = excluded.ev_brand,
      ev_model = excluded.ev_model,
      connector_preference = excluded.connector_preference
    where ev_profiles.ev_brand is null; -- Only update if not already set (safety)
  end if;

  if user_role = 'HOST' then
    insert into public.host_profiles (user_id, phone)
    values (new.id, user_phone)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
