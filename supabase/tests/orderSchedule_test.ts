// deno test supabase/tests/orderSchedule_test.ts — Paritätstest: Checkout-Fassung = Server-Fassung
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { checkOrderSchedule as client, SCHEDULE_MESSAGES } from "../../src/lib/orderSchedule.ts";
import { checkOrderSchedule as server } from "../functions/_shared/orderSchedule.ts";
import { ORDER_MESSAGES } from "../functions/_shared/orderQuote.ts";

Deno.test("Termin-Regeln: Client und Server liefern über viele Fälle (Sommer-/Winterzeit, Wochenende, Pizza) dasselbe", () => {
  const nows = ["2026-03-27T08:00:00Z", "2026-07-01T10:00:00Z", "2026-10-24T20:00:00Z", "2026-12-01T10:30:00Z", "2026-12-04T22:59:30Z", "2026-12-04T23:00:30Z"];
  const dates = ["2026-03-28", "2026-03-29", "2026-07-02", "2026-10-25", "2026-12-01", "2026-12-02", "2026-12-05", "2026-12-06"];
  const times = ["10:00", "12:00", "14:30", "15:00", "18:00", "22:30", "23:00"];
  let n = 0;
  for (const now of nows) for (const date of dates) for (const time of times) for (const isPickup of [true, false]) for (const isPizzaOnly of [true, false]) for (const kind of ["catering", "event"] as const) {
    const p = { kind, isPickup, isPizzaOnly, date, time };
    assertEquals(client(p, new Date(now)), server(p, new Date(now)), JSON.stringify([p, now]));
    n++;
  }
  assertEquals(n, 6 * 8 * 7 * 2 * 2 * 2);
});

Deno.test("Meldungen identisch (de/en)", () => {
  for (const [k, v] of Object.entries(SCHEDULE_MESSAGES)) assertEquals(v, ORDER_MESSAGES[k as keyof typeof ORDER_MESSAGES]);
});
