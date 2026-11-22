// deno test supabase/tests/orderSchedule_test.ts — Paritätstest: Checkout-Fassung = Server-Fassung
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { checkOrderSchedule as client, SCHEDULE_MESSAGES } from "../../src/lib/orderSchedule.ts";
import { checkOrderSchedule as server } from "../functions/_shared/orderSchedule.ts";
import { ORDER_MESSAGES } from "../functions/_shared/orderQuote.ts";

Deno.test("Termin-Regeln: Client und Server liefern über viele Fälle (Sommer-/Winterzeit, Wochenende, Pizza) dasselbe", () => {
  const nows = ["2026-03-27T08:00:00Z", "2026-07-01T10:00:00Z", "2026-10-24T20:00:00Z", "2026-12-01T10:30:00Z", "2026-12-04T22:59:30Z", "2026-12-04T23:00:30Z"];
  const dates = ["2026-03-28", "2026-03-29", "2026-07-02", "2026-10-25", "2026-12-01", "2026-12-02", "2026-12-05", "2026-12-06", "2027-12-04", "2028-06-10"];
  const times = ["09:00", "10:00", "11:59", "12:00", "14:30", "15:00", "18:00", "22:30", "23:00"];
  let n = 0;
  for (const now of nows) for (const date of dates) for (const time of times) for (const isPickup of [true, false]) for (const isPizzaOnly of [true, false]) for (const kind of ["catering", "event"] as const) {
    const p = { kind, isPickup, isPizzaOnly, date, time };
    assertEquals(client(p, new Date(now)), server(p, new Date(now)), JSON.stringify([p, now]));
    n++;
  }
  assertEquals(n, 6 * 10 * 9 * 2 * 2 * 2);
});

Deno.test("Meldungen identisch (de/en)", () => {
  for (const [k, v] of Object.entries(SCHEDULE_MESSAGES)) assertEquals(v, ORDER_MESSAGES[k as keyof typeof ORDER_MESSAGES]);
});

Deno.test("Wochenende: Catering (Lieferung UND Abholung) Sa/So erst ab 12:00, in Client und Server gleich", () => {
  const now = new Date("2026-11-20T10:00:00Z"); // Freitag; die Daten unten liegen Wochen später, die Do-Frist ist also offen
  for (const date of ["2026-12-12", "2026-12-13"]) { // Sa/So, weit genug entfernt, Frist offen
    for (const isPickup of [true, false]) {
      for (const [time, want] of [["09:00", "schedule_weekend_open"], ["11:59", "schedule_weekend_open"], ["12:00", null], ["12:30", null]] as const) {
        const p = { kind: "catering" as const, isPickup, isPizzaOnly: false, date, time };
        assertEquals(client(p, now), want, JSON.stringify(p));
        assertEquals(server(p, now), want, JSON.stringify(p));
      }
    }
  }
  // Werktag und Event bleiben unberührt
  const mon = { kind: "catering" as const, isPickup: true, isPizzaOnly: false, date: "2026-12-14", time: "09:00" };
  assertEquals(client(mon, now), null);
  assertEquals(server(mon, now), null);
  const evt = { kind: "event" as const, isPickup: false, isPizzaOnly: false, date: "2026-12-12", time: "09:00" };
  assertEquals(client(evt, now), null);
  assertEquals(server(evt, now), null);
});

Deno.test("Kein Enddatum: Catering und Pizza weit im Voraus ok, nur das Sicherheitslimit (730 Tage) greift", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  for (const isPizzaOnly of [true, false]) {
    for (const [date, want] of [["2026-11-23", null], ["2026-12-22", null], ["2027-11-22", null], ["2028-11-21", null], ["2028-11-22", "schedule_too_far"], ["2028-11-23", "schedule_too_far"], ["2030-01-01", "schedule_too_far"]] as const) {
      // 2028-11-21 = heute + 730 Tage (Schaltjahr 2028), Dienstag; 12:00 liegt im Pizza-Fenster
      const p = { kind: "catering" as const, isPickup: true, isPizzaOnly, date, time: "12:00" };
      assertEquals(client(p, now), want, JSON.stringify(p));
      assertEquals(server(p, now), want, JSON.stringify(p));
    }
  }
  // Pizza in 30 Minuten (zu kurzfristig) und in 365 Tagen (ok)
  const pizza = (date: string, time: string) => ({ kind: "catering" as const, isPickup: false, isPizzaOnly: true, date, time });
  const n30 = new Date("2026-11-23T10:00:00Z"); // Mo 11:00 Berlin
  assertEquals(client(pizza("2026-11-23", "12:00"), new Date("2026-11-23T10:40:00Z")), "schedule_pizza_lead_time"); // 11:40 -> 12:00 in 20 min
  assertEquals(server(pizza("2026-11-23", "12:00"), new Date("2026-11-23T10:40:00Z")), "schedule_pizza_lead_time");
  assertEquals(client(pizza("2026-11-23", "12:00"), n30), null);
  assertEquals(server(pizza("2026-11-23", "12:00"), n30), null);
  assertEquals(client(pizza("2027-11-22", "19:00"), now), null); // Montag in 365 Tagen
  assertEquals(server(pizza("2027-11-22", "19:00"), now), null);
});
