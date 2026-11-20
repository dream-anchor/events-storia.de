// deno test supabase/functions/_shared/giftPricing_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  berlinToUtc,
  checkSchedule,
  computeDeliveryFeeCents,
  computeVatBreakdown,
  isValidVatSplit,
  MAX_QTY_PER_ORDER,
  parseTariff,
  pickupSlots,
  roundDistanceKm,
  businessDate,
  splitGrossByVat,
  type ScheduleSettings,
} from "./giftPricing.ts";

Deno.test("Taxitarif: exakte Beispiele (Inhaber 20.11.2026, kein Aufrunden)", () => {
  assertEquals(computeDeliveryFeeCents(2.3), 621); // 2,3 * 2,70 = 6,21 EUR
  assertEquals(computeDeliveryFeeCents(2.0), 590); // 5,40 -> Minimum 5,90 EUR
  assertEquals(computeDeliveryFeeCents(7), 1890); // 7 * 2,70 = 18,90 EUR
  assertEquals(computeDeliveryFeeCents(10), 2640); // 18,90 + 3 * 2,50 = 26,40 EUR
});

Deno.test("Taxitarif: Grenzen und Cent-Rundung", () => {
  assertEquals(computeDeliveryFeeCents(0), 590); // Minimum
  assertEquals(computeDeliveryFeeCents(2.185), 590); // 5,8995 -> 5,90
  assertEquals(computeDeliveryFeeCents(2.2), 594); // 5,94
  assertEquals(computeDeliveryFeeCents(7.01), 1893); // 18,90 + 0,025 = 18,925 -> 18,93 (kaufmännisch)
  assertEquals(computeDeliveryFeeCents(7.1), 1915); // 18,90 + 0,25
  assertEquals(computeDeliveryFeeCents(roundDistanceKm(2.3049)), 621);
});

Deno.test("Taxitarif: Tarifwerte aus Daten", () => {
  const t = parseTariff({
    tariff_tiers: [{ from_km: 7, per_km_cents: 250 }, { from_km: 0, per_km_cents: 270 }],
    min_fee_cents: 590,
  });
  assertEquals(computeDeliveryFeeCents(10, t), 2640);
  const flat = parseTariff({ tariff_tiers: [{ from_km: 0, per_km_cents: 100 }], min_fee_cents: 0 });
  assertEquals(computeDeliveryFeeCents(3.2, flat), 320);
});

