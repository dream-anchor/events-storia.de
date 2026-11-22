// Catering-Preise serverseitig (Einheit I3). Reine Funktionen, keine I/O.
// Vorbild: giftPricing.ts (Körbe rechnen vollständig am Server). Hier wird die Client-Rechnung aus
// src/pages/Checkout.tsx NACHGERECHNET und verglichen; bei Abweichung > 1 Cent wird abgelehnt.
// Alle Beträge in Cent (ganzzahlig). Tarif/Mindestbestellwerte gespiegelt aus calculate-delivery/index.ts.

export const TOLERANCE_CENTS = 1;
export const KM_TOLERANCE = 0.05;
export const MAX_LINE_QTY = 10000;
export const CHAFING_DISH_ID = "chafing-dish";
/** Preise von Positionen, die nicht in menu_items stehen (Checkout.tsx CHAFING_DISH.price = 25,00 EUR brutto). */
export const FIXED_ITEM_PRICES_CENTS: Readonly<Record<string, number>> = { [CHAFING_DISH_ID]: 2500 };
export const PIZZA_MENU_SLUG = "pizze-napoletane";

const NET_BASE_FEE_PER_TRIP = 50;
const NET_PER_KM = 1.2;

export const toCents = (euro: number): number => Math.round(euro * 100);

export interface ClientLine {
  id: string;
  quantity: number;
  /** Einzelpreis in EUR, wie vom Client gesendet */
  price: number;
  /** Namen wie in catering_orders.items gespeichert (gehen an Stripe, Mails, Rechnung) */
  name?: string | null;
  name_en?: string | null;
}

export interface CatalogEntry {
  /** menu_items.price in EUR; null = nicht bepreist */
  price: number | null;
  /** false bei deleted_at/archived_at */
  active: boolean;
  /** Slug des Catering-Menüs (für Pizza-only-Erkennung) */
  menuSlug?: string | null;
  name?: string | null;
  nameEn?: string | null;
}
export type Catalog = Record<string, CatalogEntry>;

export type Reject =
  | "invalid_items"
  | "unknown_item"
  | "item_unavailable"
  | "price_mismatch"
  | "name_mismatch"
  | "surcharge_mismatch"
  | "delivery_mismatch"
  | "delivery_unverifiable"
  | "total_mismatch";

