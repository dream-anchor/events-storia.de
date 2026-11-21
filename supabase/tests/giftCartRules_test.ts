// deno test supabase/tests/giftCartRules_test.ts
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { giftItemId, giftMaxForLine, giftQuantityTotal, nextGiftQuantity } from "../../src/lib/gift/cartRules.ts";

const g = (id: string, quantity: number) => ({ id: giftItemId(id), kind: "gift_basket" as const, quantity });
const c = (id: string, quantity: number) => ({ id, quantity });

Deno.test("Korb-ID und Summe ignorieren Catering-Zeilen", () => {
  assertEquals(giftItemId("v1"), "gift-v1");
  assertEquals(giftQuantityTotal([g("a", 2), c("pizza", 12), g("b", 3)]), 5);
});

Deno.test("add addiert, set setzt (Deep-Link-Fehler Menge 2)", () => {
  const items = [g("a", 1)];
  assertEquals(nextGiftQuantity(items, "gift-a", 1, "add"), { quantity: 2, capped: false });
  assertEquals(nextGiftQuantity(items, "gift-a", 1, "set"), { quantity: 1, capped: false });
});

Deno.test("Deckel je Zeile und je Bestellung", () => {
  assertEquals(nextGiftQuantity([], "gift-a", 99, "set"), { quantity: 10, capped: true });
  const items = [g("a", 7)];
  assertEquals(giftMaxForLine(items, "gift-b"), 3);
  assertEquals(nextGiftQuantity(items, "gift-b", 5, "add"), { quantity: 3, capped: true });
  assertEquals(giftMaxForLine(items, "gift-a"), 10);
  assertEquals(nextGiftQuantity([g("a", 10)], "gift-b", 1, "add"), { quantity: 0, capped: true });
});

Deno.test("Catering-Zeilen zählen nicht gegen den Korb-Deckel", () => {
  assertEquals(giftMaxForLine([c("pizza", 40)], "gift-a"), 10);
});
