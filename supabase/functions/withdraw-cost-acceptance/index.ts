/**
 * Zieht eine noch nicht unterschriebene Kostenübernahme zurück.
 * Storniert den Contract bei eSignatures.com (falls möglich) und
 * setzt den lokalen Status auf "withdrawn".
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";

const ESIGNATURES_API = "https://esignatures.com/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    await requireAuth(req);
    const { cost_acceptance_id } = await req.json();
    if (!cost_acceptance_id) throw new Error("cost_acceptance_id fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supabase
      .from("cost_acceptances")
      .select("id, status, esignatures_contract_id, webhook_events")
      .eq("id", cost_acceptance_id)
      .maybeSingle();
    if (error || !row) throw new Error("Kostenübernahme nicht gefunden");
    if (row.status === "signed") {
      throw new Error("Bereits unterschrieben — kein Rückzug mehr möglich.");
    }

    const apiKey = Deno.env.get("ESIGNATURES_API_KEY");
    if (apiKey && row.esignatures_contract_id) {
      // best-effort cancel
      await fetch(
        `${ESIGNATURES_API}/contracts/${row.esignatures_contract_id}/withdraw?token=${apiKey}`,
        { method: "POST" },
      ).catch(() => null);
    }

    const events = Array.isArray(row.webhook_events) ? row.webhook_events : [];
    events.push({ at: new Date().toISOString(), event: "withdrawn_by_admin" });

    await supabase
      .from("cost_acceptances")
      .update({ status: "withdrawn", webhook_events: events })
      .eq("id", cost_acceptance_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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