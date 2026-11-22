import { deterministicExpiresAt, HOLD_BUFFER_MS } from "./stripeSessions.ts";
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  asyncHoldExtensionUntil, mixedPaymentMethodTypes, checkMixedSchedule, computeExpectedMixedAmount, isMixedAmountOk, giftLinkedToCatering, holdCoversSession, isCateringOrderNumber,
  mixedHoldMinutes, shouldHandleGiftInCatering, validateGiftForCateringPayment, giftLinesCents, normalizeGiftRequest,
} from "./giftMixed.ts";
import { isGiftSessionMetadata } from "./giftWebhook.ts";
import type { ScheduleSettings } from "./giftPricing.ts";

const schedule: ScheduleSettings = { pickup_hours: { "1": { open: "11:30", close: "22:00" } }, pickup_lead_minutes: 30, delivery_lead_days: 1, delivery_windows: [] };
const now = new Date("2026-11-23T10:00:00Z"); // Montag 11:00 Berlin

Deno.test("Catering-Bestellnummer: Format", () => {
  assertEquals(isCateringOrderNumber("CAT-BESTELLUNG-21-11-2026-345"), true);
  assertEquals(isCateringOrderNumber("CAT-BESTELLUNG-21-11-2026-1099"), true);
  assertEquals(isCateringOrderNumber("CAT-BESTELLUNG-22-11-2026-482915"), true);
  assertEquals(isCateringOrderNumber("CAT-BESTELLUNG-22-11-2026-12"), false);
  assertEquals(isCateringOrderNumber("EVT-BUCHUNG-21-11-2026-345"), false);
  assertEquals(isCateringOrderNumber("GK-26-00001"), false);
  assertEquals(isCateringOrderNumber("CAT-BESTELLUNG-21-11-2026-345; DROP"), false);
  assertEquals(isCateringOrderNumber(undefined), false);
});

Deno.test("Termin: nur ISO, nicht Vergangenheit, Sperrtage (delivery/both), KEINE Korb-Vorlaufregel", () => {
  assertEquals(checkMixedSchedule("23.11.2026", now, schedule, []).error, "invalid_date");
  assertEquals(checkMixedSchedule("2026-11-22", now, schedule, []).error, "date_in_past");
  // morgen / heute sind für den Korb-Anteil zulässig (Catering-Vorlauf prüft der Catering-Checkout)
  assertEquals(checkMixedSchedule("2026-11-23", now, schedule, []).ok, true);
  assertEquals(checkMixedSchedule("2026-11-24", now, schedule, []).ok, true);
  assertEquals(checkMixedSchedule("2026-12-24", now, schedule, [{ date: "2026-12-24", handover: "both" }]).error, "blackout");
  assertEquals(checkMixedSchedule("2026-12-24", now, schedule, [{ date: "2026-12-24", handover: "delivery" }]).error, "blackout");
  assertEquals(checkMixedSchedule("2026-12-24", now, schedule, [{ date: "2026-12-24", handover: "pickup" }]).ok, true);
});

Deno.test("Hold-Dauer mindestens 36 Min", () => {
  assertEquals(mixedHoldMinutes(40), 40);
  assertEquals(mixedHoldMinutes(36), 36);
  assertEquals(mixedHoldMinutes(10), 36);
  assertEquals(mixedHoldMinutes(NaN), 36);
});

Deno.test("Erwarteter Mischbetrag = Catering (gerundet auf Cent) + Korb-Cent", () => {
  assertEquals(computeExpectedMixedAmount(123.45, 9900), 22245);
  assertEquals(computeExpectedMixedAmount(100.005, 0), 10001); // wie Math.round(x*100) im Catering-Zweig
  assertEquals(computeExpectedMixedAmount(0.1 + 0.2, 100), 130);
});

Deno.test("Webhook-Routing: Korb im Catering nur mit order_type catering + gift_order_id", () => {
  assertEquals(shouldHandleGiftInCatering({ order_type: "catering", order_number: "CAT-1" }), false);
  assertEquals(shouldHandleGiftInCatering({ order_type: "catering", gift_order_id: "" }), false);
  assertEquals(shouldHandleGiftInCatering({ order_type: "catering", gift_order_id: "abc" }), true);
  assertEquals(shouldHandleGiftInCatering({ order_type: "voucher", gift_order_id: "abc" }), false);
  assertEquals(shouldHandleGiftInCatering(undefined), false);
  // darf den reinen Korb-Zweig nicht überlappen
  const md = { order_type: "catering", gift_order_id: "abc" };
  assertEquals(isGiftSessionMetadata(md), false);
});

