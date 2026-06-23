import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { user_id, event, request_data } = body as {
      user_id: string;
      event: string;
      request_data?: {
        external_id?: string;
        service_type?: string;
        region?: string;
        category?: string;
        description?: string;
        calculated_price?: number;
        offer_message?: string;
      };
    };

    if (!user_id || !event) {
      return new Response(
        JSON.stringify({ error: "user_id and event are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load active webhooks for this user that listen to this event
    const { data: webhooks } = await supabase
      .from("discord_webhooks")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true);

    const eventConfig: Record<string, { title: string; color: number; emoji: string }> = {
      new_request: { title: "Nova Solicitação", color: 0x22c55e, emoji: "🆕" },
      offer_sent: { title: "Oferta Enviada", color: 0x3b82f6, emoji: "📤" },
      offer_accepted: { title: "Oferta Aceita", color: 0x22c55e, emoji: "✅" },
      offer_rejected: { title: "Oferta Rejeitada", color: 0xef4444, emoji: "❌" },
    };

    const config = eventConfig[event] ?? eventConfig.new_request;
    const rd = request_data ?? {};

    let description = "";
    if (rd.service_type) description += `**Serviço:** ${rd.service_type}\n`;
    if (rd.region) description += `**Região:** ${rd.region}\n`;
    if (rd.category) description += `**Categoria:** ${rd.category}\n`;
    if (rd.calculated_price != null) description += `**Preço:** $${rd.calculated_price.toFixed(2)}\n`;
    if (rd.external_id) description += `**ID:** ${rd.external_id}\n`;
    if (rd.description) description += `**Descrição:** ${rd.description.slice(0, 200)}\n`;
    if (rd.offer_message) description += `**Mensagem:** ${rd.offer_message.slice(0, 200)}`;

    if (!description) description = "Evento recebido sem detalhes adicionais.";

    let sentCount = 0;
    let failCount = 0;

    for (const webhook of webhooks ?? []) {
      const events = webhook.events as string[];
      if (!events.includes(event)) continue;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Eldorado Bot",
            embeds: [{
              title: `${config.emoji} ${config.title}`,
              description,
              color: config.color,
              timestamp: new Date().toISOString(),
              footer: { text: "Eldorado Bot - Sistema de Automação" },
            }],
          }),
        });

        if (response.ok) {
          sentCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    // Log the notification
    await supabase.from("logs").insert({
      user_id,
      level: failCount > 0 && sentCount === 0 ? "error" : "success",
      category: "discord",
      message: `Notificação Discord enviada: ${event} (${sentCount} sucesso, ${failCount} falha)`,
      details: { event, sent_count: sentCount, fail_count: failCount },
    });

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failCount, event }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
