// Serverseitige Angebotsrechnung für Catering-Bestellungen und EVT-Buchungen (Einheit I3, Abdichtung 22.11.2026).
// Reine Funktionen, keine I/O. EINZIGE Stelle, die Positionen, Entfernung, Liefergebühr, Mindestbestellwert-Aufschlag
// und Summe berechnet: `quote-catering-order` (Anzeige im Checkout) und `create-catering-payment` (Anlage + Zahlung)
// rufen beide `buildOrderQuote` auf. Der Browser schickt nur Artikel-IDs und Mengen, nie Beträge, die gespeichert werden.
//
// Entfernung: `oneWayKm` ist IMMER die einfache Strecke (Karlstr. 47a bis Lieferadresse), auf 0,01 km gerundet.
// Die Fahrtenzahl (`trips`: 0 bis 1 km, Pizza-only 1, sonst 2) steht getrennt daneben und multipliziert nur Pauschale und Kilometer.
// Gespeichert wird `calculated_distance_km` = einfache Strecke; die Fahrtenzahl ergibt sich aus den Positionen (Pizza-only).
import {
  CHAFING_DISH_ID,
  FIXED_ITEM_PRICES_CENTS,
  MAX_LINE_QTY,
  PIZZA_MENU_SLUG,
  deliveryFeeGrossCents,
  deliveryFeeNetCents,
  minimumOrderCents,
  roundKm,
  toCents,
  tripCount,
  type Catalog,
} from "./cateringPricing.ts";
import { EVENT_MAX_GUESTS_DEFAULT, expectedEventPackageCents, type EventPackageRow } from "./eventPricing.ts";

export type Lang = "de" | "en";

/** Position wie vom Checkout gesendet. `price`/`name` sind nur zum Erkennen von Änderungen da (nie Quelle eines Betrags). */
export interface QuoteRequestItem {
  id: string;
  quantity: number;
  price?: number | null;
  name?: string | null;
  name_en?: string | null;
}

export interface QuoteRequest {
  /** Warenkorb-Positionen (Catering ODER Event-Pakete `event-<uuid>`); keine Geschenkkörbe */
  items: QuoteRequestItem[];
  /** im Checkout zugewählte Chafing-Dish-Leihgeräte (zählen nicht für den Mindestbestellwert) */
  chafingQuantity: number;
  isPickup: boolean;
  /**
   * Wert der Geschenkkörbe einer Mischbestellung in Cent, SERVERSEITIG ermittelt (cateringServer.ts: gift_basket_variants bzw.
   * gift_order_items), nie aus dem Browser. Zählt zum Mindestbestellwert (Entscheidung Antoine 22.11.2026), ist aber NICHT Teil von
   * itemsCents/totalCents (Körbe werden separat über create-gift-order berechnet und bezahlt). Fehlt = 0.
   */
  giftCents?: number;
}

export interface QuotePackage extends EventPackageRow {
  name: string;
  name_en: string | null;
  min_guests: number | null;
  max_guests: number | null;
}

export interface QuoteContext {
  catalog: Catalog;
  packages: Record<string, QuotePackage>;
  /** einfache Strecke in km (Server-Routing); null = nicht ermittelbar */
  oneWayKm: number | null;
}

export interface QuoteLine {
  id: string;
  name: string;
  name_en: string | null;
  quantity: number;
  /** Einzelpreis in Cent; bei Event-Paketen der rechnerische Durchschnitt (Gesamt / Gäste), maßgeblich ist lineCents */
  unitCents: number;
  lineCents: number;
  kind: "menu" | "chafing_cart" | "chafing_checkout" | "event_package";
  /** nur Event-Pakete: Grundlage der Preisrechnung, damit der Warenkorb bei Gästezahl-Änderungen sofort richtig rechnet */
  eventPricing?: { basePrice: number; pricePerPerson: boolean; minGuests: number; maxGuests: number };
  /** Preis weicht von dem ab, den der Browser zuletzt kannte */
  priceChanged: boolean;
  nameChanged: boolean;
}

export type QuoteIssueCode = "unknown_item" | "item_unavailable" | "unknown_package" | "guests_out_of_range";

export interface QuoteIssue {
  code: QuoteIssueCode;
  id: string;
  name?: string | null;
  minGuests?: number;
  maxGuests?: number;
}

