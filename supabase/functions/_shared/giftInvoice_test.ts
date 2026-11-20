import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildGiftInvoiceRequest, type GiftInvoiceOrder } from "./giftInvoice.ts";

const order: GiftInvoiceOrder = {
  id: "o1", order_number: "GK-26-00001", customer_name: "A", customer_email: "a@x.de", customer_phone: null,
  handover: "delivery", handover_date: "2026-12-01", handover_time: "vormittag", delivery_street: "Str. 1", delivery_zip: "80333",
  delivery_city: "München", distance_km: 2.1, delivery_fee_cents: 600, delivery_vat_rate: 19, total_cents: 13900 * 2 + 600, gift_message: null,
};
const split = [{ rate: 7, share_bp: 6000 }, { rate: 19, share_bp: 4000 }];

Deno.test("Rechnung: eine Position je Steuersatz, Brutto-Summe stimmt", () => {
  const r = buildGiftInvoiceRequest(order, [{ basket_name: "K", variant_label: "W", qty: 2, unit_price_cents: 13900, vat_split: split }])!;
  const items = r.items as { price: number; quantity: number; taxRatePercentage: number }[];
  assertEquals(items.length, 2);
  assertEquals(items.map((i) => i.taxRatePercentage), [7, 19]);
  const sum = items.reduce((s, i) => s + Math.round(i.price * 100) * i.quantity, 0);
  assertEquals(sum, 13900 * 2);
  assertEquals(r.deliveryCost, 6);
  assertEquals(r.deliveryTaxRatePercentage, 19);
  assertEquals(r.orderType, "gift_basket");
});

Deno.test("Rechnung: ohne Steuer-Aufteilung keine Anfrage", () => {
  assertEquals(buildGiftInvoiceRequest(order, [{ basket_name: "K", variant_label: "W", qty: 1, unit_price_cents: 9900, vat_split: null }]), null);
  assert(buildGiftInvoiceRequest(order, [{ basket_name: "K", variant_label: "W", qty: 1, unit_price_cents: 9900, vat_split: [{ rate: 19, share_bp: 10000 }] }]) !== null);
});

import { isStaleInvoiceClaim } from "./giftInvoice.ts";
Deno.test("Rechnungs-Anspruch: verwaist erst nach 10 Minuten, echte ID nie", () => {
  const now = 1_800_000_000_000;
  assert(isStaleInvoiceClaim("pending", now));
  assert(!isStaleInvoiceClaim(`pending:${now - 5 * 60_000}`, now));
  assert(isStaleInvoiceClaim(`pending:${now - 11 * 60_000}`, now));
  assert(!isStaleInvoiceClaim("a1b2c3d4-real-document-id", now));
});
