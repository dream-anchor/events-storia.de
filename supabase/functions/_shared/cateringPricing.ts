// Catering-Preise serverseitig (Einheit I3). Reine Funktionen, keine I/O.
// Vorbild: giftPricing.ts (Körbe rechnen vollständig am Server). Hier wird die Client-Rechnung aus
// src/pages/Checkout.tsx NACHGERECHNET und verglichen; bei Abweichung > 1 Cent wird abgelehnt.
// Alle Beträge in Cent (ganzzahlig). Tarif/Mindestbestellwerte gespiegelt aus calculate-delivery/index.ts.

export const TOLERANCE_CENTS = 1;
export const MAX_LINE_QTY = 10000;
export const CHAFING_DISH_ID = "chafing-dish";
/** Preise von Positionen, die nicht in menu_items stehen (Checkout.tsx CHAFING_DISH.price = 25,00 EUR brutto). */
export const FIXED_ITEM_PRICES_CENTS: Readonly<Record<string, number>> = { [CHAFING_DISH_ID]: 2500 };
export const PIZZA_MENU_SLUG = "pizze-napoletane";

const DELIVERY_VAT_RATE = 0.19;
const NET_BASE_FEE_PER_TRIP = 50;
const NET_PER_KM = 1.2;

export const toCents = (euro: number): number => Math.round(euro * 100);

export interface ClientLine {
  id: string;
  quantity: number;
  /** Einzelpreis in EUR, wie vom Client gesendet */
  price: number;
}

export interface CatalogEntry {
  /** menu_items.price in EUR; null = nicht bepreist */
  price: number | null;
  /** false bei deleted_at/archived_at */
  active: boolean;
  /** Slug des Catering-Menüs (für Pizza-only-Erkennung) */
  menuSlug?: string | null;
}
export type Catalog = Record<string, CatalogEntry>;

export type Reject =
  | "invalid_items"
  | "unknown_item"
  | "item_unavailable"
  | "price_mismatch"
  | "surcharge_mismatch"
  | "delivery_mismatch"
  | "delivery_unverifiable"
  | "total_mismatch";

export const REJECT_MESSAGES_DE: Readonly<Record<Reject, string>> = {
  invalid_items: "Die Bestellpositionen sind ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
  unknown_item: "Eine Position ist nicht mehr im Angebot. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.",
  item_unavailable: "Eine Position ist nicht mehr verfügbar. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.",
  price_mismatch: "Die Preise haben sich geändert. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.",
  surcharge_mismatch: "Der Mindestbestellwert-Aufschlag stimmt nicht. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
  delivery_mismatch: "Die Lieferkosten stimmen nicht. Bitte laden Sie die Seite neu und geben Sie die Adresse erneut ein.",
  delivery_unverifiable: "Die Lieferkosten konnten gerade nicht geprüft werden. Bitte versuchen Sie es in einer Minute erneut.",
  total_mismatch: "Der Gesamtbetrag stimmt nicht. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
};

/** Mindestbestellwert in Cent je Einweg-Entfernung (calculate-delivery: 50 / 150 / 200 EUR). */
export function minimumOrderCents(oneWayKm: number): number {
  if (oneWayKm <= 1) return 5000;
  if (oneWayKm <= 8) return 15000;
  return 20000;
}

/** Liefergebühr brutto in Cent, 1:1 wie calculate-delivery (19 %, Hin- und Rückfahrt außer Pizza-only). */
export function deliveryFeeGrossCents(oneWayKm: number, pizzaOnly: boolean): number {
  if (oneWayKm <= 1) return 0;
  const trips = pizzaOnly ? 1 : 2;
  let net: number;
  if (oneWayKm <= 8) {
    net = NET_BASE_FEE_PER_TRIP * trips;
  } else {
    net = Math.round((NET_BASE_FEE_PER_TRIP * trips + oneWayKm * trips * NET_PER_KM) * 100) / 100;
  }
  return Math.round(net * (1 + DELIVERY_VAT_RATE) * 100);
}

/** Pizza-only wie im Client: alle Positionen stammen aus dem Pizza-Menü (Chafing/unbekannt = nein). */
export function isPizzaOnlyOrder(lines: ClientLine[], catalog: Catalog): boolean {
  return lines.length > 0 && lines.every((l) => catalog[l.id]?.menuSlug === PIZZA_MENU_SLUG);
}

export interface VerifyInput {
  lines: ClientLine[];
  catalog: Catalog;
  isPickup: boolean;
  /** Einweg-Straßenkilometer ab Karlstr. (Server-Geocoding); null = nicht ermittelbar */
  oneWayKm: number | null;
  clientDeliveryEuro: number;
  clientSurchargeEuro: number;
  clientTotalEuro: number;
}

