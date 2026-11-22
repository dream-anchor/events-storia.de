// Tests für die Shop-Felder des MAESTRO-Handoffs (Einheit M5): Payload je Art, null/leer weggelassen,
// Grenzen (50 Positionen, Längen, Body-Budget), Determinismus, Lesefehler -> Altpayload.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  buildOrderPayload,
  loadShopFields,
  SHOP_BODY_BUDGET_BYTES,
  SHOP_MAX_LINES,
  shopFieldsFromCatering,
  shopFieldsFromGift,
  shopFieldsFromVoucher,
} from "./maestroHandoff.ts";

const base = {
  deliveryEventId: "order_X_cs_1",
  sourceOrderId: "X",
  orderNumber: "X",
  customerName: "Test",
  customerEmail: "t@example.com",
  amountTotalCents: 10000,
};
const noNulls = (v: unknown): boolean => {
  if (v === null) return false;
  if (Array.isArray(v)) return v.every(noNulls);
  if (typeof v === "object" && v) return Object.values(v).every((x) => x !== null && noNulls(x));
  return true;
};

const cateringRow = {
  items: [
    { id: "a", name: "Pizza Margherita", quantity: 10, price: 12.5 },
    { id: "b", name: "Tiramisu", quantity: 3, price: 4.9, taxRatePercentage: 19 },
  ],
  is_pickup: false, desired_date: "2026-12-20", desired_time: "12:30:00",
  delivery_address: null, delivery_street: "Karlstr. 47a", delivery_zip: "80333", delivery_city: "München",
  delivery_floor: null, has_elevator: null, delivery_cost: 15.5, minimum_order_surcharge: 0,
};
const giftOrder = {
  handover: "delivery", handover_date: "2026-12-23", handover_time: "14:00-16:00",
  delivery_street: "Hauptstr. 1", delivery_zip: "80331", delivery_city: "München", delivery_note: "Klingeln bei Müller",
  delivery_fee_cents: 990, gift_message: "Frohe Weihnachten!", age_confirmed_at: "2026-12-01T10:00:00Z",
};
const giftItems = [{ basket_name: "Korb Klassik", variant_label: "Rotwein", qty: 2, unit_price_cents: 9900 }];

Deno.test("Altpayload ohne shop: keine neuen Felder", () => {
  const p = buildOrderPayload(base);
  assertEquals(Object.keys(p).sort(), ["amountTotalCents", "customerEmail", "customerName", "deliveryEventId", "orderNumber", "sourceOrderId", "sourceSystem"]);
  assertEquals(buildOrderPayload({ ...base, shop: null }), p);
});

Deno.test("Catering: Positionen, Lieferung, Termin, Adresse, Gebühr", () => {
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromCatering(cateringRow, null, "paid") });
  assertEquals(p.orderKind, "catering");
  assertEquals(p.lines, [
    { name: "Pizza Margherita", qty: 10, unitCents: 1250, vatRate: 7 },
    { name: "Tiramisu", qty: 3, unitCents: 490, vatRate: 19 },
  ]);
  assertEquals(p.handover, "delivery");
  assertEquals(p.handoverDate, "2026-12-20");
  assertEquals(p.handoverTime, "12:30");
  assertEquals(p.deliveryAddress, { city: "München", street: "Karlstr. 47a", zip: "80333" });
  assertEquals(p.deliveryFeeCents, 1550);
  assertEquals(p.paymentStatus, "paid");
  assertFalse("giftMessage" in p);
  assertFalse("ageConfirmed" in p);
  assert(noNulls(p));
});

Deno.test("Catering Abholung: keine Adresse/Gebühr; Aufschlag als Position", () => {
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromCatering({ ...cateringRow, is_pickup: true, minimum_order_surcharge: 7.5 }, null, "unpaid") });
  assertEquals(p.handover, "pickup");
  assertFalse("deliveryAddress" in p);
  assertFalse("deliveryFeeCents" in p);
  assertEquals(p.lines?.at(-1), { name: "Mindestbestellwert-Aufschlag", qty: 1, unitCents: 750, vatRate: 7 });
  assertEquals(p.paymentStatus, "unpaid");
});

Deno.test("Catering: Freitext-Adresse als String, wenn keine Einzelfelder", () => {
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromCatering({ ...cateringRow, delivery_street: null, delivery_zip: null, delivery_city: null, delivery_address: "Irgendwo 5, 80000 Ort" }, null, "paid") });
  assertEquals(p.deliveryAddress, "Irgendwo 5, 80000 Ort");
});

