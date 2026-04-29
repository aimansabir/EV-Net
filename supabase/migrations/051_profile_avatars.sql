-- =========================================================
-- EV-Net avatar storage
-- - Adds avatar_path to ev_profiles and host_profiles
-- - Creates profile_avatars bucket
-- - Uses per-user folder rule:
--     profile_avatars/<auth.uid()>/<filename>
-- =========================================================

-- 1) Profile columns
alter table public.ev_profiles
  add column if not exists avatar_path text;

alter table public.host_profiles
  add column if not exists avatar_path text;

-- 2) Ensure bucket exists
insert into storage.buckets (id, name, public)
select 'profile_avatars', 'profile_avatars', true
where not exists (
  select 1
  from storage.buckets
  where id = 'profile_avatars'
);

-- 3) Storage policies
drop policy if exists "Public avatars readable by all" on storage.objects;
create policy "Public avatars readable by all"
on storage.objects
for select
to public
using (bucket_id = 'profile_avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile_avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);