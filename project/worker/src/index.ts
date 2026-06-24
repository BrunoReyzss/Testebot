import { createClient } from '@supabase/supabase-js';
import { EldoradoScraper, BoostingOrder, EldoradoConfig } from './eldorado-scraper';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

interface UserConfig {
  userId: string;
  email: string;
  password: string;
  autoRespond: boolean;
  responseMessage: string | null;
  filters: FilterConfig[];
  pricingRules: PricingConfig[];
  discordWebhooks: DiscordWebhook[];
}

interface FilterConfig {
  id: string;
  name: string;
  serviceType: string | null;
  region: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  keywords: string[];
  excludedKeywords: string[];
  priority: number;
}

interface PricingConfig {
  id: string;
  name: string;
  serviceType: string;
  region: string;
  basePrice: number;
  multiplier: number;
  markupPercent: number;
  minPrice: number;
  maxPrice: number;
}

interface DiscordWebhook {
  id: string;
  url: string;
  events: string[];
}

class EldoradoWorker {
  private scrapers: Map<string, EldoradoScraper> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private statePath: string;

  constructor() {
    this.statePath = path.resolve(__dirname, '../state');
  }

  async start(): Promise<void> {
    console.log('[Worker] Starting Eldorado.gg monitoring worker...');
    console.log('[Worker] State path:', this.statePath);

    // Load all active user configurations
    await this.loadUserConfigs();

    // Set up periodic config reload
    setInterval(() => this.loadUserConfigs(), 60000); // Every minute

    console.log('[Worker] Worker started successfully');
  }

  private async loadUserConfigs(): Promise<void> {
    try {
      // Get all users with bot running = true and Eldorado credentials
      const { data: settings, error } = await supabase
        .from('settings')
        .select(`
          user_id,
          bot_running,
          auto_offer,
          auto_message,
          auto_discord,
          eldorado_username,
          eldorado_api_key
        `)
        .eq('bot_running', true)
        .not('eldorado_api_key', 'is', null);

      if (error) {
        console.error('[Worker] Error loading settings:', error);
        return;
      }

      if (!settings || settings.length === 0) {
        console.log('[Worker] No active users with Eldorado credentials');
        return;
      }

      // For each active user, load their full config
      for (const setting of settings) {
        await this.configureUser(setting.user_id, {
          email: setting.eldorado_username || '',
          password: setting.eldorado_api_key || '', // API key stored in api_key field for now
          autoRespond: setting.auto_offer,
        });
      }

      console.log(`[Worker] Loaded configs for ${settings.length} active users`);
    } catch (error) {
      console.error('[Worker] Error in loadUserConfigs:', error);
    }
  }

  private async configureUser(userId: string, config: {
    email: string;
    password: string;
    autoRespond: boolean;
  }): Promise<void> {
    const existingInterval = this.intervals.get(userId);

    // Stop existing interval if credentials changed
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Stop existing scraper
    const existingScraper = this.scrapers.get(userId);
    if (existingScraper) {
      await existingScraper.close();
    }

    // Load user filters
    const { data: filters } = await supabase
      .from('filters')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Load user pricing rules
    const { data: pricingRules } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Load Discord webhooks
    const { data: webhooks } = await supabase
      .from('discord_webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Load default message
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);

    const userConfig: UserConfig = {
      userId,
      email: config.email,
      password: config.password,
      autoRespond: config.autoRespond,
      responseMessage: messages?.[0]?.template || null,
      filters: (filters || []).map(f => ({
        id: f.id,
        name: f.name,
        serviceType: f.service_type,
        region: f.region,
        minBudget: f.min_budget,
        maxBudget: f.max_budget,
        keywords: f.keywords || [],
        excludedKeywords: f.excluded_keywords || [],
        priority: f.priority,
      })),
      pricingRules: (pricingRules || []).map(p => ({
        id: p.id,
        name: p.name,
        serviceType: p.service_type,
        region: p.region,
        basePrice: p.base_price,
        multiplier: p.multiplier,
        markupPercent: p.markup_percent,
        minPrice: p.min_price,
        maxPrice: p.max_price,
      })),
      discordWebhooks: (webhooks || []).map(w => ({
        id: w.id,
        url: w.url,
        events: w.events || [],
      })),
    };

    // Create scraper instance
    const scraper = new EldoradoScraper({
      email: userConfig.email,
      password: userConfig.password,
      headless: true,
      statePath: `${this.statePath}/${userId}`,
    });

    try {
      await scraper.init();
      const loginSuccess = await scraper.login();

      if (!loginSuccess) {
        await this.logEvent(userId, 'error', 'monitor', 'Failed to login to Eldorado.gg');
        await scraper.close();
        return;
      }

      this.scrapers.set(userId, scraper);

      await this.logEvent(userId, 'success', 'system', 'Worker connected to Eldorado.gg');

      // Start monitoring interval
      const interval = setInterval(
        () => this.monitorOrders(userId, userConfig),
        30000 // Check every 30 seconds
      );

      this.intervals.set(userId, interval);

      // Initial check
      await this.monitorOrders(userId, userConfig);

    } catch (error) {
      console.error(`[Worker] Error starting scraper for user ${userId}:`, error);
      await scraper.close();
    }
  }

