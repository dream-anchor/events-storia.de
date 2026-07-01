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
  let markedOverdue = 0;
  let alertsSent = 0;

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

    // ================================================================
    // AGED PAYMENT SWEEP
    // 1) sent > 7 Tage → status='overdue'
    // 2) overdue älter als 14 Tage → WhatsApp-Alert (max. 1x pro 7 Tage,
    //    Dedup via activity_logs)
    // ================================================================
    try {
      const nowIso = new Date().toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      // 1) sent → overdue
      const { data: agedSent } = await supabase
        .from("v2_payments")
        .select("id, event_id, payment_type, amount_cents, created_at")
        .eq("status", "sent")
        .lt("created_at", sevenDaysAgo);

      for (const p of agedSent ?? []) {
        const { error: upErr } = await supabase
          .from("v2_payments")
          .update({ status: "overdue", updated_at: nowIso } as any)
          .eq("id", p.id);
        if (!upErr) markedOverdue++;
      }
      log("Marked overdue", { count: markedOverdue });

      // 2) Alert für overdue > 14 Tage
      const { data: aged } = await supabase
        .from("v2_payments")
        .select("id, event_id, payment_type, amount_cents, created_at")
        .eq("status", "overdue")
        .lt("created_at", fourteenDaysAgo);

      const sevenDaysAgoTs = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const p of aged ?? []) {
        // Dedup: kein Alert wenn in letzten 7 Tagen bereits gesendet
        const { data: lastAlert } = await supabase
          .from("activity_logs")
          .select("id, created_at")
          .eq("entity_id", p.event_id)
          .eq("action", "payment_overdue_alert")
          .contains("metadata", { payment_id: p.id })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastAlert && new Date(lastAlert.created_at).getTime() > sevenDaysAgoTs) {
          continue;
        }

        // Event + Kunde laden
        const { data: ev } = await supabase
          .from("v2_events")
          .select("id, booking_number, number, date, customer_id, is_test")
          .eq("id", p.event_id)
          .maybeSingle();
        if (!ev || ev.is_test) continue;

        let customerName = "";
        if (ev.customer_id) {
          const { data: cust } = await supabase
            .from("v2_customers")
            .select("first_name, last_name, company")
            .eq("id", ev.customer_id)
            .maybeSingle();
          customerName = [cust?.first_name, cust?.last_name].filter(Boolean).join(" ") ||
            cust?.company || "";
        }

        const ageDays = Math.floor(
          (Date.now() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000)
        );

        try {
          await supabase.functions.invoke("send-whatsapp-alert", {
            body: {
              type: "payment_overdue",
              entityType: "event_inquiry",
              entityId: ev.id,
              bookingNumber: ev.booking_number || ev.number || "",
              customerName,
              paymentType: p.payment_type,
              totalAmount: (p.amount_cents || 0) / 100,
              desiredDate: ev.date,
              ageDays,
            },
          });
        } catch (e) {
          log("whatsapp alert failed (non-fatal)", e instanceof Error ? e.message : e);
        }

        await supabase.from("activity_logs").insert({
          entity_type: "event_inquiry",
          entity_id: ev.id,
          action: "payment_overdue_alert",
          actor_email: "system@reconcile-payment-statuses",
          metadata: {
            payment_id: p.id,
            payment_type: p.payment_type,
            amount_eur: (p.amount_cents || 0) / 100,
            age_days: ageDays,
          },
        });
        alertsSent++;
      }
      log("Alerts sent", { count: alertsSent });
    } catch (sweepErr) {
      log("Aged sweep error (non-fatal)", sweepErr instanceof Error ? sweepErr.message : sweepErr);
    }

    return new Response(JSON.stringify({ ok: true, ...summary, markedOverdue, alertsSent }), {
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