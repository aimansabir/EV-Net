-- 023_performance_indexes_v2.sql
-- Optimizing common read paths for Favorites, Bookings, and Listings

-- 1. Favorites: Speed up "My Favorites" list and "Is this bookmarked?" check
create index if not exists idx_favorites_user_id 
  on public.favorites(user_id);

create index if not exists idx_favorites_user_listing 
  on public.favorites(user_id, listing_id);

-- 2. Bookings: Speed up User and Host dashboard views
create index if not exists idx_bookings_user_id 
  on public.bookings(user_id, created_at desc);

create index if not exists idx_bookings_listing_id 
  on public.bookings(listing_id);

-- 3. Listings: Speed up the main Explore map and search filters
create index if not exists idx_listings_active_approved 
  on public.listings(is_active, is_approved) 
  where is_active = true and is_approved = true;

create index if not exists idx_listings_city_area 
  on public.listings(city, area);

-- 4. Photos: Speed up listing detail and card image loading
create index if not exists idx_listing_photos_listing_id_order 
  on public.listing_photos(listing_id, display_order);
