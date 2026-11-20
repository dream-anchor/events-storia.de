// deno test supabase/functions/_shared/giftPricing_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  berlinToUtc,
  checkSchedule,
  computeDeliveryFeeCents,
  computeVatBreakdown,
  isValidVatSplit,
  parseTariff,
  pickupSlots,
  splitGrossByVat,
  type ScheduleSettings,
} from "./giftPricing.ts";

Deno.test("Taxitarif: Beispiele aus dem Bauplan", () => {
  assertEquals(computeDeliveryFeeCents(2), 600); // 5,40 -> Minimum 5,90 -> 6 EUR
  assertEquals(computeDeliveryFeeCents(7), 1900); // 18,90 -> 19 EUR
  assertEquals(computeDeliveryFeeCents(10), 2700); // 18,90 + 7,50 = 26,40 -> 27 EUR (anteilig, nicht 25)
});

Deno.test("Taxitarif: Grenzen und Rundung", () => {
  assertEquals(computeDeliveryFeeCents(0), 600); // Minimum 5,90 -> 6
  assertEquals(computeDeliveryFeeCents(2.185), 600); // 5,90 genau -> 6
  assertEquals(computeDeliveryFeeCents(2.2), 600); // 5,94 -> 6
  assertEquals(computeDeliveryFeeCents(7.01), 1900); // 18,90 + 0,025 -> 19
});

Deno.test("Taxitarif: aufrunden statt runden", () => {
  // 7,1 km: 1890 + 0,1*250 = 1915 -> aufgerundet 2000
  assertEquals(computeDeliveryFeeCents(7.1), 2000);
});

Deno.test("Taxitarif: Tarifwerte aus Daten", () => {
  const t = parseTariff({
    tariff_tiers: [{ from_km: 7, per_km_cents: 250 }, { from_km: 0, per_km_cents: 270 }],
    min_fee_cents: 590,
    round_up_to_cents: 100,
  });
  assertEquals(computeDeliveryFeeCents(10, t), 2700);
  const flat = parseTariff({ tariff_tiers: [{ from_km: 0, per_km_cents: 100 }], min_fee_cents: 0, round_up_to_cents: 50 });
  assertEquals(computeDeliveryFeeCents(3.2, flat), 350);
});

Deno.test("parseTariff weist kaputte Tarife ab", () => {
  for (const bad of [
    { tariff_tiers: [], min_fee_cents: 590, round_up_to_cents: 100 },
    { tariff_tiers: [{ from_km: 3, per_km_cents: 100 }], min_fee_cents: 590, round_up_to_cents: 100 },
    { tariff_tiers: [{ from_km: 0, per_km_cents: 100 }], min_fee_cents: -1, round_up_to_cents: 100 },
    { tariff_tiers: [{ from_km: 0, per_km_cents: 100 }], min_fee_cents: 590, round_up_to_cents: 0 },
  ]) {
    let threw = false;
    try { parseTariff(bad); } catch { threw = true; }
    assert(threw);
  }
});

Deno.test("MwSt.: Aufteilung summiert exakt, Aufschlüsselung", () => {
  const split = [{ rate: 7, share_bp: 6000 }, { rate: 19, share_bp: 4000 }];
  assert(isValidVatSplit(split));
  assert(!isValidVatSplit([{ rate: 7, share_bp: 5000 }]));
  const parts = splitGrossByVat(13900, split);
  assertEquals(parts.reduce((s, p) => s + p.gross_cents, 0), 13900);
  const b = computeVatBreakdown([{ unit_price_cents: 9900, qty: 2, vat_split: split }], { fee_cents: 1900, vat_rate: 19 });
  assert(b !== null);
  assertEquals(b!.reduce((s, l) => s + l.gross_cents, 0), 9900 * 2 + 1900);
  for (const l of b!) assertEquals(l.net_cents + l.vat_cents, l.gross_cents);
  assertEquals(computeVatBreakdown([{ unit_price_cents: 9900, qty: 1, vat_split: null }], null), null);
});

const settings: ScheduleSettings = {
  pickup_hours: {
    "1": { open: "09:00", close: "22:00" }, "2": { open: "09:00", close: "22:00" }, "3": { open: "09:00", close: "22:00" },
    "4": { open: "09:00", close: "22:00" }, "5": { open: "09:00", close: "22:00" }, "6": { open: "12:00", close: "22:00" },
  }, // Sonntag fehlt = zu
  pickup_lead_minutes: 30,
  delivery_lead_days: 1,
  delivery_windows: [{ key: "vormittag", label_de: "V", label_en: "M" }],
};
// Donnerstag 26.11.2026, 10:00 Berlin (UTC+1) = 09:00 UTC
const NOW = new Date("2026-11-26T09:00:00Z");

Deno.test("Termin Abholung: sofort bei Vorrat, Packzeit, Öffnungszeiten", () => {
  assertEquals(checkSchedule("pickup", "2026-11-26", "10:30", NOW, settings, []).ok, true);
  assertEquals(checkSchedule("pickup", "2026-11-26", "10:15", NOW, settings, []).error, "too_early");
  assertEquals(checkSchedule("pickup", "2026-11-26", "22:30", NOW, settings, []).error, "closed");
  assertEquals(checkSchedule("pickup", "2026-11-29", "13:00", NOW, settings, []).error, "closed"); // Sonntag
  assertEquals(checkSchedule("pickup", "2026-11-25", "13:00", NOW, settings, []).error, "date_in_past");
  assertEquals(checkSchedule("pickup", "2026-11-27", "13:00", NOW, settings, [{ date: "2026-11-27", handover: "pickup" }]).error, "blackout");
  assertEquals(checkSchedule("pickup", "2026-11-27", "13:00", NOW, settings, [{ date: "2026-11-27", handover: "delivery" }]).ok, true);
  assertEquals(checkSchedule("pickup", "2026-11-27", "x", NOW, settings, []).error, "invalid_time");
  assertEquals(checkSchedule("pickup", "2026-02-30", "13:00", NOW, settings, []).error, "invalid_date");
});

Deno.test("Termin Lieferung: ab Folgetag, Fenster, Sperrtag", () => {
  assertEquals(checkSchedule("delivery", "2026-11-26", "vormittag", NOW, settings, []).error, "lead_time");
  assertEquals(checkSchedule("delivery", "2026-11-27", "vormittag", NOW, settings, []).ok, true);
  assertEquals(checkSchedule("delivery", "2026-11-27", "nachts", NOW, settings, []).error, "invalid_window");
  assertEquals(checkSchedule("delivery", "2026-11-27", "vormittag", NOW, settings, [{ date: "2026-11-27", handover: "both" }]).error, "blackout");
});

Deno.test("Ladenschluss-Instant (Sommer-/Winterzeit)", () => {
  assertEquals(berlinToUtc("2026-11-26", "22:00").toISOString(), "2026-11-26T21:00:00.000Z"); // MEZ
  assertEquals(berlinToUtc("2026-07-15", "22:00").toISOString(), "2026-07-15T20:00:00.000Z"); // MESZ
  const c = checkSchedule("pickup", "2026-11-27", "13:00", NOW, settings, []);
  assertEquals(c.closing_at?.toISOString(), "2026-11-27T21:00:00.000Z");
});

Deno.test("Abholslots: heute erst ab Jetzt + Packzeit", () => {
  const slots = pickupSlots("2026-11-26", NOW, settings, []);
  assertEquals(slots[0], "10:30");
  assertEquals(slots[slots.length - 1], "22:00");
  assertEquals(pickupSlots("2026-11-29", NOW, settings, []), []);
});
