import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { formatEuroTruncated, formatMixedTotal, giftSubtotalOf } from "../../src/lib/gift/mixedCart.ts";

Deno.test("Mischkorb-Anzeige: Korb-Anteil, Gesamtsumme brutto", () => {
  assertEquals(giftSubtotalOf(299.8, 200.9), 98.9);
  assertEquals(giftSubtotalOf(100, 100), 0);
  assertEquals(formatEuroTruncated(9.999), "9,99 €");
  assertEquals(formatMixedTotal(200, 98.9), "298,90 €");
});
