// Rechnung zur Stripe-Zahlung eines Event-Angebots (Webhook, processEventOfferPaymentInline).
// Anzahlung -> Anzahlungsrechnung über den GEZAHLTEN Betrag (create-lexoffice-downpayment-invoice, nur über die
// v2_payments-Zeile; v2_events bleibt unberührt, damit die Schlussrechnung nicht blockiert).
// Vollzahlung -> Vollrechnung (create-lexoffice-invoice, 70/30-Split für reine Event-Pakete) wie bisher.
// Reine Logik mit injizierbarem fetch/Supabase, damit sie ohne Netz getestet werden kann.
import { shouldSplitOfferAsEventPackage } from "./eventVatSplit.ts";

// deno-lint-ignore no-explicit-any
type Supa = any;

export type OfferPaymentType = "full" | "deposit";

/** Zahlungstyp: Stripe-Metadata zuerst; ohne gültige Metadata gilt ein Betrag unter dem Angebotsbetrag als Anzahlung. */
export function resolveOfferPaymentType(
  metaPaymentType: string | null | undefined,
  amountCents: number,
  fullAmountCents: number,
): OfferPaymentType {
  const meta = (metaPaymentType ?? "").toLowerCase();
  if (meta === "deposit" || meta === "full") return meta;
  return amountCents < fullAmountCents - 1 ? "deposit" : "full";
}

export interface OfferInvoiceInput {
  paymentType: OfferPaymentType;
  paymentId: string;
  event: { id: string; date?: string | null; event_time?: string | null; time_from?: string | null };
  bookingNumber: string;
  customer: { name: string; email: string; phone?: string | null; company?: string | null };
  option: {
    package_id?: string | null;
    label: string;
    guest_count: number;
    amount_total: number;
    offer_mode?: string | null;
    menu_selection?: Record<string, unknown> | null;
    packages?: { package_type?: string | null } | { package_type?: string | null }[] | null;
  };
}

export interface OfferInvoiceDeps {
  fetchFn: typeof fetch;
  supabaseUrl: string;
  serviceKey: string;
  log?: (step: string, details?: Record<string, unknown>) => void;
}

export type OfferInvoiceResult =
  | { kind: "downpayment"; ok: boolean; invoiceId?: string; invoiceNumber?: string | null }
  | { kind: "full"; ok: boolean; invoiceId?: string; documentType?: "invoice" | "quotation" }
  | { kind: "error"; message: string };

function headers(serviceKey: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` };
}

export function buildFullInvoicePayload(input: OfferInvoiceInput) {
  const { event: ev, customer, option, bookingNumber } = input;
  return {
    orderId: ev.id,
    orderNumber: bookingNumber,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone || "",
    companyName: customer.company || undefined,
    billingAddress: { name: customer.company || customer.name, street: "", zip: "", city: "", country: "DE" },
    items: [{
      id: option.package_id || "offer-package", // kein `event-`-Präfix: Split nur über isEventPackage
      // 70/30 nur für reine Event-Pakete ohne Zusatzposten (BMF 22.12.2025); sonst wie bisher 7 %
      isEventPackage: shouldSplitOfferAsEventPackage({
        offerMode: option.offer_mode,
        packageType: Array.isArray(option.packages) ? option.packages[0]?.package_type : option.packages?.package_type,
        menuSelection: option.menu_selection,
      }),
      name: `Event-Paket: ${option.label}`,
      quantity: option.guest_count,
      price: option.amount_total / option.guest_count,
    }],
    subtotal: option.amount_total,
    deliveryCost: 0,
    minimumOrderSurcharge: 0,
    grandTotal: option.amount_total,
    isPickup: false,
    documentType: "invoice",
    isPaid: true,
    desiredDate: ev.date || undefined,
    desiredTime: ev.event_time || ev.time_from || undefined,
    paymentMethod: "stripe",
    isEventBooking: true,
  };
}

/** Nicht-fatal: Fehler werden als Ergebnis zurückgegeben, nie geworfen (Zahlung ist bereits verbucht). */
export async function issueInvoiceForOfferPayment(
  supabase: Supa,
  input: OfferInvoiceInput,
  deps: OfferInvoiceDeps,
): Promise<OfferInvoiceResult> {
  const log = deps.log ?? (() => {});
  try {
    if (input.paymentType === "deposit") {
      const res = await deps.fetchFn(`${deps.supabaseUrl}/functions/v1/create-lexoffice-downpayment-invoice`, {
        method: "POST",
        headers: headers(deps.serviceKey),
        body: JSON.stringify({ payment_id: input.paymentId }),
      });
      if (!res.ok) {
        log("Anzahlungsrechnung failed (non-fatal)", { status: res.status });
        return { kind: "downpayment", ok: false };
      }
      // Die Function antwortet bei Fehlern mit 200 + success:false; sie schreibt die Rechnungs-ID selbst auf v2_payments.
      const body = await res.json().catch(() => ({}));
      const ok = body?.success === true || body?.skipped === true;
      if (!ok) log("Anzahlungsrechnung meldet Fehler (non-fatal)", { error: body?.error });
      return { kind: "downpayment", ok, invoiceId: body?.invoiceId, invoiceNumber: body?.invoiceNumber ?? null };
    }

    const res = await deps.fetchFn(`${deps.supabaseUrl}/functions/v1/create-lexoffice-invoice`, {
      method: "POST",
      headers: headers(deps.serviceKey),
      body: JSON.stringify(buildFullInvoicePayload(input)),
    });
    if (!res.ok) {
      log("LexOffice invoice creation failed (non-fatal)", { status: res.status });
      return { kind: "full", ok: false };
    }
    const result = await res.json();
    const invoiceId = result.invoiceId || result.quotationId;
    if (!invoiceId) return { kind: "full", ok: false };
    const documentType = result.invoiceId ? "invoice" : "quotation";

    await supabase.from("v2_events").update({
      invoice_lexoffice_id: invoiceId,
      invoice_lexoffice_number: result.invoiceNumber || null,
      lexoffice_document_type: documentType,
    }).eq("id", input.event.id);
    await supabase.from("v2_payments").update({
      lexoffice_invoice_id: invoiceId,
      lexoffice_invoice_number: result.invoiceNumber || null,
    }).eq("id", input.paymentId);
    return { kind: "full", ok: true, invoiceId, documentType };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Idempotenz (Webhook-Wiederholung): Zahlung zur Angebotsoption schon verbucht? */
export async function findExistingOfferPayment(supabase: Supa, optionId: string): Promise<{ id: string; event_id: string } | null> {
  const { data } = await supabase
    .from("v2_payments")
    .select("id, event_id")
    .eq("source_offer_option_id", optionId)
    .maybeSingle();
  return data ?? null;
}

export type InsertOfferPaymentResult =
  | { status: "created"; paymentId: string }
  | { status: "duplicate" } // Unique-Verletzung (23505): paralleler Lauf war schneller -> keine zweite Rechnung
  | { status: "error"; message: string };

export async function insertOfferPayment(supabase: Supa, row: Record<string, unknown>): Promise<InsertOfferPaymentResult> {
  const { data, error } = await supabase.from("v2_payments").insert(row).select().single();
  if (error) {
    return error.code === "23505" ? { status: "duplicate" } : { status: "error", message: error.message };
  }
  return { status: "created", paymentId: data.id };
}