Deno.test("Hold deckt die Session", () => {
  assertEquals(holdCoversSession(new Date(now.getTime() + 36 * 60_000).toISOString(), now), true);
  assertEquals(holdCoversSession(new Date(now.getTime() + 30 * 60_000).toISOString(), now), false);
  assertEquals(holdCoversSession(null, now), false);
});

Deno.test("Hold überdauert expires_at der Session plus Puffer an jeder Stelle des 3-Min-Fensters", () => {
  const base = Date.UTC(2026, 10, 22, 12, 0, 0);
  for (let off = 0; off < 180_000; off += 15_000) {
    const n = new Date(base + off);
    const exp = deterministicExpiresAt(n.getTime()) * 1000;
    assert(exp - n.getTime() >= 31 * 60_000, "Session mindestens 31 Min");
    assertEquals(holdCoversSession(new Date(exp + HOLD_BUFFER_MS).toISOString(), n), false); // genau gleich reicht nicht
    assertEquals(holdCoversSession(new Date(exp + HOLD_BUFFER_MS + 1000).toISOString(), n), true);
    assertEquals(holdCoversSession(new Date(exp - 1000).toISOString(), n), false);
    // der Hold von 36 Min (MIXED_MIN_HOLD_MINUTES) ab jetzt reicht immer
    assertEquals(holdCoversSession(new Date(n.getTime() + 36 * 60_000).toISOString(), n), true);
  }
});

Deno.test("Korb an Catering-Zahlung: Validierung", () => {
  const ok = { status: "pending", customer_email: "Max@Test.de", handover: "with_catering", payment_method: "online", catering_order_number: "CAT-BESTELLUNG-21-11-2026-345" };
  const p = { orderNumber: "CAT-BESTELLUNG-21-11-2026-345", customerEmail: "max@test.de", holdExpiresAt: new Date(now.getTime() + 36 * 60_000), now };
  assertEquals(validateGiftForCateringPayment(ok, p), { ok: true });
  assertEquals(validateGiftForCateringPayment({ ...ok, status: "paid" }, p), { ok: false, error: "gift_not_pending" });
  assertEquals(validateGiftForCateringPayment({ ...ok, catering_order_number: "CAT-BESTELLUNG-21-11-2026-999" }, p), { ok: false, error: "gift_not_linked" });
  assertEquals(validateGiftForCateringPayment({ ...ok, handover: "pickup" }, p), { ok: false, error: "gift_not_linked" });
  assertEquals(validateGiftForCateringPayment({ ...ok, payment_method: "on_site" }, p), { ok: false, error: "gift_not_linked" });
  assertEquals(validateGiftForCateringPayment(ok, { ...p, customerEmail: "andere@test.de" }), { ok: false, error: "gift_email_mismatch" });
  assertEquals(validateGiftForCateringPayment(ok, { ...p, holdExpiresAt: new Date(now.getTime() + 5 * 60_000) }), { ok: false, error: "gift_hold_expired" });
});

Deno.test("Webhook: Verknüpfung Korb <-> Catering", () => {
  assertEquals(giftLinkedToCatering({ handover: "with_catering", catering_order_number: "CAT-1" }, "CAT-1"), true);
  assertEquals(giftLinkedToCatering({ handover: "with_catering", catering_order_number: "CAT-2" }, "CAT-1"), false);
  assertEquals(giftLinkedToCatering({ handover: "pickup", catering_order_number: "CAT-1" }, "CAT-1"), false);
});

Deno.test("Betragsabgleich: Toleranz max. 2 Cent, nie bei fehlendem/falschem Betrag", () => {
  assertEquals(isMixedAmountOk(22245, 22245), true);
  assertEquals(isMixedAmountOk(22246, 22245), true);
  assertEquals(isMixedAmountOk(22248, 22245), false);
  assertEquals(isMixedAmountOk(12345, 22245), false); // nur Catering bezahlt, Korb fehlt
  assertEquals(isMixedAmountOk(null, 22245), false);
  assertEquals(isMixedAmountOk("22245", 22245), false);
});

