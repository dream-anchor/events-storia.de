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
