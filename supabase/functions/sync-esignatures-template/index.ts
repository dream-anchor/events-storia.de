/**
 * Admin-Funktion: prüft, ob sich der Markdown-Text geändert hat. Wenn ja,
 * erzeugt sie ein neues Template bei eSignatures.com und speichert die
 * neue template_id + version. Alte Kostenübernahmen behalten ihre alte
 * template_id und bleiben revisionssicher.
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
    await requireAuth(req);
    getEsignaturesApiKey(); // wirft verständlichen Fehler, wenn nicht gesetzt

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hash = await templateContentHash();
    const { data: existing } = await supabase
      .from("crm_settings")
      .select("value")
      .eq("key", "esignatures_cost_acceptance_template")
      .maybeSingle();

    const value = (existing?.value ?? {}) as {
      template_id?: string;
      template_version?: string;
      hash?: string;
      template_title?: string;
      created_at?: string;
      updated_at?: string;
      history?: Array<unknown>;
    };

    if (value.hash === hash) {
      return new Response(
        JSON.stringify({
          status: "unchanged",
          template_id: value.template_id,
          template_version: value.template_version,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const versionedTitle = `${COST_ACCEPTANCE_TEMPLATE_TITLE} (v${TEMPLATE_VERSION})`;

    let newId: string;
    try {
      const result = await createEsignaturesTemplate({
        title: versionedTitle,
        markdown: COST_ACCEPTANCE_TEMPLATE_MARKDOWN,
      });
      newId = result.template_id;
    } catch (e) {
      console.error("eSignatures template sync failed", (e as Error).message);
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Schutz: niemals leere/ungültige template_id speichern.
    if (typeof newId !== "string" || newId.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "eSignatures API response missing template_id — bestehende Template-Konfiguration bleibt unverändert.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const history = Array.isArray(value.history) ? value.history : [];
    if (value.template_id) {
      history.push({
        template_id: value.template_id,
        template_version: value.template_version,
        hash: value.hash,
        retired_at: new Date().toISOString(),
      });
    }

    const nowIso = new Date().toISOString();
    await supabase.from("crm_settings").upsert({
      key: "esignatures_cost_acceptance_template",
      value: {
        template_id: newId,
        template_version: TEMPLATE_VERSION,
        hash,
        template_title: versionedTitle,
        created_at: value.created_at ?? nowIso,
        updated_at: nowIso,
        history,
      },
    });

    return new Response(
      JSON.stringify({
        status: "updated",
        template_id: newId,
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