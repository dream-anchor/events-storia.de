/**
 * Admin-Funktion: Template-ID für die Kostenübernahme manuell setzen.
 * Schreibt in crm_settings.esignatures_cost_acceptance_template. Bereits
 * signierte Kostenübernahmen behalten ihre alte template_id (revisionssicher).
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import {
  COST_ACCEPTANCE_TEMPLATE_TITLE,
  TEMPLATE_VERSION,
  templateContentHash,
} from "../_shared/cost-acceptance-template.ts";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const auth = await requireAuth(req);
    if (auth.role !== "admin") {
      return jsonResponse(403, { error: "Nur Admins dürfen die Template-ID ändern." });
    }
    const { template_id } = (await req.json()) as { template_id?: string };
    const id = (template_id ?? "").toString().trim();
    if (!/^[a-f0-9-]{8,}$/i.test(id)) {
      return jsonResponse(400, { error: "Ungültige Template-ID." });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("crm_settings")
      .select("value")
      .eq("key", "esignatures_cost_acceptance_template")
      .maybeSingle();

    const prev = (existing?.value ?? {}) as {
      template_id?: string;
      template_version?: string;
      hash?: string;
      history?: unknown[];
      created_at?: string;
    };

    const history = Array.isArray(prev.history) ? prev.history : [];
    if (prev.template_id && prev.template_id !== id) {
      history.push({
        template_id: prev.template_id,
        template_version: prev.template_version,
        hash: prev.hash,
        retired_at: new Date().toISOString(),
        retired_reason: "manual_override",
      });
    }

    const hash = await templateContentHash();
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("crm_settings").upsert({
      key: "esignatures_cost_acceptance_template",
      value: {
        template_id: id,
        template_version: TEMPLATE_VERSION,
        hash,
        template_title: COST_ACCEPTANCE_TEMPLATE_TITLE,
        created_at: prev.created_at ?? nowIso,
        updated_at: nowIso,
        history,
        source: "manual",
      },
    });
    if (error) throw error;

    return jsonResponse(200, { template_id: id, template_version: TEMPLATE_VERSION });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonResponse(err.status, { error: err.message });
    }
    return jsonResponse(500, { error: (err as Error).message });
  }
});