Deno.test("parseTariff weist kaputte Tarife ab", () => {
  for (const bad of [
    { tariff_tiers: [], min_fee_cents: 590 },
    { tariff_tiers: [{ from_km: 3, per_km_cents: 100 }], min_fee_cents: 590 },
    { tariff_tiers: [{ from_km: 0, per_km_cents: 100 }], min_fee_cents: -1 },
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

// Echte Öffnungszeiten (Inhaber 20.11.2026): Mo-Fr 9:00-1:00 Uhr, Sa-So 12:00-1:00 Uhr (über Mitternacht)
const real: ScheduleSettings = {
  ...settings,
  pickup_hours: {
    "0": { open: "12:00", close: "01:00" }, "1": { open: "09:00", close: "01:00" }, "2": { open: "09:00", close: "01:00" },
    "3": { open: "09:00", close: "01:00" }, "4": { open: "09:00", close: "01:00" }, "5": { open: "09:00", close: "01:00" },
    "6": { open: "12:00", close: "01:00" },
  },
};

Deno.test("Abholung über Mitternacht: Zeiten nach 0:00 gehören zum Geschäftstag", () => {
  assertEquals(checkSchedule("pickup", "2026-11-27", "23:45", NOW, real, []).ok, true);
  assertEquals(checkSchedule("pickup", "2026-11-27", "00:30", NOW, real, []).ok, true);
  assertEquals(checkSchedule("pickup", "2026-11-27", "01:00", NOW, real, []).ok, true);
  assertEquals(checkSchedule("pickup", "2026-11-27", "01:15", NOW, real, []).error, "closed");
  assertEquals(checkSchedule("pickup", "2026-11-27", "08:45", NOW, real, []).error, "closed");
  assertEquals(checkSchedule("pickup", "2026-11-29", "12:00", NOW, real, []).ok, true); // Sonntag offen ab 12
  assertEquals(checkSchedule("pickup", "2026-11-29", "11:45", NOW, real, []).error, "closed");
  // Ladenschluss = 01:00 am Folgetag (MEZ -> 00:00 UTC)
  const c = checkSchedule("pickup", "2026-11-27", "13:00", NOW, real, []);
  assertEquals(c.closing_at?.toISOString(), "2026-11-28T00:00:00.000Z");
});

Deno.test("Abholung über Mitternacht: heute Abend, Packzeit gilt auch nach 0:00", () => {
  // 26.11.2026, 23:50 Berlin = 22:50 UTC: 00:10 (Folgetag) ist zu früh, 00:30 geht
  const late = new Date("2026-11-26T22:50:00Z");
  assertEquals(checkSchedule("pickup", "2026-11-26", "00:10", late, real, []).error, "too_early");
  assertEquals(checkSchedule("pickup", "2026-11-26", "00:30", late, real, []).ok, true);
  assertEquals(checkSchedule("pickup", "2026-11-26", "10:00", late, real, []).error, "too_early");
});

Deno.test("Abholslots über Mitternacht", () => {
  const slots = pickupSlots("2026-11-27", NOW, real, []);
  assertEquals(slots[0], "09:00");
  assertEquals(slots[slots.length - 1], "01:00");
  assert(slots.includes("23:45") && slots.includes("00:00"));
  assertEquals(pickupSlots("2026-11-29", NOW, real, [])[0], "12:00");
});

Deno.test("MwSt.: Aufteilung Inhaber 85 % zu 7 %, 15 % zu 19 % (Wein)", () => {
  const split = [{ rate: 7, share_bp: 8500 }, { rate: 19, share_bp: 1500 }];
  assert(isValidVatSplit(split));
  assertEquals(splitGrossByVat(24900, split), [{ rate: 7, gross_cents: 21165 }, { rate: 19, gross_cents: 3735 }]);
  assertEquals(splitGrossByVat(9900, split), [{ rate: 7, gross_cents: 8415 }, { rate: 19, gross_cents: 1485 }]);
  const b = computeVatBreakdown([{ unit_price_cents: 13900, qty: 1, vat_split: split }], null);
  assertEquals(b!.reduce((s, l) => s + l.gross_cents, 0), 13900);
});

Deno.test("0:00-1:00: Bestellen für den laufenden Geschäftstag (Vortag) bleibt möglich", () => {
  // Fr 27.11.2026, 00:20 Berlin = Do 26.11., 23:20 UTC. Do hat Öffnung 09:00-01:00 -> Geschäftstag ist noch Donnerstag
  const night = new Date("2026-11-26T23:20:00Z");
  assertEquals(businessDate(night, real), "2026-11-26");
  assertEquals(checkSchedule("pickup", "2026-11-26", "00:55", night, real, []).ok, true); // 00:55 am Freitag früh, gehört zu Do
  assertEquals(checkSchedule("pickup", "2026-11-26", "00:30", night, real, []).error, "too_early"); // Packzeit 30 Min
  assertEquals(checkSchedule("pickup", "2026-11-25", "12:00", night, real, []).error, "date_in_past");
  // ab 1:01 ist der Geschäftstag vorbei
  const after = new Date("2026-11-27T00:30:00Z"); // 01:30 Berlin
  assertEquals(businessDate(after, real), "2026-11-27");
  assertEquals(checkSchedule("pickup", "2026-11-26", "00:55", after, real, []).error, "date_in_past");
});

Deno.test("Mengenlimit je Bestellung = 10", () => {
  assertEquals(MAX_QTY_PER_ORDER, 10);
});
