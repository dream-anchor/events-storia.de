/**
 * Server-Angebot im Checkout (Abdichtung 22.11.2026): reine Typen und Funktionen, KEINE Imports (auch in Deno-Tests nutzbar).
 *
 * Alle Beträge (Positionen, Entfernung, Liefergebühr, Mindestbestellwert-Aufschlag, Summe) berechnet allein der Server
 * (supabase/functions/_shared/orderQuote.ts). Der Checkout zeigt nur diese Werte an und gleicht den Warenkorb damit ab:
 * Preise/Namen werden aktualisiert, nicht mehr verfügbare Artikel entfernt, Gästezahlen in die Grenzen des Pakets gesetzt.
 *
 * Entfernung = EINFACHE Strecke (km); die Fahrtenzahl (`trips`: 0, 1 bei Pizza-only, sonst 2) steht getrennt daneben.
 */

export type QuoteLineKind = 'menu' | 'chafing_cart' | 'chafing_checkout' | 'event_package';

export interface QuoteLine {
  id: string;
  name: string;
  name_en: string | null;
  quantity: number;
  /** Einzelpreis in Cent (Event-Pakete: Durchschnitt Gesamt/Gäste; maßgeblich ist lineCents) */
  unitCents: number;
  lineCents: number;
  kind: QuoteLineKind;
  eventPricing?: { basePrice: number; pricePerPerson: boolean; minGuests: number; maxGuests: number };
  priceChanged: boolean;
  nameChanged: boolean;
}

export type QuoteIssueCode = 'unknown_item' | 'item_unavailable' | 'unknown_package' | 'guests_out_of_range';

export interface QuoteIssue {
  code: QuoteIssueCode;
  id: string;
  name?: string | null;
  minGuests?: number;
  maxGuests?: number;
}

export interface QuoteDelivery {
  oneWayDistanceKm: number;
  trips: 0 | 1 | 2;
  isFreeDelivery: boolean;
  isRoundTrip: boolean;
  deliveryCostNet: number;
  deliveryCostGross: number;
  deliveryVat: number;
  deliveryVatRate: number;
  minimumOrder: number;
}

export interface OrderQuote {
  kind: 'catering' | 'event';
  isPickup: boolean;
  isPizzaOnly: boolean;
  lines: QuoteLine[];
  issues: QuoteIssue[];
  itemsCents: number;
  checkoutChafingCents: number;
  surchargeCents: number;
  deliveryCents: number;
  totalCents: number;
  delivery: QuoteDelivery | null;
}

/** Form, in der der Checkout seine Lieferanzeige bisher aus `calculate-delivery` bekam (JSX bleibt unverändert). */
export interface DeliveryCalculation {
  /** einfache Strecke in km */
  distanceKm: number;
  deliveryCostNet: number;
  deliveryCostGross: number;
  deliveryVat: number;
  deliveryVatRate: number;
  isFreeDelivery: boolean;
  minimumOrder: number;
  message: string;
  messageEn: string;
  isRoundTrip: boolean;
  oneWayDistanceKm: number;
  trips: 0 | 1 | 2;
}

export function deliveryCalcFromQuote(quote: OrderQuote | null): DeliveryCalculation | null {
  const d = quote?.delivery;
  if (!d) return null;
  const km = Math.round(d.oneWayDistanceKm);
  let message: string;
  let messageEn: string;
  if (d.trips === 0) {
    message = 'Kostenlose Lieferung';
    messageEn = 'Free delivery';
  } else if (d.oneWayDistanceKm <= 8) {
    message = d.isRoundTrip ? 'Lieferung im Münchner Raum (Hin- und Rückfahrt)' : 'Lieferung im Münchner Raum (nur Hinfahrt)';
    messageEn = d.isRoundTrip ? 'Delivery in Munich area (round trip)' : 'Delivery in Munich area (one-way)';
  } else {
    message = d.isRoundTrip ? `Lieferung (${km} km × 2 Fahrten, inkl. Anfahrtspauschale)` : `Lieferung (${km} km, inkl. Anfahrtspauschale)`;
    messageEn = d.isRoundTrip ? `Delivery (${km} km × 2 trips, incl. base fee)` : `Delivery (${km} km, incl. base fee)`;
  }
  return {
    distanceKm: d.oneWayDistanceKm,
    oneWayDistanceKm: d.oneWayDistanceKm,
    trips: d.trips,
    deliveryCostNet: d.deliveryCostNet,
    deliveryCostGross: d.deliveryCostGross,
    deliveryVat: d.deliveryVat,
    deliveryVatRate: d.deliveryVatRate,
    isFreeDelivery: d.isFreeDelivery,
    minimumOrder: d.minimumOrder,
    isRoundTrip: d.isRoundTrip,
    message,
    messageEn,
  };
}

// ---------------------------------------------------------------------------
// Warenkorb mit dem Server-Angebot abgleichen
// ---------------------------------------------------------------------------
export interface CartLineLike {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  quantity: number;
  /** nur Event-Pakete: Grundlage der Preisrechnung (fehlt bei alten Warenkörben) */
  eventPricing?: { basePrice: number; pricePerPerson: boolean; minGuests: number; maxGuests: number };
}

export type CartChange =
  | { kind: 'price'; id: string; name: string; oldUnit: number; newUnit: number }
  | { kind: 'name'; id: string; name: string; oldName: string }
  | { kind: 'removed'; id: string; name: string }
  | { kind: 'guests'; id: string; name: string; from: number; to: number; min: number; max: number };

export interface CartUpdate {
  id: string;
  name: string;
  name_en: string | null;
  /** Einzelpreis in EUR (Event-Pakete: Gesamt/Gäste) */
  price: number;
  eventPricing?: { basePrice: number; pricePerPerson: boolean; minGuests: number; maxGuests: number };
}

