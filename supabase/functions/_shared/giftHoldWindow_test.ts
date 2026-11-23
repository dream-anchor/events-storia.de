import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { HOLD_WINDOW_DAYS, isBeyondHoldWindow, stockConflictAlert } from "./giftHoldWindow.ts";

// 15.01.2027 12:00 Berlin (Winterzeit, UTC+1)
const now = new Date("2027-01-15T11:00:00Z");

Deno.test("Fenster: heute, morgen und übermorgen belegen sofort, ab +3 Tagen zurückgestellt", () => {
  assertEquals(HOLD_WINDOW_DAYS, 2);
  assertEquals(isBeyondHoldWindow("2027-01-15", now), false);
  assertEquals(isBeyondHoldWindow("2027-01-16", now), false);
  assertEquals(isBeyondHoldWindow("2027-01-17", now), false);
  assertEquals(isBeyondHoldWindow("2027-01-18", now), true);
  assertEquals(isBeyondHoldWindow("2028-06-01", now), true);
});

Deno.test("Fenster: Berliner Datum, nicht UTC (23:30 UTC ist schon der nächste Berliner Tag)", () => {
  const lateUtc = new Date("2027-01-15T23:30:00Z"); // 16.01. 00:30 Berlin -> Grenze 18.01.
  assertEquals(isBeyondHoldWindow("2027-01-18", lateUtc), false);
  assertEquals(isBeyondHoldWindow("2027-01-19", lateUtc), true);
});

Deno.test("Fenster: Sommerzeit-Wechsel verschiebt die Grenze nicht", () => {
  const dst = new Date("2027-03-26T23:30:00Z"); // 27.03. 00:30 Berlin (vor Umstellung am 28.03.)
  assertEquals(isBeyondHoldWindow("2027-03-29", dst), false);
  assertEquals(isBeyondHoldWindow("2027-03-30", dst), true);
});

Deno.test("Konflikt-Alarm: Sammelmail nennt Bestellnummern und Termine, keinen Kundennamen, maskiert HTML", () => {
  const one = stockConflictAlert([{ order_number: "G-1", handover_date: "2027-01-18" }]);
  assert(one.subject.includes("G-1") && one.subject.includes("2027-01-18"));
  const many = stockConflictAlert([{ order_number: "G-<1>", handover_date: "2027-01-18" }, { order_number: "G-2", handover_date: "2027-01-19" }]);
  assert(many.subject.includes("2 Reservierungen"));
  assert(many.html.includes("G-&lt;1&gt;") && !many.html.includes("G-<1>") && many.html.includes("G-2"));
});
