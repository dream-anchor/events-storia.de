/**
 * Geschenkkorb: Anfrage an create-lexoffice-invoice (Rechnung bezahlter Bestellungen).
 * Mischware: je Korb eine Position pro Steuersatz-Anteil (Steuerberater-Aufteilung `vat_split`);
 * ohne gültige Aufteilung wird KEINE Anfrage gebaut (null) -> Rechnung manuell/nach Klärung.
 */
import { isValidVatSplit, splitGrossByVat, type VatShare } from "./giftPricing.ts";

export interface GiftInvoiceOrder {
  id: string; order_number: string; customer_name: string; customer_email: string; customer_phone: string | null;
  handover: "pickup" | "delivery"; handover_date: string; handover_time: string | null;
  delivery_street: string | null; delivery_zip: string | null; delivery_city: string | null;
  distance_km: number | null; delivery_fee_cents: number; delivery_vat_rate: number | null; total_cents: number;
  gift_message: string | null;
}
export interface GiftInvoiceItem { basket_name: string; variant_label: string; qty: number; unit_price_cents: number; vat_split: unknown }

const eur = (c: number) => Math.round(c) / 100;

export function buildGiftInvoiceRequest(o: GiftInvoiceOrder, items: GiftInvoiceItem[]): Record<string, unknown> | null {
  const invoiceItems: Record<string, unknown>[] = [];
  for (const it of items) {
    if (!isValidVatSplit(it.vat_split)) return null;
    const parts = splitGrossByVat(it.unit_price_cents, it.vat_split as VatShare[]);
    parts.forEach((p, idx) => {
      if (p.gross_cents === 0) return;
      invoiceItems.push({
        id: `${o.order_number}-${invoiceItems.length + 1}`,
        name: `${it.basket_name} – ${it.variant_label}${parts.length > 1 ? ` (Anteil ${idx + 1}/${parts.length}, ${p.rate} % MwSt.)` : ""}`,
        quantity: it.qty,
        price: eur(p.gross_cents), // Brutto je Stück; Satz je Position
        taxRatePercentage: p.rate,
      });
    });
  }
  const subtotalCents = items.reduce((s, i) => s + i.unit_price_cents * i.qty, 0);
  const address = o.handover === "delivery" ? `${o.delivery_street}\n${o.delivery_zip} ${o.delivery_city}` : undefined;
  return {
    orderType: "gift_basket",
    orderId: o.id,
    orderNumber: o.order_number,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone ?? "",
    billingAddress: { name: o.customer_name, street: o.delivery_street ?? "", zip: o.delivery_zip ?? "", city: o.delivery_city ?? "", country: "DE" },
    items: invoiceItems,
    subtotal: eur(subtotalCents),
    deliveryCost: eur(o.delivery_fee_cents),
    deliveryTaxRatePercentage: o.delivery_vat_rate ?? 19,
    minimumOrderSurcharge: 0,
    distanceKm: o.distance_km ?? undefined,
    grandTotal: eur(o.total_cents),
    isPickup: o.handover === "pickup",
    documentType: "invoice",
    isPaid: true,
    paymentMethod: "stripe",
    desiredDate: o.handover_date,
    desiredTime: o.handover === "pickup" ? o.handover_time ?? undefined : undefined,
    deliveryAddress: address,
    notes: o.gift_message ? `Grußkarte: ${o.gift_message}` : undefined,
  };
}
