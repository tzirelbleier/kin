-- ================================================================
-- Kin — Migration 003: Fix recursive RLS on profiles table
--
-- The original profiles_select_facility policy queries the profiles
-- table itself to find the user's facility_id, which triggers the
-- same policy again → infinite recursion → "stack depth limit exceeded".
--
-- Fix: use a SECURITY DEFINER function that runs as the DB owner
-- (bypassing RLS), so the inner lookup doesn't recurse.
-- ================================================================

-- Drop the recursive policy
drop policy if exists "profiles_select_facility" on public.profiles;

-- Helper function: returns the calling user's facility_id
-- SECURITY DEFINER means it runs without RLS, breaking the recursion
create or replace function public.get_my_facility_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select facility_id from public.profiles where id = auth.uid()
$$;

-- Recreate the policy using the function
create policy "profiles_select_facility" on public.profiles
  for select
  using (facility_id = public.get_my_facility_id());