export const REJECT_MESSAGES_DE: Readonly<Record<Reject, string>> = {
  invalid_items: "Die Bestellpositionen sind ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
  unknown_item: "Eine Position ist nicht mehr im Angebot. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.",
  item_unavailable: "Eine Position ist nicht mehr verfügbar. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.",
  name_mismatch: "Die Bezeichnung einer Position hat sich geändert. Bitte laden Sie die Seite neu und prüfen Sie Ihren Warenkorb.",
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

/** Anzahl Fahrten: 0 bis 1 km (kostenlos), Pizza-only 1 (nur Hinfahrt), sonst 2 (Hin- und Rückfahrt für das Leihgerät). */
export function tripCount(oneWayKm: number, pizzaOnly: boolean): 0 | 1 | 2 {
  if (oneWayKm <= 1) return 0;
  return pizzaOnly ? 1 : 2;
}

/** Entfernung (einfache Strecke) auf 0,01 km: Gebühr, Anzeige und gespeicherter Wert (calculated_distance_km) stimmen so überein. */
export const roundKm = (km: number): number => Math.round(km * 100) / 100;

/**
 * Liefergebühr NETTO in Cent. 1 bis 8 km: 50 EUR je Fahrt; darüber 50 EUR je Fahrt + 1,20 EUR je km und Fahrt.
 * `oneWayKm` ist IMMER die einfache Strecke; die Fahrtenzahl multipliziert Pauschale und Kilometer (nicht die Strecke selbst speichern!).
 */
export function deliveryFeeNetCents(oneWayKm: number, pizzaOnly: boolean): number {
  const trips = tripCount(oneWayKm, pizzaOnly);
  if (trips === 0) return 0;
  if (oneWayKm <= 8) return NET_BASE_FEE_PER_TRIP * trips * 100;
  return Math.round((NET_BASE_FEE_PER_TRIP * trips + oneWayKm * trips * NET_PER_KM) * 100);
}

/** Liefergebühr brutto in Cent (19 % USt, ganzzahlig gerundet, Halbcent nach oben wie numeric-round in der DB). */
export function deliveryFeeGrossCents(oneWayKm: number, pizzaOnly: boolean): number {
  const net = deliveryFeeNetCents(oneWayKm, pizzaOnly);
  return Math.floor((net * 119 + 50) / 100);
}

/** Pizza-only: alle Menü-Positionen stammen aus dem Pizza-Menü (Chafing-Zeilen ignoriert, unbekannte = nein). */
export function isPizzaOnlyOrder(lines: ClientLine[], catalog: Catalog): boolean {
  const menuLines = lines.filter((l) => l.id !== CHAFING_DISH_ID); // Leihgerät zählt nicht (Client: Checkout.tsx isPizzaOnly)
  return menuLines.length > 0 && menuLines.every((l) => catalog[l.id]?.menuSlug === PIZZA_MENU_SLUG);
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
  /** Serverseitig ermittelter Wert verknüpfter Geschenkkörbe in Cent (Mischbestellung); 0 = keine. Zählt zum Mindestbestellwert (Entscheidung 22.11.2026). */
  giftCents?: number;
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
    if (fixed === undefined) {
      const c = catalog[l.id];
      const norm = (v: string | null | undefined) => (v ?? "").trim();
      if (norm(l.name) !== norm(c.name) || norm(l.name_en) !== norm(c.nameEn)) {
        return fail("name_mismatch", { id: l.id, client: [l.name, l.name_en], server: [c.name, c.nameEn] });
      }
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
    // Entfernung ist eine Server-Neuberechnung desselben Routingdienstes: +-0,05 km Toleranz (Routing-Drift,
    // Grenzen bei 1 und 8 km). Akzeptiert wird jede Gebühr zwischen Minimum und Maximum dieses Fensters.
    const kmLo = Math.max(0, input.oneWayKm - KM_TOLERANCE);
    const kmHi = input.oneWayKm + KM_TOLERANCE;
    // Pizza-only: Chafing-Zeilen werden ignoriert; steckt eine im Warenkorb, zählt der Client sie als Nicht-Pizza
    // (Warenkorb-Chafing) oder nicht (Checkout-Chafing) -> beide Varianten zulässig.
    const hasChafing = lines.some((l) => l.id === CHAFING_DISH_ID);
    const pizza = isPizzaOnlyOrder(lines, catalog);
    const variants = hasChafing && pizza ? [true, false] : [pizza];
    const ranges = variants.map((v) => [deliveryFeeGrossCents(kmLo, v), deliveryFeeGrossCents(kmHi, v)] as const);
    const inRange = ranges.some(([lo, hi]) => clientDelivery >= lo - TOLERANCE_CENTS && clientDelivery <= hi + TOLERANCE_CENTS);
    if (!inRange) return fail("delivery_mismatch", { clientCents: clientDelivery, serverRanges: ranges });
    deliveryCents = clientDelivery; // geprüft

    // Aufschlag: Der Client rechnet auf Warenkorb OHNE das im Checkout zugewählte Chafing-Leihgerät. Gespeichert wird nicht,
    // woher die Chafing-Zeile stammt -> jeder Wert zwischen "mit" und "ohne Chafing" (und Mindestwert-Fenster) ist zulässig.
    // Geschenkkörbe (Mischbestellung, Entscheidung 22.11.2026) zählen mit: Untergrenze = Aufschlag MIT Korbwert (Server-Wert).
    // Obergrenze bleibt der Aufschlag OHNE Korbwert: so läuft ein alter Browser-Tab (rechnet noch nur den Catering-Anteil) nicht
    // in surcharge_mismatch; zu wenig Aufschlag (unter der neuen Regel) wird weiterhin abgelehnt.
    const gift = Number.isFinite(input.giftCents) ? Math.max(0, Math.trunc(input.giftCents as number)) : 0;
    const minLo = minimumOrderCents(kmLo);
    const minHi = minimumOrderCents(kmHi);
    const sLo = Math.max(0, Math.min(minLo, minHi) - itemsCents - gift);
    const sHi = Math.max(0, Math.max(minLo, minHi) - (itemsCents - chafingCents));
    if (clientSurcharge < sLo - TOLERANCE_CENTS || clientSurcharge > sHi + TOLERANCE_CENTS) {
      return fail("surcharge_mismatch", { clientCents: clientSurcharge, serverRangeCents: [sLo, sHi] });
    }
    surchargeCents = clientSurcharge; // geprüft
  }

  const expectedTotalCents = itemsCents + surchargeCents + deliveryCents;
  const clientTotal = toCents(input.clientTotalEuro);
  if (Math.abs(clientTotal - expectedTotalCents) > TOLERANCE_CENTS) {
    return fail("total_mismatch", { clientCents: clientTotal, serverCents: expectedTotalCents });
  }
  return { ok: true, expectedTotalCents, itemsCents, surchargeCents, deliveryCents };
}

/**
 * Anzeigetext der Lieferstrecke für Mails/Rechnung: "12,3 km × 2 Fahrten" bzw. "12,3 km × 1 Fahrt" (Fahrtenzahl aus der gezahlten
 * Liefergebühr abgeleitet, weil sie nicht im Datensatz steht) oder nur "12,3 km", wenn sich keine Fahrtenzahl bestimmen lässt
 * (z. B. Altbestellungen > 8 km, bei denen Strecke x Fahrten gespeichert wurde).
 */
export function deliveryDistanceLabel(oneWayKm: number, grossFeeEuro: number | null | undefined, lang: "de" | "en" = "de"): string {
  const km = Math.round(oneWayKm * 10) / 10;
  const kmText = lang === "de" ? String(km).replace(".", ",") : String(km);
  const fee = Math.round(Number(grossFeeEuro ?? 0) * 100);
  let trips = 0;
  if (fee > 0 && oneWayKm > 1) {
    const k = roundKm(oneWayKm);
    if (Math.abs(fee - deliveryFeeGrossCents(k, false)) <= 1) trips = 2;
    else if (Math.abs(fee - deliveryFeeGrossCents(k, true)) <= 1) trips = 1;
  }
  if (trips === 0) return `${kmText} km`;
  const unit = lang === "de" ? (trips === 1 ? "Fahrt" : "Fahrten") : (trips === 1 ? "trip" : "trips");
  return `${kmText} km × ${trips} ${unit}`;
}
