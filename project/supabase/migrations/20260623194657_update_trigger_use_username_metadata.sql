/*
# Update handle_new_user to use username from metadata

## Changes
- The trigger now reads `raw_user_meta_data->>'username'` if available
- Falls back to email if no username is provided in metadata
- This way the profile is created with the correct username from signup
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email)
  );
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  INSERT INTO public.stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
