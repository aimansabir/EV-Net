-- 018_helper_functions.sql

-- Get current user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql security definer stable;

-- Check if current user is a host
create or replace function public.is_host()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'HOST'
  );
$$ language sql security definer stable;

-- Check if caller has a CONFIRMED or COMPLETED booking for this listing
create or replace function public.has_booking_for_listing(p_listing_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.bookings
    where listing_id = p_listing_id
      and user_id = auth.uid()
      and status in ('CONFIRMED', 'COMPLETED')
  );
$$ language sql security definer stable;

-- Check if caller is the host who owns this listing
create or replace function public.owns_listing(p_listing_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.listings
    where id = p_listing_id and host_id = auth.uid()
  );
$$ language sql security definer stable;
