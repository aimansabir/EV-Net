-- 020_seed_admin.sql
-- Creates an admin account in two steps:
--
-- STEP 1: Create the user in Supabase Dashboard
--   → Authentication → Users → Add User
--   → Email: admin@ev-net.pk   Password: (your choice)
--   → This triggers handle_new_user() which creates a profiles row with role='USER'
--
-- STEP 2: Run this SQL in the Supabase SQL Editor to promote to ADMIN.
--   Replace the email below if you used a different one.

update public.profiles
set role = 'ADMIN'
where email = 'admin@ev-net.pk';

-- Verify:
-- select id, email, name, role from public.profiles where role = 'ADMIN';
