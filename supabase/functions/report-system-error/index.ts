// Hub edge function — accepts error reports from events-storia.de and ristorantestoria.de
// Public endpoint; authenticated via SYSTEM_HEALTH_SHARED_SECRET to prevent spoofing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("SYSTEM_HEALTH_SHARED_SECRET")!;

const ALLOWED_PROJECTS = new Set(["events_storia", "ristorante_storia"]);
const ALLOWED_SEVERITIES = new Set(["warning", "error", "critical"]);

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Healthcheck (no auth needed)
    if (body?.healthcheck === true) {
      return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      project,
      source,
      severity = "error",
      message,
      payload,
      url,
      user_agent,
      shared_secret,
    } = body ?? {};

    if (shared_secret !== SHARED_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_PROJECTS.has(project)) {
      return new Response(JSON.stringify({ error: "invalid_project" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_SEVERITIES.has(severity)) {
      return new Response(JSON.stringify({ error: "invalid_severity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof source !== "string" || source.length === 0 || source.length > 200) {
      return new Response(JSON.stringify({ error: "invalid_source" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof message !== "string" || message.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const truncatedMessage = message.slice(0, 2000);
    const payloadHash = await sha256Hex(`${project}|${source}|${truncatedMessage}`);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data, error } = await supabase.rpc("report_system_error_internal", {
      p_project: project,
      p_source: source,
      p_severity: severity,
      p_message: truncatedMessage,
      p_payload_hash: payloadHash,
      p_payload: payload ?? null,
      p_url: url ?? null,
      p_user_agent: user_agent ?? null,
    });

    if (error) {
      console.error("[report-system-error] rpc error", error);
      return new Response(JSON.stringify({ error: "db_error", detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = Array.isArray(data) ? data[0] : data;
    const count = row?.count ?? 1;
    const wasNew = row?.was_new ?? false;

    // Burst-Eskalation: nur bei kritischen Schwellen
    // (Mail/WhatsApp-Hook hier später nachrüsten – jetzt erstmal nur Telemetrie.)
    let escalated = false;
    if (severity === "critical" || count >= 5) {
      escalated = true;
      await supabase
        .from("system_errors")
        .update({ escalated_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("escalated_at", null);
    }

    return new Response(
      JSON.stringify({ ok: true, id: row?.id, count, was_new: wasNew, escalated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[report-system-error] unhandled", err);
    return new Response(JSON.stringify({ error: "internal", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});