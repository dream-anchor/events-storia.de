import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Public endpoint: returns minimal, non-PII state of the most recent
// cost_acceptances row for a given inquiry. Used by the public-offer page
// to make the signature UX idempotent across reloads.
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({} as any));
    const inquiryId = String(body?.inquiry_id ?? "").trim();
    if (!inquiryId) return json(400, { error: "inquiry_id fehlt." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("cost_acceptances")
      .select(
        "id, status, sign_page_url, sign_page_url_embedded, signed_at, sent_at, amount_gross_cents, currency, event_title",
      )
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[get-public-cost-acceptance-state] load error:", error.message);
      return json(500, { error: "Status konnte nicht geladen werden." });
    }

    if (!data) return json(200, { acceptance: null });

    return json(200, {
      acceptance: {
        id: data.id,
        status: data.status,
        sign_page_url_embedded: data.sign_page_url_embedded ?? null,
        sign_page_url: data.sign_page_url ?? null,
        signed_at: data.signed_at ?? null,
        sent_at: data.sent_at ?? null,
        amount_gross_cents: data.amount_gross_cents ?? null,
        currency: data.currency ?? null,
        event_title: data.event_title ?? null,
      },
    });
  } catch (e) {
    console.error("[get-public-cost-acceptance-state] error:", (e as Error).message);
    return new Response(JSON.stringify({ error: "Interner Fehler." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});