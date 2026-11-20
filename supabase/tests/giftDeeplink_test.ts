// deno test supabase/tests/giftDeeplink_test.ts
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { normalizeKey, parseDeepLink, resolveDeepLink } from "../../src/lib/gift/deeplink.ts";

const baskets = [
  { slug: "dolce-vita", size_key: "klein", variants: [{ id: "v1", key: "bianco-toscana", available: 5 }, { id: "v2", key: "moscato-dasti", available: 0 }] },
  { slug: "gran-selezione", size_key: "gross", variants: [{ id: "v3", key: "cremant-rose", available: 2 }, { id: "v4", key: "cremant-dry", available: 9 }] },
];

Deno.test("Schlüssel werden tolerant normalisiert", () => {
  assertEquals(normalizeKey("Moscato d’Asti"), "moscato-dasti");
  assertEquals(normalizeKey("Crémant Rosé"), "cremant-rose");
  assertEquals(normalizeKey("GROSS"), "gross");
});

Deno.test("Deep-Link: einzelner Posten und pos-Liste", () => {
  assertEquals(parseDeepLink("?korb=klein&wein=bianco-toscana&menge=2"), [{ korb: "klein", wein: "bianco-toscana", menge: 2 }]);
  assertEquals(parseDeepLink("?pos=klein.bianco-toscana.2,gross.cremant-dry.1").length, 2);
  assertEquals(parseDeepLink("?menge=3"), []);
  assertEquals(parseDeepLink("?korb=klein&menge=-4")[0].menge, 1);
  assertEquals(parseDeepLink("?korb=klein&menge=abc")[0].menge, 1);
});

Deno.test("Deep-Link auflösen: Menge gedeckelt, ausverkauft/unbekannt gemeldet, Rest bleibt", () => {
  const r = resolveDeepLink(
    parseDeepLink("?pos=klein.bianco-toscana.20,klein.moscato-dasti.1,gross.cremant-rose.5,xl.foo.1"),
    baskets,
    10,
  );
  assertEquals(r.lines, [{ variantId: "v1", qty: 5 }, { variantId: "v3", qty: 2 }]);
  assertEquals(r.notes.map((n) => n.kind), ["capped", "sold_out", "capped", "unknown_basket"]);
});

Deno.test("Deep-Link ohne Wein wählt erste verfügbare Variante; slug funktioniert", () => {
  const r = resolveDeepLink(parseDeepLink("?korb=dolce-vita&menge=1"), baskets, 10);
  assertEquals(r.lines, [{ variantId: "v1", qty: 1 }]);
});