  private async monitorOrders(userId: string, config: UserConfig): Promise<void> {
    const scraper = this.scrapers.get(userId);
    if (!scraper) return;

    try {
      console.log(`[Worker] Checking orders for user ${userId}...`);

      const orders = await scraper.getPendingOrders();

      for (const order of orders) {
        // Check if already processed
        const { data: existing } = await supabase
          .from('requests')
          .select('id')
          .eq('user_id', userId)
          .eq('external_id', order.externalId)
          .maybeSingle();

        if (existing) continue;

        // Apply filters
        const matchedFilter = this.matchFilters(order, config.filters);

        if (!matchedFilter) {
          console.log(`[Worker] Order ${order.externalId} did not match any filter`);
          continue;
        }

        // Calculate price
        const pricing = this.matchPricing(order, config.pricingRules);
        const calculatedPrice = pricing
          ? pricing.basePrice * pricing.multiplier * (1 + pricing.markupPercent / 100)
          : null;

        const finalPrice = pricing
          ? Math.max(pricing.minPrice, Math.min(pricing.maxPrice, calculatedPrice || 0))
          : null;

        // Insert request
        const { data: inserted, error: insertError } = await supabase
          .from('requests')
          .insert({
            user_id: userId,
            external_id: order.externalId,
            service_type: order.serviceType,
            region: order.region,
            category: order.category,
            description: order.description,
            budget: order.budget,
            status: config.autoRespond ? 'offer_sent' : 'filtered',
            calculated_price: finalPrice,
            filter_matched: matchedFilter.id,
            pricing_rule_used: pricing?.id || null,
            priority: matchedFilter.priority,
          })
          .select('*')
          .maybeSingle();

        if (insertError) {
          console.error(`[Worker] Error inserting order ${order.externalId}:`, insertError);
          continue;
        }

        // Prepare response message
        let responseMessage = config.responseMessage;
        if (responseMessage) {
          responseMessage = responseMessage
            .replace(/{service}/gi, order.serviceType)
            .replace(/{price}/gi, finalPrice?.toFixed(2) || 'N/A')
            .replace(/{region}/gi, order.region || 'Any')
            .replace(/{game}/gi, order.gameName)
            .replace(/{description}/gi, order.description || '');
        }

        // Update with offer message
        if (responseMessage) {
          await supabase
            .from('requests')
            .update({
              offer_message: responseMessage,
              offer_sent_at: new Date().toISOString(),
            })
            .eq('id', (inserted as any).id);
        }

        await this.logEvent(
          userId,
          'success',
          'monitor',
          `New boosting order detected: ${order.gameName} - ${order.offerTitle?.slice(0, 50)}`,
          { external_id: order.externalId, price: finalPrice }
        );

        // Update stats
        await supabase.rpc('increment_stat', {
          user_id_input: userId,
          field: 'total_requests',
          amount: 1,
        });

        // Auto-respond on Eldorado
        if (config.autoRespond && scraper && responseMessage) {
          const sent = await scraper.respondToOrder(order.externalId, responseMessage);
          if (sent) {
            await this.logEvent(userId, 'success', 'automation', `Auto-response sent to order ${order.externalId}`);
            await supabase.rpc('increment_stat', {
              user_id_input: userId,
              field: 'total_offers_sent',
              amount: 1,
            });
          }
        }

        // Discord notification
        await this.sendDiscordNotifications(userId, config.discordWebhooks, {
          event: 'new_request',
          order,
          price: finalPrice,
          message: responseMessage,
        });
      }
    } catch (error) {
      console.error(`[Worker] Error monitoring orders for user ${userId}:`, error);
      await this.logEvent(userId, 'error', 'monitor', `Monitoring error: ${error}`);
    }
  }

