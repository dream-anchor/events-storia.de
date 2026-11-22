// deno test supabase/functions/_shared/orderFlow_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ensureOrder, exactIlikePattern, matchesExisting } from "./orderFlow.ts";
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

/** Fake: Tabelle mit steuerbaren Lookups; protokolliert Updates (Tabelle, Werte, Filter) und rpc-Aufrufe. */
function fake(opts: { lookups: (Record<string, unknown> | null)[]; rpcError?: { code?: string; message: string } | null; updateRows?: unknown[] }) {
  const log = { ilikes: [] as unknown[][], updates: [] as { table: string; v: unknown; filters: unknown[] }[], rpcs: [] as string[], inserts: [] as string[] };
  let n = 0;
  const client = {
    from(table: string) {
      const filters: unknown[] = [];
      const q = {
        select: () => q,
        eq: (...a: unknown[]) => { filters.push(["eq", ...a]); return q; },
        neq: (...a: unknown[]) => { filters.push(["neq", ...a]); return q; },
        ilike: (...a: unknown[]) => { if (table === "v2_customers") log.ilikes.push(a); return q; },
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: table === "v2_customers" ? { id: "cust1" } : opts.lookups[Math.min(n++, opts.lookups.length - 1)], error: null }),
        update: (v: unknown) => { log.updates.push({ table, v, filters }); return q; },
        insert: () => { log.inserts.push(table); return q; },
        then: (res: (v: unknown) => unknown) => Promise.resolve({ data: opts.updateRows ?? [{ id: "row1" }], error: null }).then(res),
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
  // A3: Felder außerhalb des Fingerabdrucks (Rechnungsadresse, Notizen, Stockwerk) werden auf der unbezahlten Zeile aktualisiert, Betrag/Positionen nicht
  const u = f.log.updates.find((x) => x.table === "catering_orders");
  assert(u && "billing_name" in (u.v as object) && "notes" in (u.v as object) && !("total_amount" in (u.v as object)) && !("items" in (u.v as object)));
  assert(f.log.updates.some((x) => x.table === "v2_events" && (x.v as { customer_id?: string }).customer_id === "cust1"));
});

Deno.test("B1: gleiche E-Mail, anderes Datum/Adresse/Positionen/Lieferart -> mismatch, nur unbezahlte+nicht stornierte Zeile storniert", async () => {
  for (const changed of [{ desired_date: "2026-12-02" }, { desired_time: "13:00:00" }, { delivery_street: "Andere Str. 5" },
    { is_pickup: true }, { items: [{ id: "b", quantity: 12 }] }]) {
    const f = fake({ lookups: [row(changed)] });
    assertEquals(await run(f), { status: "conflict", reason: "mismatch" }, JSON.stringify(changed));
    assertEquals(f.log.updates.length, 1);
    assertEquals(f.log.updates[0].v, { status: "cancelled" });
    assertEquals(f.log.updates[0].filters, [["eq", "id", "row1"], ["neq", "payment_status", "paid"], ["neq", "status", "cancelled"]]);
    assertEquals(f.log.rpcs, []);
  }
});

Deno.test("A1: andere E-Mail = fremde Bestellung -> NICHTS anfassen (kein Storno, kein Update), nur Konflikt", async () => {
  const f = fake({ lookups: [row({ customer_email: "fremd@example.com", desired_date: "2026-12-09" })] });
  assertEquals(await run(f), { status: "conflict", reason: "foreign" });
  assertEquals(f.log.updates, []);
  assertEquals(f.log.rpcs, []);
});

Deno.test("A1: Storno trifft 0 Zeilen (inzwischen bezahlt/storniert) -> neu bewerten, nichts freigeben", async () => {
  const paidNow = fake({ lookups: [row({ desired_date: "2026-12-09" }), row({ payment_status: "paid" })], updateRows: [] });
  assertEquals(await run(paidNow), { status: "conflict", reason: "paid" });
  const other = fake({ lookups: [row({ desired_date: "2026-12-09" }), row({ desired_date: "2026-12-09" })], updateRows: [] });
  assertEquals(await run(other), { status: "conflict", reason: "race" });
});

Deno.test("bezahlte Zeile wird nie angefasst", async () => {
  const f = fake({ lookups: [row({ payment_status: "paid" })] });
  assertEquals(await run(f), { status: "conflict", reason: "paid" });
  assertEquals(f.log.updates, []);
});

Deno.test("B2: Race (UNIQUE 23505), Gewinner passt -> resumed, kein Storno", async () => {
  const f = fake({ lookups: [null, row()], rpcError: { code: "23505", message: "duplicate key value violates unique constraint" } });
  assertEquals(await run(f), { status: "resumed", orderId: "row1" });
  assert(!f.log.updates.some((x) => (x.v as { status?: string }).status === "cancelled"));
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


Deno.test("Kundensuche: Wildcards in Name/E-Mail wirken nie als Muster (exakt, escaped); * = keine Suche", async () => {
  assertEquals(exactIlikePattern("max%@%.%"), "max\\%@\\%.\\%");
  assertEquals(exactIlikePattern("a_b\\c"), "a\\_b\\\\c");
  assertEquals(exactIlikePattern("a*b"), null);
  const f = fake({ lookups: [row({ customer_email: "max_x@example.com" })] });
  await run(f, quote, { ...input, customer: { ...input.customer, name: "%", email: "max_x@example.com" } });
  assertEquals(f.log.ilikes, [["email", "max\\_x@example.com"], ["name", "\\%"]]);
  // Stern im Namen: gar nicht suchen
  const g = fake({ lookups: [row()] }); // E-Mail unverändert
  await run(g, quote, { ...input, customer: { ...input.customer, name: "A*" } });
  assertEquals(g.log.ilikes, []);
});
