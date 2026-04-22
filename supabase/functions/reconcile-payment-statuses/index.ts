/**
 * reconcile-payment-statuses
 *
 * AKUT-SCHUTZ gegen Bug in handle-offer-payment (silent status
 * update failure).
 *
 * Diese Function schreibt ABSICHTLICH auf Legacy-Tabellen
 * (event_inquiries, event_bookings), weil sie vor der geplanten
 * Datenmodell-Migration auf v2_*-Tabellen existiert.
 *
 * ABLAUFDATUM: Wird in Phase 3 der Datenmodell-Migration (siehe
 * docs/maestro/NEW-DATAMODEL.md) durch das atomare Umschalten von
 * handle-offer-payment auf v2_*-Tabellen ersetzt.
 *
 * NACH MIGRATION: Cron-Definition und diese Function komplett
 * löschen — nicht nur deaktivieren, sondern entfernen. Sonst
 * laufen minütliche Fehler auf die dann read-only gewordenen
 * Legacy-Tabellen.
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
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

    // a) Lade Bookings der letzten 48h, bei denen bezahlt wurde
    //    oder eine Stripe payment_intent_id vorhanden ist
    const { data: bookings, error: bookingsError } = await supabase
      .from("event_bookings")
      .select(
        "id, booking_number, payment_status, stripe_payment_intent_id, source_inquiry_id, created_at"
      )
      .gte("created_at", since)
      .or("payment_status.eq.paid,stripe_payment_intent_id.not.is.null");

    if (bookingsError) {
      log("Failed to load bookings", bookingsError);
      throw bookingsError;
    }

    log("Bookings loaded", { count: bookings?.length ?? 0 });

    for (const booking of bookings ?? []) {
      checked++;
      try {
        if (!booking.source_inquiry_id) {
          log("Skip booking without source_inquiry_id", {
            bookingId: booking.id,
          });
          continue;
        }

        // Nur Zahlungserfolg behandeln
        const paid =
          booking.payment_status === "paid" ||
          !!booking.stripe_payment_intent_id;
        if (!paid) continue;

        // b) Verknüpfte Inquiry laden (inkl. is_test, da event_bookings
        //    selbst kein is_test-Feld hat)
        const { data: inquiry, error: inquiryError } = await supabase
          .from("event_inquiries")
          .select("id, status, offer_phase, is_test")
          .eq("id", booking.source_inquiry_id)
          .maybeSingle();

        if (inquiryError) throw inquiryError;
        if (!inquiry) {
          log("Inquiry not found", {
            bookingId: booking.id,
            inquiryId: booking.source_inquiry_id,
          });
          continue;
        }

        // d) Test-Bookings ignorieren
        if (inquiry.is_test === true) continue;

        // 5) Idempotenz: bereits konsistent → nichts tun
        if (
          inquiry.status === "confirmed" &&
          inquiry.offer_phase === "confirmed"
        ) {
          continue;
        }

        const previousStatus = inquiry.status ?? "null";
        const previousPhase = inquiry.offer_phase ?? "null";

        // c) Inquiry auf 'confirmed' setzen
        const { error: updateError } = await supabase
          .from("event_inquiries")
          .update({
            status: "confirmed",
            offer_phase: "confirmed",
            converted_to_booking_id: booking.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inquiry.id);

        if (updateError) throw updateError;

        // Activity-Log Eintrag
        const { error: logError } = await supabase
          .from("activity_logs")
          .insert({
            entity_type: "event_inquiry",
            entity_id: inquiry.id,
            action: "status_reconciled_by_cron",
            actor_email: "system@reconcile-payment-statuses",
            old_value: {
              status: previousStatus,
              offer_phase: previousPhase,
            },
            new_value: {
              status: "confirmed",
              offer_phase: "confirmed",
            },
            metadata: {
              message: `Status reconciled by cron (was: ${previousStatus})`,
              booking_id: booking.id,
              booking_number: booking.booking_number,
              source: "reconcile-payment-statuses",
            },
          });

        if (logError) {
          // Reconciliation hat geklappt – Logging-Fehler nur protokollieren
          log("activity_logs insert failed (non-fatal)", {
            bookingId: booking.id,
            error: logError.message,
          });
        }

        reconciled++;
        log("Reconciled inquiry", {
          inquiryId: inquiry.id,
          bookingId: booking.id,
          previousStatus,
          previousPhase,
        });
      } catch (err) {
        errors++;
        log("Error processing booking (continuing)", {
          bookingId: booking.id,
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