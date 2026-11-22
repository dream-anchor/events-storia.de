/**
 * Aufrufe der Bestell-Edge-Functions aus dem Checkout (Abdichtung 22.11.2026).
 * `quote-catering-order`: Server-Angebot (nur lesen). `create-catering-payment` (mode 'create'): legt Bestellung/Buchung am Server an
 * und startet die Zahlung. Der Browser schickt nur IDs, Mengen, Adresse und Kundendaten, nie Beträge, die gespeichert werden;
 * `expectedTotalCents` ist der Betrag, den der Kunde zuletzt gesehen hat (Abgleich, keine Preisquelle).
 */
import { supabase } from '@/integrations/supabase/client';
import type { OrderQuote } from '@/lib/orderQuote';

export interface QuoteItemInput {
  id: string;
  quantity: number;
  price: number;
  name: string;
  name_en: string | null;
}

export interface QuoteParams {
  items: QuoteItemInput[];
  chafingQuantity: number;
  deliveryType: 'delivery' | 'pickup' | 'event';
  address: { street: string; zip: string; city: string };
  language: 'de' | 'en';
}

export type QuoteResult =
  | { ok: true; quote: OrderQuote }
  | { ok: false; code: string; message: string };

interface ErrorBody {
  error?: string;
  message?: string;
  quote?: OrderQuote;
}

/** Fehlerantwort einer Edge Function lesen (FunctionsHttpError trägt die Response in error.context). */
async function readErrorBody(error: unknown): Promise<ErrorBody> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      return (await ctx.json()) as ErrorBody;
    } catch {
      /* kein JSON */
    }
  }
  return {};
}

const networkMessage = (lang: 'de' | 'en') =>
  lang === 'de'
    ? 'Die Verbindung zum Server ist fehlgeschlagen. Ihr Warenkorb bleibt erhalten, bitte versuchen Sie es erneut.'
    : 'The connection to the server failed. Your cart has been kept, please try again.';

export async function fetchOrderQuote(params: QuoteParams): Promise<QuoteResult> {
  try {
    const { data, error } = await supabase.functions.invoke('quote-catering-order', { body: params });
    if (error) {
      const body = await readErrorBody(error);
      return { ok: false, code: body.error ?? 'network_error', message: body.message ?? networkMessage(params.language) };
    }
    if (!data?.ok || !data.quote) {
      return { ok: false, code: data?.error ?? 'invalid_request', message: data?.message ?? networkMessage(params.language) };
    }
    return { ok: true, quote: data.quote as OrderQuote };
  } catch {
    return { ok: false, code: 'network_error', message: networkMessage(params.language) };
  }
}

export interface CreateOrderParams extends QuoteParams {
  expectedTotalCents: number;
  orderNumber: string;
  customer: { name: string; email: string; phone: string; company: string };
  /** Adressdetails (Stockwerk, Aufzug) und der zusammengesetzte Adresstext für Lieferschein/Mails */
  addressDetails: { floor: string; hasElevator: boolean };
  deliveryAddressText: string | null;
  date: string;
  time: string;
  notes: string;
  billing: { name: string; street: string; zip: string; city: string; country: string };
  referenceNumber: string;
  paymentMethod: 'stripe' | 'billie';
  giftOrderNumber?: string;
}

export type CreateResult =
  | { ok: true; url: string; orderNumber: string; quote: OrderQuote | null }
  /** `quote_changed`: nichts wurde angelegt; `quote` ist das neue Angebot, der Kunde bestätigt den neuen Betrag erneut */
  | { ok: false; code: string; message: string; quote?: OrderQuote };

export async function createOrderAndPay(p: CreateOrderParams): Promise<CreateResult> {
  const body = {
    mode: 'create',
    language: p.language,
    expectedTotalCents: p.expectedTotalCents,
    orderNumber: p.orderNumber,
    customer: p.customer,
    deliveryType: p.deliveryType,
    address: { ...p.address, floor: p.addressDetails.floor, hasElevator: p.addressDetails.hasElevator },
    deliveryAddressText: p.deliveryAddressText,
    items: p.items,
    chafingQuantity: p.chafingQuantity,
    date: p.date,
    time: p.time,
    notes: p.notes,
    billing: p.billing,
    referenceNumber: p.referenceNumber,
    paymentMethod: p.paymentMethod,
    ...(p.giftOrderNumber ? { giftOrderNumber: p.giftOrderNumber } : {}),
  };
  try {
    const { data, error } = await supabase.functions.invoke('create-catering-payment', { body });
    if (error) {
      const e = await readErrorBody(error);
      return { ok: false, code: e.error ?? 'network_error', message: e.message ?? networkMessage(p.language), quote: e.quote };
    }
    if (!data?.url) return { ok: false, code: 'payment_failed', message: data?.message ?? networkMessage(p.language) };
    return { ok: true, url: data.url as string, orderNumber: String(data.orderNumber ?? p.orderNumber), quote: (data.quote as OrderQuote | undefined) ?? null };
  } catch {
    return { ok: false, code: 'network_error', message: networkMessage(p.language) };
  }
}
