-- 001_extensions.sql
-- Enable pgcrypto for gen_random_uuid() (pre-enabled on Supabase, safe no-op)
create extension if not exists "pgcrypto";

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── Auth helper functions ─────────────────────────────────
-- Defined early (plpgsql defers table resolution) so migrations
-- 002-004 can reference them in RLS policies.
-- Migration 018 re-creates these with CREATE OR REPLACE — safe to have both.

create or replace function public.get_user_role()
returns text as $$
begin
  return (select role from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer stable;

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
end;
$$ language plpgsql security definer stable;

create or replace function public.is_host()
returns boolean as $$
begin
  return exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'HOST'
  );
end;
$$ language plpgsql security definer stable;

-- Defer table references for listings / bookings to allow 006-008 RLS to compile
create or replace function public.has_booking_for_listing(p_listing_id uuid)
returns boolean as $$
begin
  return exists(
    select 1 from public.bookings
    where listing_id = p_listing_id
      and user_id = auth.uid()
      and status in ('CONFIRMED', 'COMPLETED')
  );
end;
$$ language plpgsql security definer stable;

create or replace function public.owns_listing(p_listing_id uuid)
returns boolean as $$
begin
  return exists(
    select 1 from public.listings
    where id = p_listing_id and host_id = auth.uid()
  );
end;
$$ language plpgsql security definer stable;