Deno.test("Termin: Sperrtag je nach Catering-Art (Abholung/Lieferung)", () => {
  const b = [{ date: "2026-12-24", handover: "pickup" as const }];
  assertEquals(checkMixedSchedule("2026-12-24", now, schedule, b, true).error, "blackout");
  assertEquals(checkMixedSchedule("2026-12-24", now, schedule, b, false).ok, true);
});

Deno.test("Billie: Hold-Verlängerung nur bei unpaid + Mischsession, nie verkürzen", () => {
  const md = { order_type: "catering", gift_order_id: "g" };
  const until = asyncHoldExtensionUntil(md, "unpaid", "2026-12-01", new Date("2026-11-23T10:40:00Z"))!;
  assertEquals(until.toISOString(), "2026-12-01T22:59:00.000Z");
  assertEquals(asyncHoldExtensionUntil(md, "paid", "2026-12-01", null), null);
  assertEquals(asyncHoldExtensionUntil({ order_type: "catering" }, "unpaid", "2026-12-01", null), null);
  assertEquals(asyncHoldExtensionUntil(md, "unpaid", "kaputt", null), null);
  assertEquals(asyncHoldExtensionUntil(md, "unpaid", "2026-12-01", "2026-12-05T00:00:00Z"), null);
});

Deno.test("Mischsession: nur Karte, Billie bleibt Billie", () => {
  assertEquals(mixedPaymentMethodTypes("stripe"), ["card"]);
  assertEquals(mixedPaymentMethodTypes(undefined), ["card"]);
  assertEquals(mixedPaymentMethodTypes("billie"), null);
});

Deno.test("Fenstergrenze: Prüfung und Session-Ablauf mit demselben now; ein später gezogenes now (neues Fenster) wäre 3 Min länger als der Hold", () => {
  const windowEnd = Math.ceil(Date.UTC(2026, 10, 22, 12, 0, 1) / 180_000) * 180_000; // Beginn eines Fensters
  const checked = new Date(windowEnd - 1); // letzte Millisekunde des alten Fensters
  const later = new Date(windowEnd + 5_000); // zweites Date.now() wenige Sekunden später: schon im nächsten Fenster
  const expChecked = deterministicExpiresAt(checked.getTime()) * 1000;
  const expLater = deterministicExpiresAt(later.getTime()) * 1000;
  assertEquals(expLater - expChecked, 180_000);
  const hold = new Date(expChecked + HOLD_BUFFER_MS + 1000).toISOString(); // reicht genau für das geprüfte Fenster
  assertEquals(holdCoversSession(hold, checked), true);
  // altes Fehlverhalten: expires_at aus dem späteren now => Hold deckt die Session nicht mehr
  assertEquals(expLater + HOLD_BUFFER_MS > new Date(hold).getTime(), true);
  // Idempotenzfenster ist ebenfalls an dasselbe now gebunden
  assert(Math.floor(checked.getTime() / 180_000) !== Math.floor(later.getTime() / 180_000));
});

Deno.test("Korbwert: Summe Einzelpreis x Menge in Cent; leer = 0", () => {
  assertEquals(giftLinesCents([]), 0);
  assertEquals(giftLinesCents([{ unit_price_cents: 4900, qty: 2 }, { unit_price_cents: 14900, qty: 1 }]), 24700);
});

Deno.test("Korb-Anfrage des Browsers: nur gültige UUIDs/Mengen, gleiche Variante zusammengefasst, nie Beträge", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  assertEquals(normalizeGiftRequest([{ variant_id: a, qty: 1, price: 0 }, { variant_id: a.toUpperCase(), qty: 2 }, { variant_id: b, qty: 1 }]),
    [{ variant_id: a, qty: 3 }, { variant_id: b, qty: 1 }]);
  assertEquals(normalizeGiftRequest([{ variant_id: "x", qty: 1 }, { variant_id: a, qty: 0 }, { variant_id: a, qty: 1.5 }, { variant_id: a, qty: 11 }, null]), []);
  assertEquals(normalizeGiftRequest(undefined), []);
  assertEquals(normalizeGiftRequest("x"), []);
});