Deno.test("Gutschein: eine Position, kein Code, keine Übergabe", () => {
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromVoucher({ amount_cents: 5000, message: "Alles Gute", code: "GEHEIM" }, "paid") });
  assertEquals(p.orderKind, "voucher");
  assertEquals(p.lines, [{ name: "Gutschein 50,00 EUR", qty: 1, unitCents: 5000 }]);
  assertEquals(p.giftMessage, "Alles Gute");
  assertFalse("handover" in p);
  assertFalse(JSON.stringify(p).includes("GEHEIM"));
});

Deno.test("Reine Korb-Bestellung: Lieferung, Grußkarte, Altersbestätigung", () => {
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromGift(giftOrder, giftItems, "paid") });
  assertEquals(p.orderKind, "gift_basket");
  assertEquals(p.lines, [{ name: "Korb Klassik", variant: "Geschenkkorb – Rotwein", qty: 2, unitCents: 9900 }]);
  assertEquals(p.handover, "delivery");
  assertEquals(p.handoverDate, "2026-12-23");
  assertEquals(p.handoverTime, "14:00"); // Lieferfenster -> erste Uhrzeit
  assertEquals(p.deliveryAddress, { city: "München", note: "Klingeln bei Müller", street: "Hauptstr. 1", zip: "80331" });
  assertEquals(p.deliveryFeeCents, 990);
  assertEquals(p.giftMessage, "Frohe Weihnachten!");
  assertEquals(p.ageConfirmed, true);
  assert(noNulls(p));
});

Deno.test("Korb Abholung: keine Adresse/Gebühr; unbekannte Zeit und null-Werte fehlen", () => {
  const p = buildOrderPayload({
    ...base,
    shop: shopFieldsFromGift({ ...giftOrder, handover: "pickup", handover_time: "nachmittags", gift_message: null, age_confirmed_at: null }, giftItems, "paid"),
  });
  assertEquals(p.handover, "pickup");
  for (const k of ["deliveryAddress", "deliveryFeeCents", "handoverTime", "giftMessage"]) assertFalse(k in p, k);
  assertEquals(p.ageConfirmed, false);
  assert(noNulls(p));
});

Deno.test("Mischbestellung: orderKind catering, Korb als Zeilen mit variant 'Geschenkkorb …', Gebühr summiert", () => {
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromCatering(cateringRow, { order: giftOrder, items: giftItems }, "paid") });
  assertEquals(p.orderKind, "catering");
  assertEquals(p.lines?.length, 3);
  assertEquals(p.lines?.[2], { name: "Korb Klassik", variant: "Geschenkkorb – Rotwein", qty: 2, unitCents: 9900 });
  assertEquals(p.handoverDate, "2026-12-20"); // Termin des Catering
  assertEquals(p.deliveryFeeCents, 1550 + 990);
  assertEquals(p.giftMessage, "Frohe Weihnachten!");
  assertEquals(p.ageConfirmed, true);
});

Deno.test("Grenzen: max. 50 Positionen, Längen, ungültige Werte entfallen", () => {
  const many = Array.from({ length: 70 }, (_, i) => ({ id: String(i), name: `P${i}`, quantity: 1, price: 1 }));
  const p = buildOrderPayload({ ...base, shop: shopFieldsFromCatering({ ...cateringRow, items: many }, null, "paid") });
  assertEquals(p.lines?.length, SHOP_MAX_LINES);
  assertEquals(p.lines?.[0].name, "P0");

  const long = buildOrderPayload({
    ...base,
    shop: {
      lines: [{ name: "n".repeat(500), variant: "v".repeat(500), qty: 1, unitCents: 1 }],
      giftMessage: "g".repeat(900), paymentStatus: "s".repeat(90),
      handoverDate: "2026-02-30", handoverTime: "25:00",
    },
  });
  assert(long.lines![0].name.length <= 200 && long.lines![0].variant!.length <= 200);
  assertEquals(long.giftMessage?.length, 500);
  assertEquals(long.paymentStatus?.length, 40);
  assertFalse("handoverDate" in long);
  assertFalse("handoverTime" in long);

  const bad = buildOrderPayload({
    ...base,
    shop: { lines: [{ name: "", qty: 1, unitCents: 1 }, { name: "x", qty: 0, unitCents: 1 }, { name: "y", qty: 1, unitCents: -5 }, { name: "z", qty: 1, unitCents: NaN }] },
  });
  assertFalse("lines" in bad);
});

Deno.test("Body-Budget: 50 lange Positionen bleiben unter 20 KB", () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: String(i), name: `${i}-${"ä".repeat(300)}`, quantity: 1, price: 1 }));
  const p = buildOrderPayload({ ...base, message: "m".repeat(4000), shop: shopFieldsFromCatering({ ...cateringRow, items }, { order: giftOrder, items: giftItems }, "paid") });
  const bytes = new TextEncoder().encode(JSON.stringify(p)).byteLength;
  assert(bytes < 20_000, `Body ${bytes} B`);
  assert(p.lines!.length >= 1);
  assert(SHOP_BODY_BUDGET_BYTES < 20_000);
});

