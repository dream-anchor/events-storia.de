// Webhook-Schutz: eine bezahlte Stripe-Session darf eine STORNIERTE Bestellung nicht stillschweigend wieder beleben und keine
// Bestellung mit anderem Betrag bestätigen. In beiden Fällen wird nicht bestätigt; der Aufrufer alarmiert den Betreiber
// (die Zahlung wird protokolliert, nicht verworfen: Rückerstattung/Klärung manuell).
export type PaymentGuardResult = { ok: true } | { ok: false; reason: "cancelled" | "amount_mismatch"; detail: string };

export function checkPaymentMatchesOrder(
  order: { status?: string | null; total_amount?: number | string | null },
  session: { amount_total?: number | null },
  /** Mischbestellung: Stripe-Betrag enthält zusätzlich die Körbe, der Catering-Anteil lässt sich hier nicht isoliert vergleichen */
  hasGift: boolean,
): PaymentGuardResult {
  if (order.status === "cancelled") return { ok: false, reason: "cancelled", detail: "Bestellung war storniert" };
  if (!hasGift && typeof session.amount_total === "number") {
    const expected = Math.round(Number(order.total_amount) * 100);
    if (Math.abs(session.amount_total - expected) > 2) {
      return { ok: false, reason: "amount_mismatch", detail: `Stripe ${session.amount_total} Cent, Bestellung ${expected} Cent` };
    }
  }
  return { ok: true };
}

/** Bestellung ist schon mit einem ANDEREN PaymentIntent bezahlt als die eingehende Session: Doppelzahlung (Webhook-Wiederholung hat denselben PaymentIntent). */
export function isDoublePayment(order: { stripe_payment_intent_id?: string | null }, session: { payment_intent?: unknown }): boolean {
  const incoming = typeof session.payment_intent === "string" ? session.payment_intent : null;
  return !!order.stripe_payment_intent_id && !!incoming && order.stripe_payment_intent_id !== incoming;
}

/**
 * Webhook-Wiederholung/Zweitzahlung für eine schon bezahlte Bestellung: bei anderem PaymentIntent alarmieren (true), sonst still (false).
 * Abhängigkeiten werden übergeben, damit der Pfad ohne Stripe/Supabase testbar ist.
 */
export async function alertIfDoublePayment(
  order: { stripe_payment_intent_id?: string | null },
  session: { id: string; payment_intent?: unknown },
  orderNumber: string,
  deps: { report: (message: string) => void; alert: (subject: string, html: string) => Promise<void>; esc: (s: string) => string },
): Promise<boolean> {
  const newPi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (!newPi || !isDoublePayment(order, session)) return false;
  deps.report(`double_payment order=${orderNumber} session=${session.id} pi=${newPi} bereits bezahlt mit pi=${order.stripe_payment_intent_id}`);
  const e = deps.esc;
  await deps.alert(
    `Doppelzahlung: ${orderNumber}`,
    `<p>Für Bestellung ${e(orderNumber)} ist eine zweite Stripe-Zahlung eingegangen (Session ${e(session.id)}, PaymentIntent ${e(newPi)}). Die Bestellung war bereits mit PaymentIntent ${e(String(order.stripe_payment_intent_id))} bezahlt. Bitte die zweite Zahlung prüfen und zurückerstatten.</p>`,
  );
  return true;
}
