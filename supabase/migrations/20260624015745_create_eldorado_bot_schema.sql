/*
# Eldorado Bot - Database Schema

## Overview
Complete schema for the Eldorado.gg bot monitoring system. Includes authentication,
pricing rules, filters, automation messages, Discord webhooks, request monitoring,
logs, and system settings.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Pricing rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_type text DEFAULT 'all',
  region text DEFAULT 'all',
  category text DEFAULT 'all',
  base_price numeric DEFAULT 0,
  multiplier numeric DEFAULT 1.0,
  markup_percent numeric DEFAULT 0,
  min_price numeric DEFAULT 0,
  max_price numeric DEFAULT 999999,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pricing_rules" ON pricing_rules;
CREATE POLICY "select_own_pricing_rules" ON pricing_rules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pricing_rules" ON pricing_rules;
CREATE POLICY "insert_own_pricing_rules" ON pricing_rules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pricing_rules" ON pricing_rules;
CREATE POLICY "update_own_pricing_rules" ON pricing_rules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pricing_rules" ON pricing_rules;
CREATE POLICY "delete_own_pricing_rules" ON pricing_rules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Filters table
CREATE TABLE IF NOT EXISTS filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_type text,
  region text,
  category text,
  min_budget numeric,
  max_budget numeric,
  keywords text[] DEFAULT '{}',
  excluded_keywords text[] DEFAULT '{}',
  priority integer DEFAULT 2,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_filters" ON filters;
CREATE POLICY "select_own_filters" ON filters FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_filters" ON filters;
CREATE POLICY "insert_own_filters" ON filters FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_filters" ON filters;
CREATE POLICY "update_own_filters" ON filters FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_filters" ON filters;
CREATE POLICY "delete_own_filters" ON filters FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  template text NOT NULL,
  service_type text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Discord webhooks table
CREATE TABLE IF NOT EXISTS discord_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] DEFAULT '{new_request,offer_sent,offer_accepted,offer_rejected}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE discord_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_discord_webhooks" ON discord_webhooks;
CREATE POLICY "select_own_discord_webhooks" ON discord_webhooks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_discord_webhooks" ON discord_webhooks;
CREATE POLICY "insert_own_discord_webhooks" ON discord_webhooks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_discord_webhooks" ON discord_webhooks;
CREATE POLICY "update_own_discord_webhooks" ON discord_webhooks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_discord_webhooks" ON discord_webhooks;
CREATE POLICY "delete_own_discord_webhooks" ON discord_webhooks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  service_type text,
  region text,
  category text,
  description text,
  budget numeric,
  status text DEFAULT 'new',
  calculated_price numeric,
  offer_message text,
  priority integer DEFAULT 2,
  filter_matched uuid REFERENCES filters(id) ON DELETE SET NULL,
  pricing_rule_used uuid REFERENCES pricing_rules(id) ON DELETE SET NULL,
  discord_notified boolean DEFAULT false,
  detected_at timestamptz DEFAULT now(),
  offer_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  game_name text,
  buyer_username text,
  order_url text,
  UNIQUE(user_id, external_id)
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_requests" ON requests;
CREATE POLICY "select_own_requests" ON requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_requests" ON requests;
CREATE POLICY "insert_own_requests" ON requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_requests" ON requests;
CREATE POLICY "update_own_requests" ON requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_requests" ON requests;
CREATE POLICY "delete_own_requests" ON requests FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  message text NOT NULL,
  details jsonb,
  request_id uuid REFERENCES requests(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_logs" ON logs;
CREATE POLICY "select_own_logs" ON logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_logs" ON logs;
CREATE POLICY "insert_own_logs" ON logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_logs" ON logs;
CREATE POLICY "update_own_logs" ON logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_logs" ON logs;
CREATE POLICY "delete_own_logs" ON logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_running boolean DEFAULT false,
  monitor_interval_ms integer DEFAULT 5000,
  auto_offer boolean DEFAULT true,
  auto_message boolean DEFAULT true,
  auto_discord boolean DEFAULT true,
  eldorado_api_key text,
  eldorado_username text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON settings;
CREATE POLICY "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Stats table
CREATE TABLE IF NOT EXISTS stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_requests integer DEFAULT 0,
  total_offers_sent integer DEFAULT 0,
  total_accepted integer DEFAULT 0,
  total_rejected integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stats" ON stats;
CREATE POLICY "select_own_stats" ON stats FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_stats" ON stats;
CREATE POLICY "insert_own_stats" ON stats FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_stats" ON stats;
CREATE POLICY "update_own_stats" ON stats FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_stats" ON stats;
CREATE POLICY "delete_own_stats" ON stats FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Eldorado credentials table
CREATE TABLE IF NOT EXISTS eldorado_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_encrypted text,
  two_factor_secret text,
  last_login timestamptz,
  login_status text DEFAULT 'pending',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE eldorado_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credentials" ON eldorado_credentials;
CREATE POLICY "select_own_credentials" ON eldorado_credentials FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_credentials" ON eldorado_credentials;
CREATE POLICY "insert_own_credentials" ON eldorado_credentials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_credentials" ON eldorado_credentials;
CREATE POLICY "update_own_credentials" ON eldorado_credentials FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_credentials" ON eldorado_credentials;
CREATE POLICY "delete_own_credentials" ON eldorado_credentials FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Worker sessions table
CREATE TABLE IF NOT EXISTS worker_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_type text DEFAULT 'browser',
  status text DEFAULT 'stopped',
  last_heartbeat timestamptz,
  error_message text,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE worker_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON worker_sessions;
CREATE POLICY "select_own_sessions" ON worker_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON worker_sessions;
CREATE POLICY "insert_own_sessions" ON worker_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON worker_sessions;
CREATE POLICY "update_own_sessions" ON worker_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON worker_sessions;
CREATE POLICY "delete_own_sessions" ON worker_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pricing_rules_user_id ON pricing_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_filters_user_id ON filters(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_webhooks_user_id ON discord_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_user_id ON stats(user_id);
CREATE INDEX IF NOT EXISTS idx_eldorado_credentials_user_id ON eldorado_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_user_id ON worker_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_status ON worker_sessions(status);

-- Function to auto-create profile, settings, and stats on user signup
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

-- Function to increment stats
CREATE OR REPLACE FUNCTION increment_stat(
  user_id_input uuid,
  field text,
  amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF field = 'total_requests' THEN
    UPDATE stats SET total_requests = total_requests + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_offers_sent' THEN
    UPDATE stats SET total_offers_sent = total_offers_sent + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_accepted' THEN
    UPDATE stats SET total_accepted = total_accepted + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_rejected' THEN
    UPDATE stats SET total_rejected = total_rejected + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_revenue' THEN
    UPDATE stats SET total_revenue = total_revenue + amount, updated_at = now() WHERE user_id = user_id_input;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION increment_revenue(
  user_id_input uuid,
  amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stats SET total_revenue = total_revenue + amount, updated_at = now() WHERE user_id = user_id_input;
END;
$$;