  private matchFilters(order: BoostingOrder, filters: FilterConfig[]): FilterConfig | null {
    for (const filter of filters) {
      if (filter.serviceType && filter.serviceType !== 'all' && filter.serviceType !== order.serviceType) {
        continue;
      }
      if (filter.region && filter.region !== 'all' && filter.region !== order.region) {
        continue;
      }
      if (filter.minBudget !== null && (order.budget || 0) < filter.minBudget) {
        continue;
      }
      if (filter.maxBudget !== null && (order.budget || 0) > filter.maxBudget) {
        continue;
      }
      if (filter.keywords.length > 0) {
        const desc = (order.description || '').toLowerCase();
        const hasKeyword = filter.keywords.some(k => desc.includes(k.toLowerCase()));
        if (!hasKeyword) continue;
      }
      if (filter.excludedKeywords.length > 0) {
        const desc = (order.description || '').toLowerCase();
        const hasExcluded = filter.excludedKeywords.some(k => desc.includes(k.toLowerCase()));
        if (hasExcluded) continue;
      }
      return filter;
    }
    return null;
  }

  private matchPricing(order: BoostingOrder, rules: PricingConfig[]): PricingConfig | null {
    for (const rule of rules) {
      if (rule.serviceType !== 'all' && rule.serviceType !== order.serviceType) continue;
      if (rule.region !== 'all' && rule.region !== order.region) continue;
      return rule;
    }
    return null;
  }

  private async sendDiscordNotifications(
    userId: string,
    webhooks: DiscordWebhook[],
    data: { event: string; order: BoostingOrder; price: number | null; message: string | null }
  ): Promise<void> {
    for (const webhook of webhooks) {
      if (!webhook.events.includes(data.event)) continue;

      const colors: Record<string, number> = {
        new_request: 0x22c55e,
        offer_sent: 0x3b82f6,
      };

      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Eldorado Bot',
            embeds: [{
              title: `New Boosting Order - ${data.order.gameName}`,
              description: `**Service:** ${data.order.serviceType}\n**Price:** $${data.price?.toFixed(2) || 'N/A'}\n**Description:** ${data.order.description?.slice(0, 200) || 'N/A'}`,
              color: colors[data.event] || 0x22c55e,
              timestamp: new Date().toISOString(),
              footer: { text: 'Eldorado Bot Worker' },
            }],
          }),
        });
      } catch (e) {
        console.error(`[Worker] Discord webhook error:`, e);
      }
    }
  }

  private async logEvent(
    userId: string,
    level: 'info' | 'warn' | 'error' | 'success',
    category: string,
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await supabase.from('logs').insert({
      user_id: userId,
      level,
      category,
      message,
      details: details || null,
    });
  }

  async stop(): Promise<void> {
    console.log('[Worker] Stopping...');

    for (const [userId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    for (const [userId, scraper] of this.scrapers) {
      await scraper.close();
    }
    this.scrapers.clear();

    console.log('[Worker] Stopped');
  }
}

// Main execution
const worker = new EldoradoWorker();

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n[Worker] Received SIGINT');
  await worker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Worker] Received SIGTERM');
  await worker.stop();
  process.exit(0);
});

// Start worker
worker.start().catch(console.error);
