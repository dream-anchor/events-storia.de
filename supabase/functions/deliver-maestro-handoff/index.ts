// ─── Cron-Worker: liefert Outbox-Zeilen an MAESTRO ───────────────────────
// Aufgerufen minütlich von pg_cron via net.http_post mit x-cron-secret.
// Führt claim_maestro_handoffs RPC aus (atomarer FOR UPDATE SKIP LOCKED).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  BACKOFF_SECONDS,
  MAX_ATTEMPTS,
  handoffEnabled,
  postToMaestro,
  timingSafeEqualStr,
} from "../_shared/maestroHandoff.ts";

const BATCH = 20;

function shortId(id: string | null | undefined): string {
  return (id ?? "").slice(0, 8);
}
function log(step: string, data?: Record<string, unknown>) {
  console.log(`[MAESTRO-DELIVER] ${step}${data ? " " + JSON.stringify(data) : ""}`);
}

serve(async (req) => {
  // ─── Auth: konstante-Zeit-Vergleich mit Cron-Secret ────────────────────
  const expected = Deno.env.get("MAESTRO_HANDOFF_CRON_SECRET") ?? "";
  const received = req.headers.get("x-cron-secret") ?? "";
  if (!expected || !received || !timingSafeEqualStr(expected, received)) {
    log("auth_failed");
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  if (!handoffEnabled()) {
    log("handoff_disabled");
    return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), { status: 200 });
  }

  const url = Deno.env.get("MAESTRO_SHOP_ORDER_URL");
  const secret = Deno.env.get("SHOP_ORDER_WEBHOOK_SECRET");
  if (!url || !secret) {
    log("missing_config");
    return new Response(JSON.stringify({ error: "missing_config" }), { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ─── Batch atomar claimen (FOR UPDATE SKIP LOCKED in der RPC) ─────────
  const { data: claimed, error: claimErr } = await supabase.rpc("claim_maestro_handoffs", {
    batch_size: BATCH,
  });
  if (claimErr) {
    log("claim_failed", { err: claimErr.message });
    return new Response(JSON.stringify({ error: "claim_failed" }), { status: 500 });
  }

  const rows = (claimed ?? []) as Array<{
    id: string;
    delivery_event_id: string;
    raw_body: string;
    attempt_count: number;
  }>;

  log("claimed", { n: rows.length });

  let ok = 0, transient = 0, permanent = 0, conflicts = 0;

  for (const row of rows) {
    const started = Date.now();
    const result = await postToMaestro(row.raw_body, secret, url);
    const durationMs = Date.now() - started;

    const shortDelivery = shortId(row.delivery_event_id);

    if (result.ok) {
      await supabase.from("maestro_handoff_outbox").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        maestro_event_id: result.maestroEventId ?? null,
        maestro_payment_id: result.maestroPaymentId ?? null,
      }).eq("id", row.id);
      ok++;
      log("sent", { delivery: shortDelivery, http: result.httpStatus, ms: durationMs });
      continue;
    }

    // Fehlerpfad
    if (result.isAuth) {
      await supabase.from("maestro_handoff_outbox").update({
        status: "failed",
        last_error: `auth_${result.httpStatus}`,
      }).eq("id", row.id);
      permanent++;
      log("failed_auth", { delivery: shortDelivery, http: result.httpStatus });
      continue;
    }

    if (result.isConflict) {
      await supabase.from("maestro_handoff_outbox").update({
        status: "failed",
        last_error: `conflict_${result.errorCode ?? "409"}`,
      }).eq("id", row.id);
      conflicts++;
      log("failed_conflict", { delivery: shortDelivery, code: result.errorCode });
      continue;
    }

    // transient / unknown → retry mit Backoff
    const attempt = (row.attempt_count ?? 0); // wurde in RPC bereits +1 vor Send
    if (attempt >= MAX_ATTEMPTS) {
      await supabase.from("maestro_handoff_outbox").update({
        status: "failed",
        last_error: `max_attempts_${result.httpStatus}_${result.errorCode ?? "err"}`,
      }).eq("id", row.id);
      permanent++;
      log("failed_max_attempts", { delivery: shortDelivery, attempt });
    } else {
      const backoff = BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length - 1)];
      const next = new Date(Date.now() + backoff * 1000).toISOString();
      await supabase.from("maestro_handoff_outbox").update({
        status: "retry",
        next_attempt_at: next,
        last_error: `transient_${result.httpStatus}_${result.errorCode ?? "err"}`,
      }).eq("id", row.id);
      transient++;
      log("retry_scheduled", { delivery: shortDelivery, attempt, backoff_s: backoff });
    }
  }

  return new Response(JSON.stringify({ ok: true, claimed: rows.length, sent: ok, retried: transient, failed: permanent, conflicts }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
