/**
 * reconcile-payment-statuses
 *
 * Sicherheitsnetz: Prüft ob v2_payments mit status='paid' korrekt
 * in v2_events reflektiert werden. Korrigiert stille Failures aus
 * handle-offer-payment / handle-stripe-webhook.
 *
 * Verwendet ausschließlich v2_*-Tabellen (keine Legacy-Views).
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECONCILE-PAYMENT-STATUSES] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let checked = 0;
  let reconciled = 0;
  let errors = 0;

  try {
    log("Function started");

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // a) Lade v2_payments der letzten 48h mit status='paid'
    const { data: payments, error: paymentsError } = await supabase
      .from("v2_payments")
      .select(
        "id, event_id, status, payment_type, stripe_payment_intent_id, paid_at, created_at"
      )
      .gte("created_at", since)
      .or("status.eq.paid,stripe_payment_intent_id.not.is.null");

    if (paymentsError) {
      log("Failed to load payments", paymentsError);
      throw paymentsError;
    }

    log("Payments loaded", { count: payments?.length ?? 0 });

    for (const payment of payments ?? []) {
      checked++;
      try {
        if (!payment.event_id) {
          log("Skip payment without event_id", { paymentId: payment.id });
          continue;
        }

        const paid =
          payment.status === "paid" ||
          !!payment.stripe_payment_intent_id;
        if (!paid) continue;

        const { data: evt, error: evtError } = await supabase
          .from("v2_events")
          .select("id, status, offer_phase, is_test")
          .eq("id", payment.event_id)
          .maybeSingle();

        if (evtError) throw evtError;
        if (!evt) {
          log("Event not found", { paymentId: payment.id, eventId: payment.event_id });
          continue;
        }

        if (evt.is_test === true) continue;

        if (
          (evt.status === "paid" || evt.status === "completed") &&
          (evt.offer_phase === "confirmed" || evt.offer_phase === "paid")
        ) {
          continue;
        }

        const previousStatus = evt.status ?? "null";
        const previousPhase = evt.offer_phase ?? "null";

        const { error: updateError } = await supabase
          .from("v2_events")
          .update({
            status: "paid",
            offer_phase: "confirmed",
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", evt.id);

        if (updateError) throw updateError;

        // Activity-Log Eintrag
        const { error: logError } = await supabase
          .from("activity_logs")
          .insert({
            entity_type: "event_inquiry",
            entity_id: evt.id,
            action: "status_reconciled_by_cron",
            actor_email: "system@reconcile-payment-statuses",
            old_value: {
              status: previousStatus,
              offer_phase: previousPhase,
            },
            new_value: {
              status: "paid",
              offer_phase: "confirmed",
            },
            metadata: {
              message: `Status reconciled by cron (was: ${previousStatus})`,
              payment_id: payment.id,
              payment_type: payment.payment_type,
              source: "reconcile-payment-statuses",
            },
          });

        if (logError) {
          // Reconciliation hat geklappt – Logging-Fehler nur protokollieren
          log("activity_logs insert failed (non-fatal)", {
            paymentId: payment.id,
            error: logError.message,
          });
        }

        reconciled++;
        log("Reconciled event", {
          eventId: evt.id,
          paymentId: payment.id,
          previousStatus,
          previousPhase,
        });
      } catch (err) {
        errors++;
        log("Error processing payment (continuing)", {
          paymentId: payment.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const summary = { checked, reconciled, errors };
    log("Run finished", summary);

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("FATAL", { message, checked, reconciled, errors });
    return new Response(
      JSON.stringify({ ok: false, error: message, checked, reconciled, errors }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});