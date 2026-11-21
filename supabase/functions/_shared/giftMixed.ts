// Mischbestellung (Catering + Geschenkkörbe, Konzept § 11): reine, testbare Entscheidungslogik.
// Eine Zahlung (Catering-Stripe-Session), zwei Datensätze (catering_orders + gift_orders, verknüpft über
// gift_orders.catering_order_number). Korb-Beträge kommen IMMER vom Server (create-gift-order), nie vom Client.
import { businessDate, isBlackout, isIsoDate, type BlackoutDate, type ScheduleCheck, type ScheduleSettings } from "./giftPricing.ts";

/** Stripe-Session der Catering-Zahlung: 31 Min (Minimum 30). Der Korb-Hold muss sie überdauern (Hold >= 36 Min). */
export const MIXED_SESSION_MINUTES = 31;
export const MIXED_MIN_HOLD_MINUTES = 36;

/** Format der Catering-Bestellnummer aus dem Checkout (generateOrderNumber): CAT-BESTELLUNG-TT-MM-JJJJ-NNN(N). */
const CATERING_ORDER_NUMBER_RE = /^CAT-BESTELLUNG-\d{2}-\d{2}-\d{4}-\d{3,4}$/;
export const isCateringOrderNumber = (s: unknown): s is string => typeof s === "string" && CATERING_ORDER_NUMBER_RE.test(s);

/**
 * Termin einer Korb-Bestellung "mit Catering": Datum = Catering-Termin. Geprüft werden nur ISO-Format,
 * nicht in der Vergangenheit (Geschäftstag) und Sperrtage (Übergabe 'delivery'/'both'). KEINE Korb-Vorlauf-/Abholzeitregel
 * (der Catering-Vorlauf von 24 h ist strenger und wird vom Catering-Checkout geprüft).
 */
export function checkMixedSchedule(
  date: string,
  now: Date,
  schedule: ScheduleSettings,
  blackout: BlackoutDate[],
): ScheduleCheck {
  if (!isIsoDate(date)) return { ok: false, error: "invalid_date" };
  if (date < businessDate(now, schedule)) return { ok: false, error: "date_in_past" };
  if (isBlackout(date, "delivery", blackout)) return { ok: false, error: "blackout" };
  return { ok: true };
}

/** Hold-Dauer in Minuten: mindestens so lang, dass er die Catering-Session (31 Min) sicher überdauert. */
export const mixedHoldMinutes = (settingsHoldMinutes: number): number =>
  Math.max(Number.isFinite(settingsHoldMinutes) ? settingsHoldMinutes : 0, MIXED_MIN_HOLD_MINUTES);

/** Erwarteter Stripe-Gesamtbetrag in Cent: Catering (Euro, vom Catering-Datensatz) + Korb-Anteil (Cent, serverseitig). */
export const computeExpectedMixedAmount = (cateringTotalEuro: number, giftTotalCents: number): number =>
  Math.round(Number(cateringTotalEuro) * 100) + giftTotalCents;

/** Webhook-Routing: Catering-Session MIT verknüpfter Korb-Bestellung (nur dann läuft die Korb-Behandlung). */
export function shouldHandleGiftInCatering(md: Record<string, string> | null | undefined): boolean {
  return md?.order_type === "catering" && typeof md?.gift_order_id === "string" && md.gift_order_id.length > 0;
}

export interface MixedGiftOrder {
  status: string;
  customer_email: string;
  handover: string;
  payment_method: string;
  catering_order_number: string | null;
  is_test?: boolean;
}

export type MixedGiftError = "gift_not_pending" | "gift_email_mismatch" | "gift_not_linked" | "gift_hold_expired";

/** Der Hold muss die Stripe-Session (31 Min ab jetzt) überdauern; sonst könnte bezahlt werden, ohne dass Bestand gehalten wird. */
export const holdCoversSession = (holdExpiresAt: string | Date | null | undefined, now: Date): boolean => {
  if (!holdExpiresAt) return false;
  const t = new Date(holdExpiresAt).getTime();
  return Number.isFinite(t) && t > now.getTime() + MIXED_SESSION_MINUTES * 60_000;
};

/** create-catering-payment: darf diese Korb-Bestellung an die Catering-Zahlung angehängt werden? */
export function validateGiftForCateringPayment(
  g: MixedGiftOrder,
  p: { orderNumber: string; customerEmail: string; holdExpiresAt: string | Date | null | undefined; now: Date },
): { ok: true } | { ok: false; error: MixedGiftError } {
  if (g.status !== "pending") return { ok: false, error: "gift_not_pending" };
  if (g.handover !== "with_catering" || g.payment_method !== "online" || g.catering_order_number !== p.orderNumber) {
    return { ok: false, error: "gift_not_linked" };
  }
  if (g.customer_email.trim().toLowerCase() !== p.customerEmail.trim().toLowerCase()) return { ok: false, error: "gift_email_mismatch" };
  if (!holdCoversSession(p.holdExpiresAt, p.now)) return { ok: false, error: "gift_hold_expired" };
  return { ok: true };
}

/** Stripe-Positionsname einer Korb-Zeile (Servername + Variante). */
export const giftLineName = (basketName: string, variantLabel: string): string => `${basketName} – ${variantLabel}`;

/** Webhook: Korb-Bestellung darf bestätigt werden, wenn Verknüpfung stimmt (Catering-Nummer = Session-Bestellnummer). */
export const giftLinkedToCatering = (g: { handover: string; catering_order_number: string | null }, cateringOrderNumber: string): boolean =>
  g.handover === "with_catering" && g.catering_order_number === cateringOrderNumber;
