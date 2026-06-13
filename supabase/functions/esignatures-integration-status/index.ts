/**
 * Liefert dem Admin-Frontend einen Integration-Health-Check für
 * die eSignatures-Anbindung. Gibt nur Booleans/IDs zurück, niemals
 * die Secrets selbst.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { TEMPLATE_VERSION } from "../_shared/cost-acceptance-template.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    await requireAuth(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("crm_settings")
      .select("value")
      .eq("key", "esignatures_cost_acceptance_template")
      .maybeSingle();
    const value = (data?.value ?? {}) as {
      template_id?: string;
      template_version?: string;
    };
    const rawUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
    const isValidUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(rawUrl);
    const webhookUrl = isValidUrl
      ? `${rawUrl}/functions/v1/esignatures-webhook`
      : null;
    return new Response(
      JSON.stringify({
        has_api_key: !!Deno.env.get("ESIGNATURES_API_KEY"),
        has_webhook_secret: !!Deno.env.get("ESIGNATURES_WEBHOOK_SECRET"),
        template_id: value.template_id ?? null,
        template_version: value.template_version ?? null,
        current_template_version: TEMPLATE_VERSION,
        webhook_url: webhookUrl,
        supabase_url_available: isValidUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});