// Bulk-Reprocess: für alle freischwebenden Mails ohne Vorschlag suggest-email-mapping aufrufen.
// Max 50 Mails pro Aufruf, sequenziell.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: emails } = await admin
      .from("inbox_emails")
      .select("id")
      .is("suggestion_generated_at", null)
      .eq("is_hidden", false)
      .order("date_received", { ascending: false })
      .limit(200);

    const candidates = emails ?? [];
    let processed = 0;
    let withSuggestion = 0;
    let llmCalls = 0;

    for (const e of candidates.slice(0, 50)) {
      // Skip if already linked
      const { data: link } = await admin
        .from("event_email_links")
        .select("id")
        .eq("email_id", e.id)
        .eq("is_excluded", false)
        .limit(1)
        .maybeSingle();
      if (link) continue;

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/suggest-email-mapping`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ email_id: e.id }),
        });
        const json = await resp.json().catch(() => ({}));
        processed++;
        if (json?.suggestion) {
          withSuggestion++;
          if (json.method === "llm") llmCalls++;
        }
      } catch (err) {
        console.error("suggest call failed:", (err as Error).message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        with_suggestion: withSuggestion,
        llm_calls: llmCalls,
        remaining: Math.max(0, candidates.length - 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});