/** Lieferdaten im Format von calculate-delivery (der Checkout rendert damit seine bestehenden Anzeigen). */
export interface QuoteDelivery {
  /** einfache Strecke in km (0,01 genau) */
  oneWayDistanceKm: number;
  /** Fahrtenzahl: 0 (bis 1 km), 1 (Pizza-only), 2 (Hin- und Rückfahrt) */
  trips: 0 | 1 | 2;
  isFreeDelivery: boolean;
  isRoundTrip: boolean;
  deliveryCostNet: number;
  deliveryCostGross: number;
  deliveryVat: number;
  deliveryVatRate: number;
  /** Mindestbestellwert für diese Entfernung in EUR */
  minimumOrder: number;
}

export interface OrderQuote {
  kind: "catering" | "event";
  isPickup: boolean;
  isPizzaOnly: boolean;
  lines: QuoteLine[];
  /** blockierende Befunde: Bestellung kann so nicht angelegt werden, der Checkout muss den Warenkorb anpassen */
  issues: QuoteIssue[];
  /** Summe aller Positionen inkl. Chafing (brutto) */
  itemsCents: number;
  /** davon im Checkout zugewähltes Chafing */
  checkoutChafingCents: number;
  surchargeCents: number;
  deliveryCents: number;
  /** Summe Catering (Positionen + Aufschlag + Lieferung); OHNE Geschenkkörbe */
  totalCents: number;
  delivery: QuoteDelivery | null;
  /** Korbwert, der zum Mindestbestellwert zählte (0 ohne Körbe); nur Information, nicht in totalCents enthalten */
  giftCents: number;
}

export type QuoteReject = "invalid_items" | "mixed_cart" | "delivery_unverifiable" | "address_missing";

export type QuoteOutcome =
  | { ok: true; quote: OrderQuote }
  | { ok: false; code: QuoteReject; detail: Record<string, unknown> };

const fail = (code: QuoteReject, detail: Record<string, unknown> = {}): QuoteOutcome => ({ ok: false, code, detail });

export const EVENT_ID_PREFIX = "event-";
const norm = (v: string | null | undefined) => (v ?? "").trim();

export const CHECKOUT_CHAFING_NAME = { de: "Chafing Dish (Leihgerät)", en: "Chafing Dish (rental)" } as const;
export const CART_CHAFING_NAME = { de: "Chafing Dish", en: "Chafing Dish" } as const;

function validQuantity(q: unknown): q is number {
  return typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= MAX_LINE_QTY;
}

/** Berechnet das vollständige Angebot. Abweichungen zum Warenkorb des Browsers landen in `lines[].priceChanged` bzw. `issues`. */
export function buildOrderQuote(req: QuoteRequest, ctx: QuoteContext): QuoteOutcome {
  if (!Array.isArray(req.items) || req.items.length === 0) return fail("invalid_items", { reason: "empty" });
  const chafingQty = req.chafingQuantity ?? 0;
  if (!Number.isInteger(chafingQty) || chafingQty < 0 || chafingQty > MAX_LINE_QTY) return fail("invalid_items", { reason: "chafing_quantity" });
  for (const i of req.items) {
    if (!i || typeof i.id !== "string" || i.id.length === 0 || !validQuantity(i.quantity)) return fail("invalid_items", { id: i?.id });
  }
  const eventItems = req.items.filter((i) => i.id.startsWith(EVENT_ID_PREFIX));
  if (eventItems.length > 0 && eventItems.length !== req.items.length) return fail("mixed_cart");
  if (eventItems.length > 0 && chafingQty > 0) return fail("invalid_items", { reason: "chafing_with_event" });
  return eventItems.length > 0 ? buildEventQuote(req, ctx) : buildCateringQuote(req, ctx);
}