export type VerifyResult =
  | { ok: true; expectedTotalCents: number; itemsCents: number; surchargeCents: number; deliveryCents: number }
  | { ok: false; code: Reject; detail: Record<string, unknown> };

const fail = (code: Reject, detail: Record<string, unknown> = {}): VerifyResult => ({ ok: false, code, detail });

/**
 * Rechnet die Bestellung am Server nach: Positionen aus menu_items bzw. Festpreisen, Liefergebühr aus
 * Entfernung, Mindestbestellwert-Aufschlag, Gesamtsumme. Abweichung > 1 Cent => Ablehnung.
 * Rechnerisch wie Checkout.tsx: grandTotal = Positionen + Aufschlag + Liefergebühr (alles brutto).
 */
export function verifyCateringOrder(input: VerifyInput): VerifyResult {
  const { lines, catalog } = input;
  if (!Array.isArray(lines) || lines.length === 0) return fail("invalid_items", { reason: "empty" });

  let itemsCents = 0;
  let chafingCents = 0;
  for (const l of lines) {
    if (!l || typeof l.id !== "string" || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_LINE_QTY
      || typeof l.price !== "number" || !Number.isFinite(l.price)) {
      return fail("invalid_items", { id: l?.id });
    }
    let unit: number;
    const fixed = FIXED_ITEM_PRICES_CENTS[l.id];
    if (fixed !== undefined) {
      unit = fixed;
    } else {
      const c = catalog[l.id];
      if (!c) return fail("unknown_item", { id: l.id });
      if (!c.active) return fail("item_unavailable", { id: l.id });
      if (c.price === null || !Number.isFinite(c.price)) return fail("item_unavailable", { id: l.id, reason: "no_price" });
      unit = toCents(c.price);
    }
    if (Math.abs(toCents(l.price) - unit) > TOLERANCE_CENTS) {
      return fail("price_mismatch", { id: l.id, clientCents: toCents(l.price), serverCents: unit });
    }
    const line = unit * l.quantity;
    itemsCents += line;
    if (l.id === CHAFING_DISH_ID) chafingCents += line;
  }

  // Liefergebühr + Mindestbestellwert-Aufschlag (nur bei Lieferung; Abholung = beides 0)
  let deliveryCents = 0;
  let surchargeCents = 0;
  const clientDelivery = toCents(input.clientDeliveryEuro);
  const clientSurcharge = toCents(input.clientSurchargeEuro);
  if (input.isPickup) {
    if (clientDelivery > TOLERANCE_CENTS) return fail("delivery_mismatch", { clientCents: clientDelivery, serverCents: 0 });
    if (clientSurcharge > TOLERANCE_CENTS) return fail("surcharge_mismatch", { clientCents: clientSurcharge, serverCents: 0 });
  } else {
    if (input.oneWayKm === null || !Number.isFinite(input.oneWayKm)) return fail("delivery_unverifiable");
    deliveryCents = deliveryFeeGrossCents(input.oneWayKm, isPizzaOnlyOrder(lines, catalog));
    if (Math.abs(clientDelivery - deliveryCents) > TOLERANCE_CENTS) {
      return fail("delivery_mismatch", { clientCents: clientDelivery, serverCents: deliveryCents });
    }
    // Der Client rechnet den Aufschlag auf Warenkorb OHNE das im Checkout zugewählte Chafing-Dish-Leihgerät.
    // Gespeichert wird nicht, ob die Chafing-Zeile aus dem Warenkorb oder dem Checkout stammt -> beide Basen gelten.
    const min = minimumOrderCents(input.oneWayKm);
    const withChafing = Math.max(0, min - itemsCents);
    const withoutChafing = Math.max(0, min - (itemsCents - chafingCents));
    const ok = [withChafing, withoutChafing].some((s) => Math.abs(clientSurcharge - s) <= TOLERANCE_CENTS);
    if (!ok) return fail("surcharge_mismatch", { clientCents: clientSurcharge, serverCents: [withChafing, withoutChafing] });
    surchargeCents = clientSurcharge; // geprüft, gehört zur erlaubten Menge
  }

  const expectedTotalCents = itemsCents + surchargeCents + deliveryCents;
  const clientTotal = toCents(input.clientTotalEuro);
  if (Math.abs(clientTotal - expectedTotalCents) > TOLERANCE_CENTS) {
    return fail("total_mismatch", { clientCents: clientTotal, serverCents: expectedTotalCents });
  }
  return { ok: true, expectedTotalCents, itemsCents, surchargeCents, deliveryCents };
}
