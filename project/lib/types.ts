export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingRule = {
  id: string;
  user_id: string;
  name: string;
  service_type: string;
  region: string;
  category: string;
  base_price: number;
  multiplier: number;
  markup_percent: number;
  min_price: number;
  max_price: number;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type Filter = {
  id: string;
  user_id: string;
  name: string;
  service_type: string | null;
  region: string | null;
  category: string | null;
  min_budget: number | null;
  max_budget: number | null;
  keywords: string[];
  excluded_keywords: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  user_id: string;
  name: string;
  template: string;
  service_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DiscordWebhook = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RequestStatus =
  | 'new'
  | 'filtered'
  | 'priced'
  | 'offer_sent'
  | 'accepted'
  | 'rejected'
  | 'expired';

export type MonitoredRequest = {
  id: string;
  user_id: string;
  external_id: string;
  service_type: string | null;
  region: string | null;
  category: string | null;
  description: string | null;
  budget: number | null;
  status: RequestStatus;
  calculated_price: number | null;
  offer_message: string | null;
  priority: number;
  filter_matched: string | null;
  pricing_rule_used: string | null;
  discord_notified: boolean;
  detected_at: string;
  offer_sent_at: string | null;
  created_at: string;
  updated_at: string;
  game_name: string | null;
  buyer_username: string | null;
  order_url: string | null;
};

export type EldoradoCredentials = {
  id: string;
  user_id: string;
  email: string;
  password_encrypted: string | null;
  two_factor_secret: string | null;
  last_login: string | null;
  login_status: 'pending' | 'success' | 'failed';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkerSession = {
  id: string;
  user_id: string;
  worker_type: 'browser' | 'api';
  status: 'stopped' | 'starting' | 'running' | 'error';
  last_heartbeat: string | null;
  error_message: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type LogCategory = 'monitor' | 'pricing' | 'automation' | 'discord' | 'system';

export type Log = {
  id: string;
  user_id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
};

export type Settings = {
  id: string;
  user_id: string;
  bot_running: boolean;
  monitor_interval_ms: number;
  auto_offer: boolean;
  auto_message: boolean;
  auto_discord: boolean;
  eldorado_api_key: string | null;
  eldorado_username: string | null;
  created_at: string;
  updated_at: string;
};

export type Stats = {
  id: string;
  user_id: string;
  total_requests: number;
  total_offers_sent: number;
  total_accepted: number;
  total_rejected: number;
  total_revenue: number;
  updated_at: string;
};

type Row<T> = T;
type Insert<T> = T extends Record<string, unknown>
  ? { [K in keyof T]?: T[K] | null }
  : Partial<T>;
type Update<T> = T extends Record<string, unknown>
  ? { [K in keyof T]?: T[K] | null }
  : Partial<T>;

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Row<Profile>; Insert: Insert<Profile>; Update: Update<Profile> };
      pricing_rules: { Row: Row<PricingRule>; Insert: Insert<PricingRule>; Update: Update<PricingRule> };
      filters: { Row: Row<Filter>; Insert: Insert<Filter>; Update: Update<Filter> };
      messages: { Row: Row<Message>; Insert: Insert<Message>; Update: Update<Message> };
      discord_webhooks: { Row: Row<DiscordWebhook>; Insert: Insert<DiscordWebhook>; Update: Update<DiscordWebhook> };
      requests: { Row: Row<MonitoredRequest>; Insert: Insert<MonitoredRequest>; Update: Update<MonitoredRequest> };
      logs: { Row: Row<Log>; Insert: Insert<Log>; Update: Update<Log> };
      settings: { Row: Row<Settings>; Insert: Insert<Settings>; Update: Update<Settings> };
      stats: { Row: Row<Stats>; Insert: Insert<Stats>; Update: Update<Stats> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
