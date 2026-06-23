/*
# Fix handle_new_user trigger function

## Problem
The `handle_new_user()` trigger function was created as SECURITY DEFINER without
a `search_path` configuration. Supabase requires SECURITY DEFINER functions to
have an explicit `search_path` to prevent security issues and execution errors.
This was causing "Database error saving new user" during signup.

## Fix
- Recreate `handle_new_user()` with `SET search_path = public` 
- Ensure the function properly inserts into profiles, settings, and stats
- The function bypasses RLS because it runs as SECURITY DEFINER (the owner),
  so the INSERT policies with `auth.uid()` checks don't block it
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, NEW.email);
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  INSERT INTO public.stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
