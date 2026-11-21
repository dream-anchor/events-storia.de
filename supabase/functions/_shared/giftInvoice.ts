/**
 * Geschenkkorb: Anfrage an create-lexoffice-invoice (Rechnung bezahlter Bestellungen).
 * Mischware: je Korb eine Position pro Steuersatz-Anteil (Steuerberater-Aufteilung `vat_split`);
 * ohne gültige Aufteilung wird KEINE Anfrage gebaut (null) -> Rechnung manuell/nach Klärung.
 */
import { isValidVatSplit, splitGrossByVat, type VatShare } from "./giftPricing.ts";

export interface GiftInvoiceOrder {
  id: string; order_number: string; customer_name: string; customer_email: string; customer_phone: string | null;
  handover: "pickup" | "delivery" | "with_catering"; catering_order_number?: string | null; handover_date: string; handover_time: string | null;
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
    // Mischbestellung: zweite Rechnung zur Catering-Bestellung (keine Liefergebühr, keine Adresse: Lieferung läuft über das Catering)
    notes: [o.handover === "with_catering" ? `Geliefert bzw. abgeholt mit Catering-Bestellung ${o.catering_order_number ?? ""}`.trim() : "", o.gift_message ? `Grußkarte: ${o.gift_message}` : ""].filter(Boolean).join("\n") || undefined,
  };
}

// ── Rechnung anfordern (Webhook UND Ablauf-Sweep) ───────────────────────────
export const GIFT_INVOICE_CLAIM_TTL_MS = 10 * 60_000;

/** true, wenn lexoffice_invoice_id nur ein verwaister Anspruch ist ("pending" ohne Zeit oder "pending:<ms>" älter als TTL). */
export function isStaleInvoiceClaim(v: string, nowMs = Date.now()): boolean {
  if (v === "pending") return true;
  const m = /^pending:(\d+)$/.exec(v);
  return !!m && nowMs - Number(m[1]) > GIFT_INVOICE_CLAIM_TTL_MS;
}

export type GiftInvoiceOutcome =
  | { outcome: "created" }
  | { outcome: "claimed_elsewhere" } // parallele Zustellung/Sweep bearbeitet es schon
  | { outcome: "no_vat_split" } // Steuer-Aufteilung fehlt: Retry sinnlos, manuell
  | { outcome: "failed"; error: string };

// deno-lint-ignore no-explicit-any
type Supa = any;

/**
 * Fordert die LexOffice-Rechnung einer bezahlten Bestellung an. Anspruch mit Zeitstempel (`pending:<ms>`), damit parallele
 * Aufrufe keine zweite Rechnung erzeugen; ein Anspruch älter als GIFT_INVOICE_CLAIM_TTL_MS gilt als verwaist und wird
 * übernommen. Voraussetzung (vom Aufrufer): echte Bestellung (nicht is_test), bezahlt.
 */
export async function ensureGiftInvoice(
  supabase: Supa,
  order: GiftInvoiceOrder & { lexoffice_invoice_id: string | null },
): Promise<GiftInvoiceOutcome> {
  if (order.lexoffice_invoice_id && !isStaleInvoiceClaim(order.lexoffice_invoice_id)) return { outcome: "claimed_elsewhere" };

  const claimToken = `pending:${Date.now()}`;
  let q = supabase.from("gift_orders").update({ lexoffice_invoice_id: claimToken }).eq("id", order.id);
  q = order.lexoffice_invoice_id ? q.eq("lexoffice_invoice_id", order.lexoffice_invoice_id) : q.is("lexoffice_invoice_id", null);
  const { data: claim } = await q.select("id");
  if (!claim || claim.length === 0) return { outcome: "claimed_elsewhere" };

  const release = () => supabase.from("gift_orders").update({ lexoffice_invoice_id: null }).eq("id", order.id).eq("lexoffice_invoice_id", claimToken);
  try {
    const { data: items } = await supabase
      .from("gift_order_items")
      .select("basket_name, variant_label, qty, unit_price_cents, vat_split")
      .eq("order_id", order.id)
      .order("created_at");
    const request = buildGiftInvoiceRequest(order, items ?? []);
    if (!request) {
      await release();
      return { outcome: "no_vat_split" };
    }
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lexoffice-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify(request),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result?.success === false || result?.skipped) {
      throw new Error(`create-lexoffice-invoice: ${res.status} ${JSON.stringify(result).slice(0, 300)}`);
    }
    return { outcome: "created" };
  } catch (e) {
    await release();
    return { outcome: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