function buildEventQuote(req: QuoteRequest, ctx: QuoteContext): QuoteOutcome {
  const lines: QuoteLine[] = [];
  const issues: QuoteIssue[] = [];
  let total = 0;
  for (const i of req.items) {
    const pkgId = i.id.slice(EVENT_ID_PREFIX.length);
    const pkg = ctx.packages[pkgId];
    if (!pkg || pkg.is_active === false) {
      issues.push({ code: "unknown_package", id: i.id, name: i.name ?? null });
      continue;
    }
    // Gästegrenzen wie die Anzeige im Paket-Shop (min_guests || 1, max_guests || 200)
    const minGuests = pkg.min_guests || 1;
    const maxGuests = pkg.max_guests || EVENT_MAX_GUESTS_DEFAULT;
    if (i.quantity < minGuests || i.quantity > maxGuests) {
      issues.push({ code: "guests_out_of_range", id: i.id, name: pkg.name, minGuests, maxGuests });
      continue;
    }
    const lineCents = expectedEventPackageCents(pkg, i.quantity);
    const unitCents = lineCents / i.quantity;
    total += lineCents;
    lines.push({
      id: i.id,
      name: pkg.name,
      name_en: pkg.name_en,
      quantity: i.quantity,
      unitCents,
      lineCents,
      kind: "event_package",
      eventPricing: { basePrice: pkg.price, pricePerPerson: !!pkg.price_per_person, minGuests, maxGuests },
      // Der Warenkorb speichert den durchschnittlichen Stückpreis (Gesamt / Gäste); verglichen wird die Zeilensumme
      priceChanged: typeof i.price === "number" && Math.abs(Math.round(i.price * i.quantity * 100) - lineCents) > 1,
      nameChanged: norm(i.name) !== "" && norm(i.name) !== norm(pkg.name),
    });
  }
  return {
    ok: true,
    quote: {
      kind: "event",
      isPickup: false,
      isPizzaOnly: false,
      lines,
      issues,
      itemsCents: total,
      checkoutChafingCents: 0,
      surchargeCents: 0,
      deliveryCents: 0,
      totalCents: total,
      delivery: null,
      giftCents: 0,
    },
  };
}

function buildCateringQuote(req: QuoteRequest, ctx: QuoteContext): QuoteOutcome {
  const lines: QuoteLine[] = [];
  const issues: QuoteIssue[] = [];
  let cartCents = 0; // Warenkorb inkl. Warenkorb-Chafing, OHNE Checkout-Chafing: Catering-Basis des Mindestbestellwerts (dazu kommt der Korbwert giftCents)
  let allPizza = true;

  for (const i of req.items) {
    if (i.id === CHAFING_DISH_ID) {
      const unit = FIXED_ITEM_PRICES_CENTS[CHAFING_DISH_ID];
      const lineCents = unit * i.quantity;
      cartCents += lineCents;
      allPizza = false; // Warenkorb-Chafing hat keine Kategorie 'pizza' (Checkout: isPizzaOnly)
      lines.push({
        id: i.id, name: CART_CHAFING_NAME.de, name_en: CART_CHAFING_NAME.en, quantity: i.quantity, unitCents: unit, lineCents,
        kind: "chafing_cart",
        priceChanged: typeof i.price === "number" && toCents(i.price) !== unit,
        nameChanged: false,
      });
      continue;
    }
    const c = ctx.catalog[i.id];
    if (!c) { issues.push({ code: "unknown_item", id: i.id, name: i.name ?? null }); continue; }
    if (!c.active || c.price === null || !Number.isFinite(c.price)) { issues.push({ code: "item_unavailable", id: i.id, name: c.name ?? i.name ?? null }); continue; }
    const unit = toCents(c.price);
    const lineCents = unit * i.quantity;
    cartCents += lineCents;
    if (c.menuSlug !== PIZZA_MENU_SLUG) allPizza = false;
    lines.push({
      id: i.id, name: c.name ?? "", name_en: c.nameEn ?? null, quantity: i.quantity, unitCents: unit, lineCents, kind: "menu",
      priceChanged: typeof i.price === "number" && toCents(i.price) !== unit,
      nameChanged: (norm(i.name) !== "" && norm(i.name) !== norm(c.name)) || (norm(i.name_en) !== "" && norm(i.name_en) !== norm(c.nameEn)),
    });
  }

  let checkoutChafingCents = 0;
  if (req.chafingQuantity > 0) {
    const unit = FIXED_ITEM_PRICES_CENTS[CHAFING_DISH_ID];
    checkoutChafingCents = unit * req.chafingQuantity;
    lines.push({
      id: CHAFING_DISH_ID, name: CHECKOUT_CHAFING_NAME.de, name_en: CHECKOUT_CHAFING_NAME.en, quantity: req.chafingQuantity,
      unitCents: unit, lineCents: checkoutChafingCents, kind: "chafing_checkout", priceChanged: false, nameChanged: false,
    });
  }
  const itemsCents = cartCents + checkoutChafingCents;
  const isPizzaOnly = req.items.length > 0 && allPizza;

  // Mischbestellung: Körbe zählen zum Mindestbestellwert (Entscheidung 22.11.2026); Wert kommt vom Server
  const giftCents = Number.isFinite(req.giftCents) ? Math.max(0, Math.trunc(req.giftCents as number)) : 0;
  let surchargeCents = 0;
  let deliveryCents = 0;
  let delivery: QuoteDelivery | null = null;
  if (!req.isPickup) {
    if (ctx.oneWayKm === null || !Number.isFinite(ctx.oneWayKm) || ctx.oneWayKm < 0) return fail("delivery_unverifiable");
    const km = roundKm(ctx.oneWayKm);
    const trips = tripCount(km, isPizzaOnly);
    const net = deliveryFeeNetCents(km, isPizzaOnly);
    deliveryCents = deliveryFeeGrossCents(km, isPizzaOnly);
    const minimum = minimumOrderCents(km);
    surchargeCents = Math.max(0, minimum - cartCents - giftCents);
    delivery = {
      oneWayDistanceKm: km,
      trips,
      isFreeDelivery: trips === 0,
      isRoundTrip: trips === 2,
      deliveryCostNet: net / 100,
      deliveryCostGross: deliveryCents / 100,
      deliveryVat: (deliveryCents - net) / 100,
      deliveryVatRate: 0.19,
      minimumOrder: minimum / 100,
    };
  }

  return {
    ok: true,
    quote: {
      kind: "catering",
      isPickup: req.isPickup,
      isPizzaOnly,
      lines,
      issues,
      itemsCents,
      checkoutChafingCents,
      surchargeCents,
      deliveryCents,
      totalCents: itemsCents + surchargeCents + deliveryCents,
      delivery,
      giftCents,
    },
  };
}

