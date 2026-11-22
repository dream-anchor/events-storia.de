// EVT-Buchung nach bestätigter Stripe-Zahlung als bezahlt festhalten (Webhook, Abdichtung 22.11.2026).
// Die Anlage setzt Buchungen "offen" (v2-Status offer_chosen); erst die Zahlung macht daraus 'paid' und trägt v2_payments ein.
// Reihenfolge: Status zuerst, Zahlung zuletzt; scheitert eines, gibt die Funktion false zurück und Stripe wiederholt den Webhook
// (payment_status der Buchung ist dann noch nicht 'paid').
// deno-lint-ignore no-explicit-any
type Supa = any;

export async function markEventBookingPaid(
  supabase: Supa,
  booking: { id: string; total_amount: number | string | null },
  session: { id: string; amount_total?: number | null; payment_intent?: unknown },
  now = new Date(),
): Promise<{ ok: true } | { ok: false; step: "status" | "payment"; message: string }> {
  const { error: statusError } = await supabase
    .from("v2_events")
    .update({ status: "paid", updated_at: now.toISOString() })
    .eq("id", booking.id)
    .in("status", ["offer_chosen", "inquiry"]);
  if (statusError) return { ok: false, step: "status", message: statusError.message };
  const { error: payError } = await supabase.from("v2_payments").upsert({
    event_id: booking.id,
    amount_cents: typeof session.amount_total === "number" ? session.amount_total : Math.round(Number(booking.total_amount) * 100),
    payment_type: "full",
    status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: (session.payment_intent as string) || null,
    paid_at: now.toISOString(),
    paid_via: "stripe_checkout",
    notes: "Automatisch aus EVT-Buchungs-Zahlung angelegt",
  }, { onConflict: "stripe_checkout_session_id" });
  if (payError) return { ok: false, step: "payment", message: payError.message };
  return { ok: true };
}
