import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { LOCATION_PACKAGE_ID, expectedEventPackageCents, verifyEventBooking, type EventPackageRow } from "./eventPricing.ts";

const perPerson: EventPackageRow = { id: "p1", price: 50, price_per_person: true, is_active: true };
const flat: EventPackageRow = { id: "p2", price: 500, price_per_person: false, is_active: true };
const location: EventPackageRow = { id: LOCATION_PACKAGE_ID, price: 8500, price_per_person: false, is_active: true };

Deno.test("Event: pro Person = Preis x Gäste", () => {
  assertEquals(expectedEventPackageCents(perPerson, 20), 100000);
});
Deno.test("Event: Pauschale unabhängig von Gästen", () => {
  assertEquals(expectedEventPackageCents(flat, 5), 50000);
  assertEquals(expectedEventPackageCents(flat, 80), 50000);
});
Deno.test("Event: Gesamte Location gestaffelt (bis 70 Gäste 8500, danach 121,43 je Gast)", () => {
  assertEquals(expectedEventPackageCents(location, 60), 850000);
  assertEquals(expectedEventPackageCents(location, 70), 850000);
  assertEquals(expectedEventPackageCents(location, 80), 971429);
  // Erkennung auch ueber den Preis 8500 (wie src/lib/eventPricing.ts isLocationPackage)
  assertEquals(expectedEventPackageCents({ ...location, id: "anders" }, 80), 971429);
});
Deno.test("Event: korrekter Betrag wird akzeptiert, +-1 Cent ok", () => {
  assertEquals(verifyEventBooking({ pkg: perPerson, guests: 20, clientTotalEuro: 1000 }).ok, true);
  assertEquals(verifyEventBooking({ pkg: perPerson, guests: 20, clientTotalEuro: 1000.01 }).ok, true);
  assertEquals(verifyEventBooking({ pkg: location, guests: 80, clientTotalEuro: 9714.29 }).ok, true);
});
Deno.test("Event: manipulierter Betrag wird abgelehnt", () => {
  const r = verifyEventBooking({ pkg: perPerson, guests: 20, clientTotalEuro: 100 });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "price_mismatch");
  assertEquals(verifyEventBooking({ pkg: perPerson, guests: 20, clientTotalEuro: 1000.02 }).ok, false);
  assertEquals(verifyEventBooking({ pkg: location, guests: 80, clientTotalEuro: 8500 }).ok, false);
});
Deno.test("Event: unbekanntes/inaktives Paket und ungueltige Gaestezahl", () => {
  const a = verifyEventBooking({ pkg: null, guests: 10, clientTotalEuro: 100 });
  assertEquals(!a.ok && a.code, "unknown_package");
  const b = verifyEventBooking({ pkg: { ...flat, is_active: false }, guests: 10, clientTotalEuro: 500 });
  assertEquals(!b.ok && b.code, "unknown_package");
  const c = verifyEventBooking({ pkg: flat, guests: 0, clientTotalEuro: 500 });
  assertEquals(!c.ok && c.code, "invalid_booking");
  const d = verifyEventBooking({ pkg: flat, guests: 2.5, clientTotalEuro: 500 });
  assertEquals(!d.ok && d.code, "invalid_booking");
});
