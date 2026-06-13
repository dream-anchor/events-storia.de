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

const ESIGNATURES_API = "https://esignatures.com/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    const apiKey = Deno.env.get("ESIGNATURES_API_KEY");
    if (!apiKey) throw new Error("ESIGNATURES_API_KEY fehlt");

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

    const res = await fetch(
      `${ESIGNATURES_API}/templates?token=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${COST_ACCEPTANCE_TEMPLATE_TITLE} (v${TEMPLATE_VERSION})`,
          labels: ["cost-acceptance", `v${TEMPLATE_VERSION}`],
          content: COST_ACCEPTANCE_TEMPLATE_MARKDOWN,
        }),
      },
    );
    const json = await res.json();
    if (!res.ok || json?.status === "error") {
      throw new Error(`Sync fehlgeschlagen: ${JSON.stringify(json)}`);
    }
    const newId: string = json?.data?.template?.id ?? json?.template?.id;

    const history = Array.isArray(value.history) ? value.history : [];
    if (value.template_id) {
      history.push({
        template_id: value.template_id,
        template_version: value.template_version,
        hash: value.hash,
        retired_at: new Date().toISOString(),
      });
    }

    await supabase.from("crm_settings").upsert({
      key: "esignatures_cost_acceptance_template",
      value: {
        template_id: newId,
        template_version: TEMPLATE_VERSION,
        hash,
        created_at: new Date().toISOString(),
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