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
import {
  createEsignaturesTemplate,
  getEsignaturesApiKey,
} from "../_shared/esignatures-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req); // admin/staff

    try {
      getEsignaturesApiKey();
    } catch (e) {
      console.error("ESIGNATURES_API_KEY is missing");
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    console.log("eSignatures template creation details", {
      titleExists: Boolean(COST_ACCEPTANCE_TEMPLATE_TITLE),
      markdownLength: COST_ACCEPTANCE_TEMPLATE_MARKDOWN.length,
      templateVersion: TEMPLATE_VERSION,
      templateHash: hash,
      markdownPreview: COST_ACCEPTANCE_TEMPLATE_MARKDOWN.slice(0, 300),
    });

    let templateId: string;
    try {
      const result = await createEsignaturesTemplate({
        title: COST_ACCEPTANCE_TEMPLATE_TITLE,
        markdown: COST_ACCEPTANCE_TEMPLATE_MARKDOWN,
      });
      templateId = result.template_id;
    } catch (e) {
      console.error("eSignatures template creation failed", (e as Error).message);
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!templateId || templateId.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "eSignatures API response missing template_id" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("crm_settings").upsert({
      key: "esignatures_cost_acceptance_template",
      value: {
        template_id: templateId,
        template_version: TEMPLATE_VERSION,
        hash,
        template_title: COST_ACCEPTANCE_TEMPLATE_TITLE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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