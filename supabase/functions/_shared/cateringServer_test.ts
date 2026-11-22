// deno test supabase/functions/_shared/cateringServer_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { CATALOG_TENANT_ID, computeServerQuote } from "./cateringServer.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_PKG = "22222222-2222-4222-8222-222222222222";

/** Minimaler Supabase-Ersatz: Tabellen als Zeilenlisten; .or()-Aufrufe werden protokolliert (Mandantenbindung). */
function fakeSupabase(tables: Record<string, Record<string, unknown>[]>) {
  const orCalls: Record<string, string[]> = {};
  const client = {
    from(table: string) {
      let rows = tables[table] ?? [];
      const q = {
        select: () => q,
        or: (f: string) => { (orCalls[table] ??= []).push(f); return q; },
        in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return q; },
        eq: (col: string, v: unknown) => { rows = rows.filter((r) => r[col] === v); return q; },
        is: (col: string, v: unknown) => { rows = rows.filter((r) => (r[col] ?? null) === v); return q; },
        then: (res: (v: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
      };
      return q;
    },
  };
  return { client, orCalls };
}

const catalogTables = () => ({
  menu_items: [{ id: UUID_A, name: "Lasagne", name_en: "Lasagna", price: 30, category_id: "c1", deleted_at: null, archived_at: null }],
  menu_categories: [{ id: "c1", menu_id: "m1", deleted_at: null, archived_at: null }],
  menus: [{ id: "m1", slug: "buffet-platten", menu_type: "catering", is_published: true }],
  packages: [{ id: UUID_PKG, name: "Pro Person", name_en: null, price: 50, price_per_person: true, is_active: true, min_guests: 10, max_guests: 50 }],
});

const orsFetch = (meters: number | null): typeof fetch => (async (url: string | URL | Request) => {
  const u = String(url);
  if (u.includes("geocode")) return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [11.6, 48.2] } }] }));
  if (meters === null) return new Response("{}", { status: 500 });
  return new Response(JSON.stringify({ routes: [{ summary: { distance: meters } }] }));
}) as typeof fetch;

Deno.test("Lieferung: Entfernung wird am Server per Routing berechnet, Katalog/Menüs sind mandantengebunden", async () => {
  const { client, orCalls } = fakeSupabase(catalogTables());
  const r = await computeServerQuote(client, {
    items: [{ id: UUID_A, quantity: 12, price: 1 }], chafingQuantity: 0, deliveryType: "delivery",
    address: { street: "Teststr. 1", zip: "80333", city: "München" },
  }, "key", orsFetch(12340));
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.quote.delivery?.oneWayDistanceKm, 12.34);
  assertEquals(r.quote.deliveryCents, 15425);
  assertEquals(r.quote.totalCents, 36000 + 15425); // Browserpreis 1 spielt keine Rolle
  for (const t of ["menu_items", "menu_categories", "menus"]) {
    assertEquals(orCalls[t], [`tenant_id.eq.${CATALOG_TENANT_ID},tenant_id.is.null`], `Mandantenfilter auf ${t}`);
  }
});

Deno.test("Routing-Ausfall: delivery_unverifiable statt geratenem Preis", async () => {
  const { client } = fakeSupabase(catalogTables());
  const r = await computeServerQuote(client, {
    items: [{ id: UUID_A, quantity: 12 }], chafingQuantity: 0, deliveryType: "delivery", address: { street: "Teststr. 1", zip: "80333", city: "München" },
  }, "key", orsFetch(null));
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "delivery_unverifiable");
});

Deno.test("Lieferung ohne vollständige Adresse: address_missing", async () => {
  const { client } = fakeSupabase(catalogTables());
  const r = await computeServerQuote(client, { items: [{ id: UUID_A, quantity: 12 }], chafingQuantity: 0, deliveryType: "delivery", address: { street: "", zip: "80333", city: "" } }, "key", orsFetch(1000));
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "address_missing");
});

Deno.test("Abholung braucht kein Routing", async () => {
  const { client } = fakeSupabase(catalogTables());
  const r = await computeServerQuote(client, { items: [{ id: UUID_A, quantity: 12 }], chafingQuantity: 0, deliveryType: "pickup" }, undefined, orsFetch(null));
  assert(r.ok);
  if (r.ok) assertEquals(r.quote.totalCents, 36000);
});

Deno.test("Event-Pakete: mandantengebunden, Gästegrenzen aus dem Paket", async () => {
  const { client, orCalls } = fakeSupabase(catalogTables());
  const okQ = await computeServerQuote(client, { items: [{ id: `event-${UUID_PKG}`, quantity: 20 }], chafingQuantity: 0, deliveryType: "event" }, undefined);
  assert(okQ.ok);
  if (okQ.ok) assertEquals(okQ.quote.totalCents, 100000);
  assertEquals(orCalls["packages"], [`tenant_id.eq.${CATALOG_TENANT_ID},tenant_id.is.null`]);
  const low = await computeServerQuote(client, { items: [{ id: `event-${UUID_PKG}`, quantity: 5 }], chafingQuantity: 0, deliveryType: "event" }, undefined);
  assert(low.ok);
  if (low.ok) assertEquals(low.quote.issues.map((i) => i.code), ["guests_out_of_range"]);
});
