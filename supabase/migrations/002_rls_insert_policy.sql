-- ================================================================
-- Kin — Migration 002: Allow service role to insert profiles
-- Run in Supabase SQL Editor after migration 001.
-- ================================================================

-- Allow the service role (seed route, webhooks) to insert profile rows.
-- RLS still blocks anon/authenticated users from inserting profiles for others.
create policy "profiles_insert_service"
  on public.profiles
  for insert
  with check (true);
