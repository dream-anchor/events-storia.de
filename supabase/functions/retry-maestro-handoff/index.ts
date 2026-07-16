// ─── Manueller Retry einzelner Outbox-Zeilen ─────────────────────────────
// Auth: admin/staff JWT via _shared/auth.ts (kein ungeschützter Public-Endpoint).
// Setzt status='pending', next_attempt_at=now(), delivery_event_id bleibt.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req); // nur eingeloggte admin/staff dürfen retryen

    const { id } = await req.json();
    if (!id || typeof id !== "string") {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Reset für Zeilen im status failed/retry/conflict → pending; sent bleibt sent.
    const { data, error } = await supabase
      .from("maestro_handoff_outbox")
      .update({
        status: "pending",
        next_attempt_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", id)
      .neq("status", "sent")
      .select("id, delivery_event_id, status")
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "row not found or already sent" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    const msg = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
