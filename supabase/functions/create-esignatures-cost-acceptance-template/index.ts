/**
 * Setup-Function: erstellt das eSignatures.com Template für die
 * Kostenübernahme und speichert template_id + Version in crm_settings.
 * Idempotent — kann beliebig oft aufgerufen werden.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  COST_ACCEPTANCE_TEMPLATE_MARKDOWN,
  COST_ACCEPTANCE_TEMPLATE_TITLE,
  TEMPLATE_VERSION,
  templateContentHash,
} from "../_shared/cost-acceptance-template.ts";
import { requireAuth } from "../_shared/auth.ts";

const ESIGNATURES_API = "https://esignatures.com/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req); // admin/staff

    const apiKey = Deno.env.get("ESIGNATURES_API_KEY");
    if (!apiKey) {
      throw new Error("ESIGNATURES_API_KEY ist nicht konfiguriert.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hash = await templateContentHash();

    // existing?
    const { data: existing } = await supabase
      .from("crm_settings")
      .select("value")
      .eq("key", "esignatures_cost_acceptance_template")
      .maybeSingle();

    if (
      existing?.value &&
      (existing.value as { hash?: string }).hash === hash
    ) {
      return new Response(
        JSON.stringify({
          status: "unchanged",
          template_id: (existing.value as { template_id?: string }).template_id,
          template_version: TEMPLATE_VERSION,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // create template at eSignatures
    const res = await fetch(
      `${ESIGNATURES_API}/templates?token=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: COST_ACCEPTANCE_TEMPLATE_TITLE,
          labels: ["cost-acceptance", `v${TEMPLATE_VERSION}`],
          content: COST_ACCEPTANCE_TEMPLATE_MARKDOWN,
        }),
      },
    );

    const json = await res.json();
    if (!res.ok || json?.status === "error") {
      throw new Error(
        `eSignatures Template-Erstellung fehlgeschlagen: ${
          JSON.stringify(json)
        }`,
      );
    }

    const templateId: string = json?.data?.template?.id ?? json?.template?.id;
    if (!templateId) throw new Error("Keine template_id in Response.");

    await supabase.from("crm_settings").upsert({
      key: "esignatures_cost_acceptance_template",
      value: {
        template_id: templateId,
        template_version: TEMPLATE_VERSION,
        hash,
        created_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        status: "created",
        template_id: templateId,
        template_version: TEMPLATE_VERSION,
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