// deno test supabase/functions/_shared/orderMisc_test.ts
// Webhook EVT-Zahlung, Entfernungs-Cache/Tagesbudget, Ratenbegrenzung, Terminregeln, Strecken-Anzeige.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { markEventBookingPaid } from "./eventPayment.ts";
import { addressCacheKey, cachedOneWayDistanceKm, resetDistanceCachesForTest, takeOrsBudget } from "./cateringServer.ts";
import { rateLimited } from "./giftRateLimit.ts";
import { checkOrderSchedule } from "./orderSchedule.ts";
import { deliveryDistanceLabel } from "./cateringPricing.ts";

Deno.test("Webhook: EVT-Zahlung setzt Status paid (nur offene) und trägt v2_payments ein", async () => {
  const calls: { table: string; op: string; v: unknown; filters: unknown[] }[] = [];
  const client = {
    from(table: string) {
      const filters: unknown[] = [];
      const q = {
        update: (v: unknown) => { calls.push({ table, op: "update", v, filters }); return q; },
        upsert: (v: unknown, o: unknown) => { calls.push({ table, op: "upsert", v: { v, o }, filters }); return Promise.resolve({ error: null }); },
        eq: (...a: unknown[]) => { filters.push(["eq", ...a]); return q; },
        in: (...a: unknown[]) => { filters.push(["in", ...a]); return Promise.resolve({ error: null }); },
      };
      return q;
    },
  };
  const r = await markEventBookingPaid(client, { id: "b1", total_amount: 1500 }, { id: "cs_1", amount_total: 150000, payment_intent: "pi_1" }, new Date("2026-12-01T10:00:00Z"));
  assertEquals(r, { ok: true });
  assertEquals(calls[0].table, "v2_events");
  assertEquals((calls[0].v as { status: string }).status, "paid");
  assertEquals(calls[0].filters, [["eq", "id", "b1"], ["in", "status", ["offer_chosen", "inquiry"]]]); // nie completed/cancelled überschreiben
  const up = calls[1].v as { v: Record<string, unknown>; o: unknown };
  assertEquals([calls[1].table, up.v.amount_cents, up.v.status, up.v.stripe_checkout_session_id, up.o], ["v2_payments", 150000, "paid", "cs_1", { onConflict: "stripe_checkout_session_id" }]);
});

Deno.test("Webhook: Fehler beim Status -> keine Zahlung eingetragen, Meldung (Stripe wiederholt)", async () => {
  const client = { from: () => ({ update: () => ({ eq: () => ({ in: () => Promise.resolve({ error: { message: "db down" } }) }) }) }) };
  assertEquals(await markEventBookingPaid(client, { id: "b", total_amount: 1 }, { id: "cs" }), { ok: false, step: "status", message: "db down" });
});