/** Hat sich gegenüber dem, was der Kunde zuletzt gesehen hat, etwas geändert? (Preis, Name, Artikel entfernt) */
export function quoteHasChanges(q: OrderQuote): boolean {
  return q.issues.length > 0 || q.lines.some((l) => l.priceChanged || l.nameChanged);
}

// ---------------------------------------------------------------------------
// Meldungen in der Sprache der Oberfläche (der Checkout kennt de und en)
// ---------------------------------------------------------------------------
export type OrderErrorCode =
  | QuoteReject
  | "quote_changed"
  | "invalid_request"
  | "order_number_invalid"
  | "order_exists"
  | "order_in_progress"
  | "session_check_unavailable"
  | "schedule_lead_time" | "schedule_pizza_window" | "schedule_pizza_lead_time" | "schedule_weekend_cutoff" | "schedule_weekend_open" | "schedule_too_far"
  | "customer_invalid"
  | "payment_method_invalid"
  | "gift_not_pending" | "gift_email_mismatch" | "gift_not_linked" | "gift_hold_expired" | "gift_order_not_found"
  | "order_create_failed"
  | "payment_failed"
  | "rate_limited";

export const ORDER_MESSAGES: Readonly<Record<OrderErrorCode, { de: string; en: string }>> = {
  invalid_items: {
    de: "Die Bestellpositionen sind ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
    en: "The order items are invalid. Please reload the page and order again.",
  },
  mixed_cart: {
    de: "Event-Pakete und Catering-Artikel können nicht gemeinsam bestellt werden. Bitte bestellen Sie getrennt.",
    en: "Event packages and catering items cannot be ordered together. Please order them separately.",
  },
  address_missing: {
    de: "Bitte geben Sie eine vollständige Lieferadresse an.",
    en: "Please enter a complete delivery address.",
  },
  delivery_unverifiable: {
    de: "Die Lieferkosten konnten gerade nicht berechnet werden. Bitte versuchen Sie es in einer Minute erneut. Ihr Warenkorb bleibt erhalten.",
    en: "The delivery cost could not be calculated right now. Please try again in a minute. Your cart has been kept.",
  },
  quote_changed: {
    de: "Preise oder Lieferkosten haben sich geändert. Bitte prüfen Sie den neuen Betrag und bestätigen Sie die Bestellung erneut.",
    en: "Prices or delivery costs have changed. Please review the new total and confirm your order again.",
  },
  invalid_request: {
    de: "Die Anfrage ist unvollständig. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    en: "The request is incomplete. Please reload the page and try again.",
  },
  order_number_invalid: {
    de: "Die Bestellnummer ist ungültig. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
    en: "The order number is invalid. Please reload the page and order again.",
  },
  order_exists: {
    de: "Diese Bestellung wurde bereits angelegt. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
    en: "This order has already been created. Please reload the page and order again.",
  },
  schedule_lead_time: {
    de: "Catering-Bestellungen benötigen mindestens 24 Stunden Vorlauf. In dringenden Fällen rufen Sie uns an: 0163 6033912.",
    en: "Catering orders require at least 24 hours advance notice. For urgent cases please call us: 0163 6033912.",
  },
  schedule_pizza_window: {
    de: "Pizza-Lieferung ist nur zwischen 12:00-14:30 Uhr und 18:00-22:30 Uhr möglich.",
    en: "Pizza delivery is only available between 12:00-14:30 and 18:00-22:30.",
  },
  schedule_pizza_lead_time: {
    de: "Die gewählte Zeit ist zu kurzfristig. Bitte mindestens 1 Stunde im Voraus bestellen. Bei Fragen: 0163 6033912.",
    en: "The selected time is too soon. Please order at least 1 hour in advance. Questions? 0163 6033912.",
  },
  schedule_weekend_open: {
    de: "Am Samstag und Sonntag sind Catering-Lieferungen und -Abholungen frühestens ab 12:00 Uhr möglich (das Restaurant öffnet dann um 12:00 Uhr).",
    en: "On Saturdays and Sundays catering deliveries and pickups are available from 12:00 noon at the earliest (the restaurant opens at 12:00 on weekends).",
  },
  schedule_too_far: {
    de: "Bestellungen sind höchstens 2 Jahre im Voraus möglich. Für spätere Termine rufen Sie uns an: 0163 6033912.",
    en: "Orders can be placed at most 2 years in advance. For later dates please call us: 0163 6033912.",
  },
  schedule_weekend_cutoff: {
    de: "Lieferungen für Samstag und Sonntag müssen bis Donnerstag 23:59 Uhr bestellt werden. Für kurzfristige Anfragen: 0163 6033912.",
    en: "Deliveries for Saturday and Sunday must be ordered by Thursday 11:59 PM. For short-notice requests: 0163 6033912.",
  },
  order_in_progress: {
    de: "Ihre Bestellung wird gerade verarbeitet. Bitte warten Sie einen Moment und bestätigen Sie dann erneut.",
    en: "Your order is currently being processed. Please wait a moment and confirm again.",
  },
  session_check_unavailable: {
    de: "Ihre Bestellung konnte gerade nicht sicher fortgesetzt werden. Bitte versuchen Sie es in einer Minute erneut. Ihr Warenkorb bleibt erhalten.",
    en: "Your order could not be safely resumed right now. Please try again in a minute. Your cart has been kept.",
  },
  customer_invalid: {
    de: "Bitte prüfen Sie Ihre Kontaktdaten (Name, E-Mail, Telefon).",
    en: "Please check your contact details (name, email, phone).",
  },
  payment_method_invalid: {
    de: "Die Zahlart ist ungültig. Bitte wählen Sie eine andere Zahlart.",
    en: "The payment method is invalid. Please choose another payment method.",
  },
  gift_not_pending: {
    de: "Die verknüpfte Geschenkkorb-Bestellung ist nicht mehr offen. Bitte laden Sie die Seite neu.",
    en: "The linked gift basket order is no longer open. Please reload the page.",
  },
  gift_email_mismatch: {
    de: "Die E-Mail-Adresse passt nicht zur Geschenkkorb-Bestellung.",
    en: "The email address does not match the gift basket order.",
  },
  gift_not_linked: {
    de: "Die Geschenkkorb-Bestellung gehört nicht zu dieser Bestellung. Bitte laden Sie die Seite neu.",
    en: "The gift basket order does not belong to this order. Please reload the page.",
  },
  gift_hold_expired: {
    de: "Die Reservierung der Geschenkkörbe ist abgelaufen. Bitte laden Sie die Seite neu und bestellen Sie erneut.",
    en: "The reservation of the gift baskets has expired. Please reload the page and order again.",
  },
  gift_order_not_found: {
    de: "Die Geschenkkorb-Bestellung wurde nicht gefunden. Bitte laden Sie die Seite neu.",
    en: "The gift basket order was not found. Please reload the page.",
  },
  order_create_failed: {
    de: "Die Bestellung konnte nicht angelegt werden. Ihr Warenkorb bleibt erhalten, bitte versuchen Sie es erneut.",
    en: "The order could not be created. Your cart has been kept, please try again.",
  },
  payment_failed: {
    de: "Die Zahlung konnte nicht gestartet werden. Ihr Warenkorb bleibt erhalten, bitte versuchen Sie es erneut.",
    en: "Payment could not be started. Your cart has been kept, please try again.",
  },
  rate_limited: {
    de: "Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.",
    en: "Too many requests. Please try again in a minute.",
  },
};

export const orderMessage = (code: OrderErrorCode, lang: Lang): string => ORDER_MESSAGES[code][lang === "en" ? "en" : "de"];

/** Sprache aus dem Request; alles außer "en" wird deutsch (der Checkout kennt nur de und en). */
export const toLang = (v: unknown): Lang => (v === "en" ? "en" : "de");
