import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestData {
  external_id: string;
  service_type?: string;
  region?: string;
  category?: string;
  description?: string;
  budget?: number;
}

interface FilterRow {
  id: string;
  name: string;
  service_type: string | null;
  region: string | null;
  category: string | null;
  min_budget: number | null;
  max_budget: number | null;
  keywords: string[];
  excluded_keywords: string[];
  priority: number;
}

interface PricingRuleRow {
  id: string;
  name: string;
  service_type: string;
  region: string;
  category: string;
  base_price: number;
  multiplier: number;
  markup_percent: number;
  min_price: number;
  max_price: number;
  priority: number;
}

interface MessageRow {
  id: string;
  template: string;
  service_type: string | null;
}

interface SettingsRow {
  user_id: string;
  auto_offer: boolean;
  auto_message: boolean;
  auto_discord: boolean;
  bot_running: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { user_id, requests: incomingRequests } = body as {
      user_id: string;
      requests: RequestData[];
    };

    if (!user_id || !Array.isArray(incomingRequests)) {
      return new Response(
        JSON.stringify({ error: "user_id and requests array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load user settings
    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const settings = settingsData as SettingsRow | null;
    if (!settings?.bot_running) {
      return new Response(
        JSON.stringify({ message: "Bot is not running", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load active filters
    const { data: filtersData } = await supabase
      .from("filters")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .order("priority", { ascending: true });
    const filters = (filtersData ?? []) as FilterRow[];

    // Load active pricing rules
    const { data: pricingData } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .order("priority", { ascending: false });
    const pricingRules = (pricingData ?? []) as PricingRuleRow[];

    // Load active messages
    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true);
    const messages = (messagesData ?? []) as MessageRow[];

    const results: { external_id: string; status: string; action: string }[] = [];

    for (const req of incomingRequests) {
      // Check if request already exists
      const { data: existing } = await supabase
        .from("requests")
        .select("id")
        .eq("user_id", user_id)
        .eq("external_id", req.external_id)
        .maybeSingle();

      if (existing) {
        results.push({ external_id: req.external_id, status: "skipped", action: "duplicate" });
        continue;
      }

      // Apply filters
      const matchedFilter = matchFilter(req, filters);
      const priority = matchedFilter?.priority ?? 2;

      // Insert the request
      const { data: inserted, error: insertError } = await supabase
        .from("requests")
        .insert({
          user_id,
          external_id: req.external_id,
          service_type: req.service_type ?? null,
          region: req.region ?? null,
          category: req.category ?? null,
          description: req.description ?? null,
          budget: req.budget ?? null,
          status: matchedFilter ? "filtered" : "new",
          priority,
          filter_matched: matchedFilter?.id ?? null,
        })
        .select("*")
        .maybeSingle();

      if (insertError || !inserted) {
        await logEvent(supabase, user_id, "error", "monitor", `Erro ao inserir solicitação ${req.external_id}: ${insertError?.message ?? "unknown"}`);
        results.push({ external_id: req.external_id, status: "error", action: "insert_failed" });
        continue;
      }

      await logEvent(supabase, user_id, "info", "monitor", `Nova solicitação detectada: ${req.service_type ?? "N/A"} - ${req.external_id}`, { request_id: (inserted as { id: string }).id });

      // Update stats
      await supabase.rpc("increment_stat", { user_id_input: user_id, field: "total_requests", amount: 1 }).catch(() => {});

      if (!matchedFilter) {
        results.push({ external_id: req.external_id, status: "new", action: "no_filter_match" });
        continue;
      }

      // Calculate price
      const pricingRule = matchPricingRule(req, pricingRules);
      let calculatedPrice: number | null = null;
      let pricingRuleId: string | null = null;

      if (pricingRule) {
        calculatedPrice = calculatePrice(pricingRule);
        pricingRuleId = pricingRule.id;
      }

      // Generate offer message
      let offerMessage: string | null = null;
      if (settings.auto_message && messages.length > 0) {
        const msg = matchMessage(req, messages);
        if (msg) {
          offerMessage = fillTemplate(msg.template, {
            service: req.service_type ?? "",
            region: req.region ?? "",
            category: req.category ?? "",
            description: req.description ?? "",
            budget: req.budget?.toString() ?? "",
            price: calculatedPrice?.toFixed(2) ?? "",
          });
        }
      }

      // Update request with pricing and message
      const updateData: Record<string, unknown> = {
        status: settings.auto_offer ? "offer_sent" : "priced",
        calculated_price: calculatedPrice,
        pricing_rule_used: pricingRuleId,
        offer_message: offerMessage,
      };
      if (settings.auto_offer) updateData.offer_sent_at = new Date().toISOString();

      await supabase
        .from("requests")
        .update(updateData)
        .eq("id", (inserted as { id: string }).id);

      if (settings.auto_offer) {
        await logEvent(supabase, user_id, "success", "automation", `Oferta enviada: ${req.external_id} - $${calculatedPrice?.toFixed(2) ?? "N/A"}`, { request_id: (inserted as { id: string }).id });
        await supabase.rpc("increment_stat", { user_id_input: user_id, field: "total_offers_sent", amount: 1 }).catch(() => {});
      } else {
        await logEvent(supabase, user_id, "info", "pricing", `Preço calculado: ${req.external_id} - $${calculatedPrice?.toFixed(2) ?? "N/A"}`, { request_id: (inserted as { id: string }).id });
      }

      // Discord notification
      if (settings.auto_discord) {
        const { data: webhooks } = await supabase
          .from("discord_webhooks")
          .select("*")
          .eq("user_id", user_id)
          .eq("is_active", true);

        for (const webhook of webhooks ?? []) {
          const events = webhook.events as string[];
          if (events.includes("new_request")) {
            await sendDiscordNotification(webhook.url, {
              title: "Nova Solicitação Detectada",
              description: `**Serviço:** ${req.service_type ?? "N/A"}\n**Região:** ${req.region ?? "N/A"}\n**Preço:** $${calculatedPrice?.toFixed(2) ?? "N/A"}`,
              color: 0x22c55e,
            });
          }
          if (settings.auto_offer && events.includes("offer_sent")) {
            await sendDiscordNotification(webhook.url, {
              title: "Oferta Enviada",
              description: `**Solicitação:** ${req.external_id}\n**Preço:** $${calculatedPrice?.toFixed(2) ?? "N/A"}\n**Mensagem:** ${offerMessage ?? "N/A"}`,
              color: 0x3b82f6,
            });
          }
        }

        await supabase.from("requests").update({ discord_notified: true }).eq("id", (inserted as { id: string }).id);
      }

      results.push({
        external_id: req.external_id,
        status: settings.auto_offer ? "offer_sent" : "priced",
        action: "processed",
      });
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function matchFilter(req: RequestData, filters: FilterRow[]): FilterRow | null {
  for (const f of filters) {
    if (f.service_type && req.service_type && f.service_type !== req.service_type) continue;
    if (f.region && req.region && f.region !== req.region) continue;
    if (f.category && req.category && f.category !== req.category) continue;
    if (f.min_budget != null && (req.budget ?? 0) < f.min_budget) continue;
    if (f.max_budget != null && (req.budget ?? 0) > f.max_budget) continue;

    const desc = (req.description ?? "").toLowerCase();
    if (f.keywords.length > 0) {
      const hasKeyword = f.keywords.some(k => desc.includes(k.toLowerCase()));
      if (!hasKeyword) continue;
    }
    if (f.excluded_keywords.length > 0) {
      const hasExcluded = f.excluded_keywords.some(k => desc.includes(k.toLowerCase()));
      if (hasExcluded) continue;
    }
    return f;
  }
  return null;
}

function matchPricingRule(req: RequestData, rules: PricingRule[]): PricingRule | null {
  for (const r of rules) {
    if (r.service_type !== "all" && r.service_type !== req.service_type) continue;
    if (r.region !== "all" && r.region !== req.region) continue;
    if (r.category !== "all" && r.category !== req.category) continue;
    return r;
  }
  return null;
}

function calculatePrice(rule: PricingRule): number {
  const price = rule.base_price * rule.multiplier * (1 + rule.markup_percent / 100);
  return Math.max(rule.min_price, Math.min(rule.max_price, price));
}

function matchMessage(req: RequestData, messages: MessageRow[]): MessageRow | null {
  const specific = messages.find(m => m.service_type && m.service_type === req.service_type);
  return specific ?? messages.find(m => !m.service_type) ?? null;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  level: string,
  category: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  await supabase.from("logs").insert({
    user_id: userId,
    level,
    category,
    message,
    details: details ?? null,
  });
}

async function sendDiscordNotification(url: string, embed: { title: string; description: string; color: number }): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Eldorado Bot",
        embeds: [{
          ...embed,
          timestamp: new Date().toISOString(),
          footer: { text: "Eldorado Bot - Sistema de Automação" },
        }],
      }),
    });
  } catch {
    // Silently fail - don't block processing
  }
}
