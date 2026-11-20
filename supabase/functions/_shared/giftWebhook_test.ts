// Regression: der Geschenkkorb-Zweig darf KEINE bestehende Session (Catering, Voucher, Event, Maestro, Restzahlung ...) fangen.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { isGiftSessionMetadata } from "./giftWebhook.ts";

const existing: Record<string, string>[] = [
  { order_type: "catering", order_number: "CAT-1" },
  { order_type: "voucher", voucher_id: "v1", language: "de" },
  { order_type: "event", order_number: "EVT-1" },
  { option_id: "o", inquiry_id: "i" },
  { option_quantities: "{}", inquiry_id: "i" },
  { payment_id: "p", source: "maestro" },
  { kind: "prepayment_per_person", event_id: "e" },
  { balance_link_slug: "abc" },
  {},
];

Deno.test("Geschenkkorb-Erkennung trifft nur gift_basket mit gift_order_id", () => {
  for (const md of existing) assertEquals(isGiftSessionMetadata(md), false);
  assertEquals(isGiftSessionMetadata(undefined), false);
  assertEquals(isGiftSessionMetadata({ order_type: "gift_basket" }), false);
  assertEquals(isGiftSessionMetadata({ order_type: "gift_basket", gift_order_id: "x", order_number: "GK-26-1" }), true);
});