export interface CartSync {
  updates: CartUpdate[];
  removals: string[];
  clamps: { id: string; quantity: number }[];
  changes: CartChange[];
}

const cents = (euro: number) => Math.round(euro * 100);

/**
 * Vergleicht den Warenkorb (localStorage, evtl. veraltet) mit dem Server-Angebot. Der Server hat immer recht:
 * Preise/Namen werden übernommen, nicht verkäufliche Artikel entfernt, Gästezahlen in die Paket-Grenzen gesetzt.
 * Ohne Abweichung sind alle Listen leer (kein Hinweis, kein Schreibzugriff).
 */
export function reconcileCartWithQuote(cart: CartLineLike[], quote: OrderQuote): CartSync {
  const out: CartSync = { updates: [], removals: [], clamps: [], changes: [] };
  const byId = new Map<string, QuoteLine>();
  for (const l of quote.lines) {
    if (l.kind === 'chafing_checkout') continue; // kommt aus dem Checkout-Zustand, nicht aus dem Warenkorb
    // mehrere Zeilen derselben ID (Event-Pakete: pro Zeile ein Paket) sind im Warenkorb eindeutig
    byId.set(l.id, l);
  }
  for (const issue of quote.issues) {
    const item = cart.find((c) => c.id === issue.id);
    if (!item) continue;
    if (issue.code === 'guests_out_of_range' && issue.minGuests !== undefined && issue.maxGuests !== undefined) {
      const to = Math.min(Math.max(item.quantity, issue.minGuests), issue.maxGuests);
      out.clamps.push({ id: item.id, quantity: to });
      out.changes.push({ kind: 'guests', id: item.id, name: item.name, from: item.quantity, to, min: issue.minGuests, max: issue.maxGuests });
    } else {
      out.removals.push(item.id);
      out.changes.push({ kind: 'removed', id: item.id, name: item.name });
    }
  }
  for (const item of cart) {
    const line = byId.get(item.id);
    if (!line) continue;
    const newUnit = line.kind === 'event_package' ? line.lineCents / line.quantity / 100 : line.unitCents / 100;
    const priceDiffers = line.kind === 'event_package'
      ? Math.abs(cents(item.price * item.quantity) - line.lineCents) > 1
      : cents(item.price) !== line.unitCents;
    const nameDiffers = line.name !== item.name || (line.name_en || null) !== (item.name_en || null);
    // Event-Pakete: fehlende/abweichende Preisgrundlage still ergänzen (alte Warenkörbe), damit Gästezahl-Änderungen richtig rechnen
    const ep = line.eventPricing;
    const cp = item.eventPricing;
    const pricingStale = line.kind === 'event_package' && !!ep
      && (!cp || cp.basePrice !== ep.basePrice || cp.pricePerPerson !== ep.pricePerPerson || cp.minGuests !== ep.minGuests || cp.maxGuests !== ep.maxGuests);
    if (!priceDiffers && !nameDiffers && !pricingStale) continue;
    out.updates.push({ id: item.id, name: line.name, name_en: line.name_en, price: newUnit, eventPricing: ep });
    if (priceDiffers) out.changes.push({ kind: 'price', id: item.id, name: line.name, oldUnit: item.price, newUnit });
    else if (nameDiffers) out.changes.push({ kind: 'name', id: item.id, name: line.name, oldName: item.name });
  }
  return out;
}

export const hasCartSync = (s: CartSync): boolean => s.updates.length + s.removals.length + s.clamps.length > 0;

/** Hinweistexte für den Kunden (de/en), eine Zeile je Änderung. `fmt` formatiert einen Eurobetrag. */
export function describeCartChanges(changes: CartChange[], lang: 'de' | 'en', fmt: (euro: number) => string): string[] {
  const de = lang === 'de';
  return changes.map((c) => {
    switch (c.kind) {
      case 'price':
        return de ? `${c.name}: Preis geändert (${fmt(c.oldUnit)} → ${fmt(c.newUnit)})` : `${c.name}: price changed (${fmt(c.oldUnit)} → ${fmt(c.newUnit)})`;
      case 'name':
        return de ? `${c.oldName}: Bezeichnung geändert zu „${c.name}“` : `${c.oldName}: renamed to “${c.name}”`;
      case 'removed':
        return de ? `${c.name}: nicht mehr verfügbar und aus dem Warenkorb entfernt` : `${c.name}: no longer available and removed from your cart`;
      case 'guests':
        return de
          ? `${c.name}: Gästezahl auf ${c.to} angepasst (möglich: ${c.min} bis ${c.max})`
          : `${c.name}: number of guests set to ${c.to} (allowed: ${c.min} to ${c.max})`;
    }
  });
}

/** Zwei Angebote für dieselbe Anfrage: hat sich der Betrag geändert? (Hinweis "Betrag aktualisiert") */
export const totalChanged = (a: OrderQuote | null, b: OrderQuote | null): boolean => !!a && !!b && a.totalCents !== b.totalCents;

/** Schlüssel der Angebotsanfrage: nur was den Betrag bestimmt (IDs, Mengen, Lieferart, Adresse), nie Preise/Namen aus dem Browser. */
export function quoteRequestKey(p: {
  items: { id: string; quantity: number }[];
  chafingQuantity: number;
  deliveryType: string;
  address: { street: string; zip: string; city: string };
}): string {
  const items = [...p.items].map((i) => `${i.id}:${i.quantity}`).sort();
  const addr = p.deliveryType === 'delivery' ? [p.address.street, p.address.zip, p.address.city].map((s) => s.trim().toLowerCase()) : [];
  return JSON.stringify([items, p.chafingQuantity, p.deliveryType, addr]);
}
