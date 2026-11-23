// Netto-Anzeige: reine Rechenhelfer ohne React (auch in Tests nutzbar). Nur Anzeige, der Zahlbetrag bleibt immer der Server-Brutto-Betrag.
import { formatEuroTruncated } from "@/lib/gift/mixedCart";
import type { OrderQuote } from "@/lib/orderQuote";

/** Steuersätze (wie PriceDisplayContext.VAT_RATES, hier gespiegelt, damit dieses Modul ohne React auskommt). */
const RATE_FOOD = 0.07;
const RATE_DRINKS = 0.19;
const RATE_DELIVERY = 0.19;
/** Event-Pakete: 70 % Speisen (7 %) / 30 % Getränke (19 %) */
const PACKAGE_FOOD_PORTION = 0.7;

/** Euro in ganze Cent runden (Float-Rauschen entfernen). */
export const toCents = (euro: number): number => Math.round(euro * 100);

/**
 * Cent-Aufteilung des Catering-Betrags (brutto) in Steuerbeträge und Netto-Summe.
 * Die Steuerbeträge werden je auf den Cent gerundet, die Netto-Summe ist der REST (Brutto minus Steuer),
 * damit Netto + MwSt. immer genau den Zahlbetrag ergeben.
 */
export function splitNetCents(grandTotal: number, vat7Food: number, vat19Drinks: number, vat19Delivery: number) {
  const vat7C = toCents(vat7Food);
  const vat19C = toCents(vat19Drinks + vat19Delivery);
  const netC = toCents(grandTotal) - vat7C - vat19C;
  return { vat7C, vat19C, netC };
}

/** Netto-Cents einer einzelnen Zeile (brutto, Steuersatz), auf den Cent gerundet. */
export const lineNetCents = (gross: number, vatRate: number): number => Math.round((gross / (1 + vatRate)) * 100);

/**
 * Netto-Zwischensumme der Catering-Positionen als REST aus dem Netto-Gesamtbetrag (netC):
 * netC minus die einzeln gerundeten Netto-Zeilen (Aufschlag, Chafing Dish, Lieferung), damit Zeilen und Summe aufgehen.
 * Nie negativ (zwischen zwei Angeboten können Teile aus unterschiedlichen Ständen stammen).
 */
export const subtotalNetCents = (netC: number, otherNetCents: number[]): number =>
  Math.max(0, netC - otherNetCents.reduce((sum, c) => sum + c, 0));

/** Cent-Betrag als deutsch formatierter Euro-String (abgeschnitten, wie die übrigen Anzeigen). */
export const formatCents = (cents: number): string => formatEuroTruncated(cents / 100);

/** Steuergrundlagen und Netto-Aufschlüsselung EINES Server-Angebots: alles aus derselben Quelle wie `quote.totalCents`. */
export interface QuoteNetBreakdown {
  grandTotal: number;
  vat7Food: number;
  vat19Drinks: number;
  vat19Delivery: number;
  /** Netto-Gesamtbetrag (Rest aus Brutto minus gerundete Steuer) in Cent */
  netC: number;
  /** Netto-Zwischensumme der Positionen (ohne Aufschlag, Lieferung und im Checkout gebuchtes Chafing) in Cent */
  subtotalNetC: number;
  surchargeNetC: number;
  deliveryNetC: number;
  /** Chafing Dish, im Checkout dazugebucht (eigene Zeile, nicht in der Zwischensumme) */
  chafingNetC: number;
}

export function quoteNetBreakdown(quote: Pick<OrderQuote, "lines" | "surchargeCents" | "deliveryCents" | "totalCents">): QuoteNetBreakdown {
  let vat7 = 0;
  let vat19Drinks = 0;
  for (const line of quote.lines) {
    const gross = line.lineCents / 100;
    if (line.kind === "event_package") {
      const food = gross * PACKAGE_FOOD_PORTION;
      const drinks = gross - food;
      vat7 += food - food / (1 + RATE_FOOD);
      vat19Drinks += drinks - drinks / (1 + RATE_DRINKS);
    } else {
      vat7 += gross - gross / (1 + RATE_FOOD);
    }
  }
  const surcharge = quote.surchargeCents / 100;
  vat7 += surcharge - surcharge / (1 + RATE_FOOD);
  const delivery = quote.deliveryCents / 100;
  const vat19Delivery = delivery - delivery / (1 + RATE_DELIVERY);
  const grandTotal = quote.totalCents / 100;
  const { netC } = splitNetCents(grandTotal, vat7, vat19Drinks, vat19Delivery);
  const chafingNetC = quote.lines
    .filter(l => l.kind === "chafing_checkout")
    .reduce((sum, l) => sum + lineNetCents(l.lineCents / 100, RATE_FOOD), 0);
  const surchargeNetC = lineNetCents(surcharge, RATE_FOOD);
  const deliveryNetC = lineNetCents(delivery, RATE_DELIVERY);
  return {
    grandTotal,
    vat7Food: vat7,
    vat19Drinks,
    vat19Delivery,
    netC,
    subtotalNetC: subtotalNetCents(netC, [surchargeNetC, chafingNetC, deliveryNetC]),
    surchargeNetC,
    deliveryNetC,
    chafingNetC,
  };
}
