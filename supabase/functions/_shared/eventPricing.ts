// EVT-Buchungen (Eventpakete) serverseitig nachrechnen (Einheit I3, Teil 2). Reine Funktionen, keine I/O.
// Gespiegelt aus src/lib/eventPricing.ts (calculateEventPackagePrice) und der DB-Prüfung
// supabase/migrations/20261122100000_order_price_guard.sql (order_guard_event_booking) — alle drei müssen gleich rechnen.
// Beträge in Cent.

export const LOCATION_PACKAGE_ID = "b147ea52-9907-445f-9f39-b7ddecbb0ddf"; // "Gesamte Location"
export const LOCATION_BASE_PRICE = 8500;
export const LOCATION_BASE_GUESTS = 70;
export const EVENT_TOLERANCE_CENTS = 1;

export interface EventPackageRow {
  id: string;
  price: number;
  price_per_person: boolean | null;
  is_active: boolean | null;
}

export type EventReject = "invalid_booking" | "unknown_package" | "price_mismatch";

export const EVENT_REJECT_MESSAGES_DE: Readonly<Record<EventReject, string>> = {
  invalid_booking: "Die Buchungsdaten sind unvollständig. Bitte laden Sie die Seite neu und buchen Sie erneut.",
  unknown_package: "Dieses Eventpaket ist nicht mehr verfügbar. Bitte laden Sie die Seite neu.",
  price_mismatch: "Der Preis des Eventpakets hat sich geändert. Bitte laden Sie die Seite neu und buchen Sie erneut.",
};

/** Erwarteter Gesamtbetrag in Cent; Regeln wie src/lib/eventPricing.ts. */
export function expectedEventPackageCents(pkg: Pick<EventPackageRow, "id" | "price" | "price_per_person">, guests: number): number {
  if (pkg.price_per_person) return Math.round(pkg.price * guests * 100);
  if (pkg.id === LOCATION_PACKAGE_ID || pkg.price === LOCATION_BASE_PRICE) {
    const extra = Math.max(0, guests - LOCATION_BASE_GUESTS);
    return Math.round((LOCATION_BASE_PRICE + extra * (LOCATION_BASE_PRICE / LOCATION_BASE_GUESTS)) * 100);
  }
  return Math.round(pkg.price * 100);
}

export type EventVerifyResult =
  | { ok: true; expectedTotalCents: number }
  | { ok: false; code: EventReject; detail: Record<string, unknown> };

export function verifyEventBooking(input: {
  pkg: EventPackageRow | null;
  guests: number | null;
  clientTotalEuro: number;
}): EventVerifyResult {
  const { pkg, guests, clientTotalEuro } = input;
  if (!pkg) return { ok: false, code: "unknown_package", detail: {} };
  if (pkg.is_active === false) return { ok: false, code: "unknown_package", detail: { id: pkg.id, reason: "inactive" } };
  if (!Number.isInteger(guests) || (guests as number) < 1 || !Number.isFinite(clientTotalEuro)) {
    return { ok: false, code: "invalid_booking", detail: { guests } };
  }
  const expected = expectedEventPackageCents(pkg, guests as number);
  const client = Math.round(clientTotalEuro * 100);
  if (Math.abs(client - expected) > EVENT_TOLERANCE_CENTS) {
    return { ok: false, code: "price_mismatch", detail: { clientCents: client, serverCents: expected } };
  }
  return { ok: true, expectedTotalCents: expected };
}