const orsFetch = (counter: { n: number }): typeof fetch => (async (url: string | URL | Request) => {
  counter.n++;
  if (String(url).includes("geocode")) return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [11.6, 48.2] } }] }));
  return new Response(JSON.stringify({ routes: [{ summary: { distance: 0 } }] })); // 0 m = gültig
});
const emptyDb = { from: () => ({ select: () => ({ eq: () => ({ gt: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }), upsert: () => Promise.resolve({}) }) };

Deno.test("Entfernungs-Cache: zweite Anfrage gleicher Adresse (andere Schreibweise) ruft ORS nicht erneut; 0 m ist 0 km", async () => {
  resetDistanceCachesForTest();
  const c = { n: 0 };
  assertEquals(await cachedOneWayDistanceKm(emptyDb, "Karlstr. 47a, 80333 München", "k", orsFetch(c)), 0);
  assertEquals(c.n, 2);
  assertEquals(await cachedOneWayDistanceKm(emptyDb, "karlstr 47a  80333 münchen", "k", orsFetch(c)), 0);
  assertEquals(c.n, 2);
  assertEquals(addressCacheKey("A, B."), addressCacheKey(" a   b "));
});

Deno.test("DB-Cache-Treffer: kein ORS-Aufruf", async () => {
  resetDistanceCachesForTest();
  const c = { n: 0 };
  const db = { from: () => ({ select: () => ({ eq: () => ({ gt: () => ({ maybeSingle: () => Promise.resolve({ data: { km: 7.5 } }) }) }) }) }) };
  assertEquals(await cachedOneWayDistanceKm(db, "Teststr. 1, 80333 München", "k", orsFetch(c)), 7.5);
  assertEquals(c.n, 0);
});

Deno.test("Tagesbudget: erschöpft -> null (fail closed), neuer Tag setzt zurück", async () => {
  resetDistanceCachesForTest();
  const day1 = new Date("2026-12-01T10:00:00Z");
  assert(takeOrsBudget(2, day1, 4));
  assert(takeOrsBudget(2, day1, 4));
  assert(!takeOrsBudget(2, day1, 4));
  assert(takeOrsBudget(2, new Date("2026-12-02T00:10:00Z"), 4));
});

Deno.test("Ratenbegrenzung: Überlauf entfernt nur die ältesten Schlüssel, aktive Begrenzung bleibt bestehen", () => {
  for (let i = 0; i < 5100; i++) rateLimited(`k${i}`, 100, 60_000);
  // frisch gefüllter Schlüssel wird weiter gezählt (die Map wurde nicht komplett geleert)
  assert(!rateLimited("limited", 2, 60_000));
  assert(!rateLimited("limited", 2, 60_000));
  assert(rateLimited("limited", 2, 60_000));
  for (let i = 0; i < 4000; i++) rateLimited(`n${i}`, 100, 60_000);
  assert(rateLimited("limited", 2, 60_000), "Begrenzung überlebt den Überlauf");
});

Deno.test("Terminregeln: 24 h Vorlauf, Pizza 1 h + Zeitfenster, Wochenend-Frist, Event frei", () => {
  const now = new Date("2026-12-01T10:00:00Z"); // 11:00 Berlin, Dienstag
  const base = { kind: "catering" as const, isPickup: true, isPizzaOnly: false };
  assertEquals(checkOrderSchedule({ ...base, date: "2026-12-02", time: "10:00" }, now), "schedule_lead_time");
  assertEquals(checkOrderSchedule({ ...base, date: "2026-12-02", time: "12:00" }, now), null);
  assertEquals(checkOrderSchedule({ ...base, isPizzaOnly: true, date: "2026-12-01", time: "11:00" }, now), "schedule_pizza_window");
  assertEquals(checkOrderSchedule({ ...base, isPizzaOnly: true, date: "2026-12-01", time: "12:00" }, new Date("2026-12-01T10:30:00Z")), "schedule_pizza_lead_time");
  assertEquals(checkOrderSchedule({ ...base, isPizzaOnly: true, date: "2026-12-01", time: "18:00" }, now), null);
  // Samstag 05.12. Lieferung: Frist Donnerstag 03.12. 23:59
  const fri = new Date("2026-12-04T09:00:00Z");
  assertEquals(checkOrderSchedule({ ...base, isPickup: false, date: "2026-12-05", time: "12:00" }, fri), "schedule_weekend_cutoff");
  assertEquals(checkOrderSchedule({ ...base, isPickup: true, date: "2026-12-06", time: "12:00" }, new Date("2026-12-04T09:00:00Z")), null);
  assertEquals(checkOrderSchedule({ kind: "event", isPickup: false, isPizzaOnly: false, date: "2026-12-01", time: "10:00" }, now), null);
});

Deno.test("Strecken-Anzeige für Mail/Rechnung: einfache Strecke x Fahrten aus der Gebühr", () => {
  assertEquals(deliveryDistanceLabel(12.34, 154.25), "12,3 km × 2 Fahrten");
  assertEquals(deliveryDistanceLabel(12.34, 77.12, "en"), "12.3 km × 1 trip");
  assertEquals(deliveryDistanceLabel(5, 119), "5 km × 2 Fahrten");
  assertEquals(deliveryDistanceLabel(24, 154.25), "24 km"); // Altwert (Strecke x Fahrten) passt zu keiner Gebühr: nur km
  assertEquals(deliveryDistanceLabel(0.9, 0), "0,9 km");
});
