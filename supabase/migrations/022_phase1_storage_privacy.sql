-- 022_phase1_storage_privacy.sql
-- Phase 1: Storage buckets, policies, and robust publish rules

-- 1. Create Storage Buckets
insert into storage.buckets (id, name, public) 
values ('listing_photos', 'listing_photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('verification_documents', 'verification_documents', false)
on conflict (id) do nothing;

-- 2. Storage Policies for listing_photos (Public bucket)
create policy "Public photos readable by all"
on storage.objects for select
using ( bucket_id = 'listing_photos' );

create policy "Authenticated hosts can upload photos"
on storage.objects for insert
with check ( bucket_id = 'listing_photos' and auth.role() = 'authenticated' );

create policy "Hosts can delete own photos"
on storage.objects for delete
using ( bucket_id = 'listing_photos' and auth.uid() = owner );

-- 3. Storage Policies for verification_documents (Private bucket)
create policy "Owners can read own verification docs"
on storage.objects for select
using ( bucket_id = 'verification_documents' and auth.uid() = owner );

create policy "Admins can read all verification docs"
on storage.objects for select
using ( bucket_id = 'verification_documents' and public.is_admin() );

create policy "Authenticated users can upload verification docs"
on storage.objects for insert
with check ( bucket_id = 'verification_documents' and auth.role() = 'authenticated' );

-- 4. Backend-Enforced Publish Rules for Listings
-- Redefine the host update policy to block activation unless the host profile is 'approved'
drop policy if exists "listings_update_own" on public.listings;

create policy "listings_update_own"
  on public.listings for update
  using (host_id = auth.uid())
  with check (
    host_id = auth.uid()
    and is_approved = (select is_approved from listings where id = listings.id)
    and (
      (is_active = false) -- Always allowed to unpublish or edit drafts
      or 
      (is_active = true and exists (
        select 1 from public.host_profiles hp 
        where hp.user_id = auth.uid() and hp.verification_status = 'approved'
      ))
    )
  );
