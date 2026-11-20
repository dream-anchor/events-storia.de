import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { checkFormTiming, confirmUrl, generateConfirmToken, hashConfirmToken, isConfirmToken, safeShortName } from "./giftConfirm.ts";

Deno.test("Token: 64 Hex, einmalig, Hash ist SHA-256 und nicht das Token", async () => {
  const a = generateConfirmToken();
  const b = generateConfirmToken();
  assert(isConfirmToken(a));
  assertNotEquals(a, b);
  const h = await hashConfirmToken(a);
  assertEquals(h.length, 64);
  assertNotEquals(h, a);
  assertEquals(await hashConfirmToken(a), h);
  assert(!isConfirmToken("abc") && !isConfirmToken(null));
});

Deno.test("Link: DE ohne, EN mit /en-Präfix", () => {
  assertEquals(confirmUrl("https://www.events-storia.de", "de", "x"), "https://www.events-storia.de/geschenkkoerbe/bestaetigen?t=x");
  assertEquals(confirmUrl("https://www.events-storia.de", "en", "x"), "https://www.events-storia.de/en/geschenkkoerbe/bestaetigen?t=x");
});

Deno.test("Formular-Zeitstempel: zu schnell, ok, Zukunft, zu alt", () => {
  const now = 1_800_000_000_000;
  assertEquals(checkFormTiming(now - 1000, now), "too_fast");
  assertEquals(checkFormTiming(now - 3000, now), "ok");
  assertEquals(checkFormTiming(now - 60_000, now), "ok");
  assertEquals(checkFormTiming(now + 120_000, now), "invalid");
  assertEquals(checkFormTiming(now - 25 * 3600_000, now), "invalid");
  assertEquals(checkFormTiming(undefined, now), "invalid");
  assertEquals(checkFormTiming("abc", now), "invalid");
});

Deno.test("Anzeigename: gekürzt, keine Links/Sonderzeichen (kein Spam-Relais)", () => {
  assertEquals(safeShortName("Anna Müller"), "Anna Müller");
  const spam = safeShortName("Visit http://evil.example/win NOW!!! free money");
  assert(spam.length <= 20 && !/[:\/!@<>]/.test(spam));
  assert(safeShortName("<b>x</b>@a.de").indexOf("<") < 0);
  assert(safeShortName("A".repeat(100)).length <= 20);
});
