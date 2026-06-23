/*
# Eldorado Bot - Database Schema

## Overview
Complete schema for the Eldorado.gg bot monitoring system. Includes authentication,
pricing rules, filters, automation messages, Discord webhooks, request monitoring,
logs, and system settings.

## New Tables

1. **profiles** - User profile data (extends auth.users)
   - `id` (uuid, PK, references auth.users)
   - `username` (text)
   - `avatar_url` (text)
   - `created_at`, `updated_at` (timestamps)

2. **pricing_rules** - Configurable pricing formulas
   - `id` (uuid, PK)
   - `user_id` (uuid, owner)
   - `name` (text) - rule name
   - `service_type` (text) - e.g. "boost", "coaching"
   - `region` (text) - e.g. "BR", "NA", "EU"
   - `category` (text) - e.g. "ranked", "normal"
   - `base_price` (numeric) - base price
   - `multiplier` (numeric) - price multiplier
   - `markup_percent` (numeric) - percentage markup
   - `min_price` (numeric) - minimum price floor
   - `max_price` (numeric) - maximum price ceiling
   - `is_active` (boolean)
   - `priority` (integer) - rule priority order
   - `created_at`, `updated_at`

3. **filters** - Monitoring filters
   - `id` (uuid, PK)
   - `user_id` (uuid, owner)
   - `name` (text)
   - `service_type` (text, nullable) - filter by service
   - `region` (text, nullable) - filter by region
   - `category` (text, nullable) - filter by category
   - `min_budget` (numeric, nullable) - minimum budget
   - `max_budget` (numeric, nullable) - maximum budget
   - `keywords` (text[], nullable) - keyword matching
   - `excluded_keywords` (text[], nullable) - keywords to exclude
   - `priority` (integer) - 1=high, 2=medium, 3=low
   - `is_active` (boolean)
   - `created_at`, `updated_at`

4. **messages** - Custom message templates
   - `id` (uuid, PK)
   - `user_id` (uuid, owner)
   - `name` (text)
   - `template` (text) - message body with placeholders
   - `service_type` (text, nullable) - applies to specific service
   - `is_active` (boolean)
   - `created_at`, `updated_at`

5. **discord_webhooks** - Discord webhook configurations
   - `id` (uuid, PK)
   - `user_id` (uuid, owner)
   - `name` (text)
   - `url` (text) - webhook URL
   - `events` (text[]) - which events to notify: new_request, offer_sent, offer_accepted, offer_rejected
   - `is_active` (boolean)
   - `created_at`, `updated_at`

6. **requests** - Monitored requests from Eldorado
   - `id` (uuid, PK)
   - `user_id` (uuid, owner)
   - `external_id` (text) - Eldorado request ID
   - `service_type` (text)
   - `region` (text)
   - `category` (text)
   - `description` (text)
   - `budget` (numeric, nullable)
   - `status` (text) - new, filtered, priced, offer_sent, accepted, rejected, expired
   - `calculated_price` (numeric, nullable)
   - `offer_message` (text, nullable)
   - `priority` (integer)
   - `filter_matched` (uuid, nullable, references filters)
   - `pricing_rule_used` (uuid, nullable, references pricing_rules)
   - `discord_notified` (boolean, default false)
   - `detected_at` (timestamptz)
   - `offer_sent_at` (timestamptz, nullable)
   - `created_at`, `updated_at`

7. **logs** - System activity logs
   - `id` (uuid, PK)
   - `user_id` (uuid, owner)
   - `level` (text) - info, warn, error, success
   - `category` (text) - monitor, pricing, automation, discord, system
   - `message` (text)
   - `details` (jsonb, nullable) - additional structured data
   - `request_id` (uuid, nullable, references requests)
   - `created_at`

8. **settings** - User system settings
   - `id` (uuid, PK)
   - `user_id` (uuid, unique, owner)
   - `bot_running` (boolean, default false) - is the bot active
   - `monitor_interval_ms` (integer, default 5000) - polling interval
   - `auto_offer` (boolean, default true) - automatically send offers
   - `auto_message` (boolean, default true) - automatically send messages
   - `auto_discord` (boolean, default true) - automatically notify Discord
   - `eldorado_api_key` (text, nullable) - Eldorado API key
   - `eldorado_username` (text, nullable)
   - `created_at`, `updated_at`

9. **stats** - Aggregated statistics (updated by triggers/functions)
   - `id` (uuid, PK)
   - `user_id` (uuid, unique, owner)
   - `total_requests` (integer, default 0)
   - `total_offers_sent` (integer, default 0)
   - `total_accepted` (integer, default 0)
   - `total_rejected` (integer, default 0)
   - `total_revenue` (numeric, default 0)
   - `updated_at`

## Security
- RLS enabled on ALL tables.
- Owner-scoped CRUD policies (4 per table: select, insert, update, delete).
- All owner columns default to `auth.uid()`.
- Only authenticated users can access data.

## Notes
1. All timestamps use `timestamptz` with `now()` default.
2. UUIDs generated with `gen_random_uuid()`.
3. Indexes on frequently queried columns (user_id, status, created_at).
4. `external_id` on requests has a unique constraint per user to prevent duplicates.
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

-- Function to auto-create profile, settings, and stats on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, username) VALUES (NEW.id, NEW.email);
  INSERT INTO settings (user_id) VALUES (NEW.id);
  INSERT INTO stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