Deno.test("Determinismus: gleiche Eingabe -> gleicher Payload, unabhängig von Schlüsselreihenfolge der Adresse", () => {
  const a = buildOrderPayload({ ...base, shop: shopFieldsFromGift(giftOrder, giftItems, "paid") });
  const b = buildOrderPayload({ ...base, shop: shopFieldsFromGift({ ...giftOrder }, [...giftItems], "paid") });
  assertEquals(JSON.stringify(a), JSON.stringify(b));
  const c = buildOrderPayload({ ...base, shop: shopFieldsFromGift(Object.fromEntries(Object.entries(giftOrder).reverse()), giftItems, "paid") });
  assertEquals(JSON.stringify(a), JSON.stringify(c));
});

// ── loadShopFields mit Fake-Supabase ──
// deno-lint-ignore no-explicit-any
function fake(tables: Record<string, { data?: any; error?: { message: string } }>, calls: string[] = []): any {
  return {
    from(t: string) {
      calls.push(t);
      const res = tables[t] ?? { data: null };
      // deno-lint-ignore no-explicit-any
      const q: any = { select: () => q, eq: () => q, order: () => q, maybeSingle: () => Promise.resolve({ data: res.data ?? null, error: res.error ?? null }), then: (f: (v: unknown) => unknown) => Promise.resolve({ data: res.data ?? null, error: res.error ?? null }).then(f) };
      return q;
    },
  };
}

Deno.test("loadShopFields: je order_type die richtige Tabelle", async () => {
  const c1: string[] = [];
  const r1 = await loadShopFields(fake({ catering_orders: { data: cateringRow } }, c1), { order_type: "catering", order_number: "CAT-1" }, "paid");
  assert(r1.ok && r1.fields?.orderKind === "catering");
  assertEquals(c1, ["catering_orders"]);

  const c2: string[] = [];
  const r2 = await loadShopFields(fake({ gift_orders: { data: giftOrder }, gift_order_items: { data: giftItems } }, c2), { order_type: "gift_basket", gift_order_id: "g1" }, "paid");
  assert(r2.ok && r2.fields?.orderKind === "gift_basket" && r2.fields.lines?.length === 1);
  assertEquals(c2, ["gift_orders", "gift_order_items"]);

  const c3: string[] = [];
  const r3 = await loadShopFields(fake({ vouchers: { data: { amount_cents: 2500, message: null } } }, c3), { order_type: "voucher", voucher_id: "v1" }, "paid");
  assert(r3.ok && r3.fields?.orderKind === "voucher");
  assertEquals(c3, ["vouchers"]);

  const c4: string[] = [];
  const r4 = await loadShopFields(fake({}, c4), { order_type: "event", order_number: "E1" }, "paid");
  assertEquals(r4, { ok: true, fields: null });
  assertEquals(c4, []);
});

Deno.test("loadShopFields: Mischbestellung liest zusätzlich gift_orders", async () => {
  const r = await loadShopFields(
    fake({ catering_orders: { data: cateringRow }, gift_orders: { data: giftOrder }, gift_order_items: { data: giftItems } }),
    { order_type: "catering", order_number: "CAT-1", gift_order_id: "g1" }, "paid",
  );
  assert(r.ok && r.fields?.lines?.length === 3);
});

Deno.test("loadShopFields: Lesefehler -> ok:false (Aufrufer sendet Altpayload), wirft nie", async () => {
  const r = await loadShopFields(fake({ catering_orders: { error: { message: "boom" } } }), { order_type: "catering", order_number: "CAT-1" }, "paid");
  assertEquals(r.ok, false);
  const r2 = await loadShopFields(
    fake({ catering_orders: { data: cateringRow }, gift_orders: { data: null } }),
    { order_type: "catering", order_number: "CAT-1", gift_order_id: "g1" }, "paid",
  );
  assertEquals(r2.ok, false);
  const thrower = { from() { throw new Error("netz"); } };
  assertEquals((await loadShopFields(thrower, { order_type: "voucher", voucher_id: "v" }, "paid")).ok, false);
  // Fehlender Datensatz -> Altpayload, kein Fehler
  assertEquals(await loadShopFields(fake({}), { order_type: "catering", order_number: "X" }, "paid"), { ok: true, fields: null });
});

Deno.test("Zahlstatus kommt aus der Session, nicht aus der DB", async () => {
  const r = await loadShopFields(fake({ vouchers: { data: { amount_cents: 100 } } }), { order_type: "voucher", voucher_id: "v" }, "unpaid");
  assert(r.ok && r.fields?.paymentStatus === "unpaid");
});
