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
      console.error("ESIGNATURES_API_KEY is missing");
      return new Response(
        JSON.stringify({ error: "ESIGNATURES_API_KEY is missing" }),
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

    const res = await fetch(`${ESIGNATURES_API}/templates`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: COST_ACCEPTANCE_TEMPLATE_TITLE,
        markdown: COST_ACCEPTANCE_TEMPLATE_MARKDOWN,
      }),
    });

    const responseText = await res.text();
    let json: unknown = null;
    try {
      json = responseText ? JSON.parse(responseText) : null;
    } catch {
      json = responseText;
    }

    if (!res.ok) {
      console.error("eSignatures API template creation failed", {
        status: res.status,
        statusText: res.statusText,
        responseBody: responseText,
      });

      const detail = extractErrorDetail(json, responseText);
      const message = `eSignatures template creation failed: ${res.status}${
        res.statusText ? ` ${res.statusText}` : ""
      }${detail ? ` - ${detail}` : ""}`;

      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateId = getTemplateId(json);
    if (!templateId) {
      console.error("eSignatures API response missing template_id", json);
      return new Response(
        JSON.stringify({
          error: `eSignatures API response missing template_id. Response: ${JSON.stringify(json)}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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

function getTemplateId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = root.data;
  const candidates: unknown[] = [];
  if (data && typeof data === "object") {
    if (Array.isArray(data)) {
      const first = data[0];
      if (first && typeof first === "object") {
        candidates.push((first as Record<string, unknown>).template_id);
      }
    } else {
      candidates.push((data as Record<string, unknown>).template_id);
    }
  }
  candidates.push(root.template_id);
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

function extractErrorDetail(payload: unknown, fallbackText: string): string {
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const detail = source.message ?? source.error ?? source.errors;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
  }
  return fallbackText.length > 500 ? `${fallbackText.slice(0, 500)}…` : fallbackText;
}