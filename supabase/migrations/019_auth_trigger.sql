-- 019_auth_trigger.sql
-- Automatically creates profile + role-specific profile on user signup.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'USER');

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    user_role
  );

  -- If EV User, create ev_profiles row
  if user_role = 'USER' then
    insert into public.ev_profiles (user_id, phone)
    values (new.id, new.raw_user_meta_data->>'phone');
  end if;

  -- If Host, create host_profiles row
  if user_role = 'HOST' then
    insert into public.host_profiles (user_id, phone)
    values (new.id, new.raw_user_meta_data->>'phone');
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
