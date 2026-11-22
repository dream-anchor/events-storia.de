// deno test supabase/functions/_shared/orderFlow_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ensureOrder, matchesExisting, stripeIdempotencyKey } from "./orderFlow.ts";
import { buildOrderQuote, type OrderQuote } from "./orderQuote.ts";
import { parseCreateInput, type CreateInput } from "./orderCreate.ts";

const catalog = { a: { price: 30, active: true, menuSlug: "buffet", name: "Lasagne", nameEn: "Lasagna" } };
const quote: OrderQuote = (() => {
  const r = buildOrderQuote({ items: [{ id: "a", quantity: 12 }], chafingQuantity: 0, isPickup: false }, { catalog, packages: {}, oneWayKm: 12.34 });
  assert(r.ok);
  return r.quote;
})();
const input: CreateInput = (() => {
  const r = parseCreateInput({
    orderNumber: "CAT-BESTELLUNG-22-11-2026-123456", customer: { name: "Max", email: "max@example.com", phone: "1" },
    address: { street: "Teststr. 1", zip: "80333", city: "München", floor: "1", hasElevator: false }, date: "2026-12-01", time: "12:00",
    billing: {}, paymentMethod: "stripe",
  }, "catering");
  assert(r.ok);
  return r.input;
})();
const row = (over: Record<string, unknown> = {}) => ({
  id: "row1", customer_email: "max@example.com", total_amount: 514.25, payment_status: "pending", is_pickup: false,
  delivery_street: "Teststr. 1", delivery_zip: "80333", delivery_city: "München", desired_date: "2026-12-01", desired_time: "12:00:00",
  items: [{ id: "a", quantity: 12 }], ...over,
});

/** Fake: Tabelle catering_orders mit steuerbaren Lookups; protokolliert updates und rpc-Aufrufe. */
function fake(opts: { lookups: (Record<string, unknown> | null)[]; rpcError?: { code?: string; message: string } | null }) {
  const log = { updates: [] as unknown[], rpcs: [] as string[] };
  let n = 0;
  const client = {
    from(_t: string) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve({ data: opts.lookups[Math.min(n++, opts.lookups.length - 1)], error: null }),
        update: (v: unknown) => { log.updates.push(v); return q; },
        then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res),
      };
      return q;
    },
    rpc(name: string) { log.rpcs.push(name); return Promise.resolve({ error: opts.rpcError ?? null }); },
  };
  return { client, log };
}
const run = (c: ReturnType<typeof fake>, q = quote, i = input) => ensureOrder(c.client, { quote: q, input: i, orderId: "new1", payload: {} });

Deno.test("neu: keine Zeile -> RPC, created", async () => {
  const f = fake({ lookups: [null] });
  assertEquals(await run(f), { status: "created", orderId: "new1" });
  assertEquals(f.log.rpcs, ["checkout_create_catering_order"]);
});

Deno.test("Fortsetzen: gleiche Nummer, gleicher Inhalt -> resumed, keine zweite Anlage", async () => {
  const f = fake({ lookups: [row()] });
  assertEquals(await run(f), { status: "resumed", orderId: "row1" });
  assertEquals(f.log.rpcs, []);
  assertEquals(f.log.updates, []);
});

Deno.test("B1: gleicher Betrag, aber anderes Datum/Adresse/Positionen/Lieferart -> mismatch, alte Zeile storniert, nichts fortgesetzt", async () => {
  for (const changed of [{ desired_date: "2026-12-02" }, { desired_time: "13:00:00" }, { delivery_street: "Andere Str. 5" },
    { is_pickup: true }, { items: [{ id: "b", quantity: 12 }] }, { customer_email: "x@example.com" }]) {
    const f = fake({ lookups: [row(changed)] });
    assertEquals(await run(f), { status: "conflict", reason: "mismatch" }, JSON.stringify(changed));
    assertEquals(f.log.updates, [{ status: "cancelled" }]);
    assertEquals(f.log.rpcs, []);
  }
});

Deno.test("bezahlte Zeile wird nie angefasst", async () => {
  const f = fake({ lookups: [row({ payment_status: "paid" })] });
  assertEquals(await run(f), { status: "conflict", reason: "paid" });
  assertEquals(f.log.updates, []);
});

Deno.test("B2: Race (UNIQUE 23505), Gewinner passt -> resumed, kein Storno", async () => {
  const f = fake({ lookups: [null, row()], rpcError: { code: "23505", message: "duplicate key value violates unique constraint" } });
  assertEquals(await run(f), { status: "resumed", orderId: "row1" });
  assertEquals(f.log.updates, []);
});

Deno.test("B2: Race, Gewinner noch nicht sichtbar/anderer Inhalt -> conflict race (Aufrufer gibt NICHTS frei), nichts storniert", async () => {
  for (const second of [null, row({ desired_date: "2026-12-09" })]) {
    const f = fake({ lookups: [null, second], rpcError: { message: "duplicate key value" } });
    assertEquals(await run(f), { status: "conflict", reason: "race" });
    assertEquals(f.log.updates, []);
  }
});

Deno.test("anderer RPC-Fehler -> failed", async () => {
  const f = fake({ lookups: [null], rpcError: { code: "XX000", message: "boom" } });
  assertEquals(await run(f), { status: "failed", message: "boom", code: "XX000" });
});

Deno.test("Fingerabdruck: Abholung ignoriert die Adresse, Event vergleicht Paket/Gäste/Termin", () => {
  const pickupQuote = { ...quote, isPickup: true, delivery: null } as OrderQuote;
  assert(matchesExisting(row({ is_pickup: true, delivery_street: "egal" }), pickupQuote, input));
  const ev = { ...quote, kind: "event", isPickup: false, delivery: null, lines: [{ ...quote.lines[0], id: "event-p1", quantity: 20 }] } as OrderQuote;
  const evRow = { id: "e", customer_email: "max@example.com", total_amount: 514.25, payment_status: "pending", package_id: "p1", guest_count: 20, event_date: "2026-12-01", event_time: "12:00" };
  assert(matchesExisting(evRow, ev, input));
  assert(!matchesExisting({ ...evRow, guest_count: 21 }, ev, input));
});

Deno.test("Stripe-Idempotenzschlüssel: gleiche Bestellung im Fenster = gleicher Schlüssel, anderer Betrag/Korb/Fenster = anderer", () => {
  const t = Date.UTC(2026, 10, 22, 12, 0, 0);
  const k = stripeIdempotencyKey("CAT-1", 51425, "g1", t);
  assertEquals(k, stripeIdempotencyKey("CAT-1", 51425, "g1", t + 60_000));
  assert(k !== stripeIdempotencyKey("CAT-1", 51426, "g1", t));
  assert(k !== stripeIdempotencyKey("CAT-1", 51425, null, t));
  assert(k !== stripeIdempotencyKey("CAT-1", 51425, "g1", t + 26 * 60_000));
});
