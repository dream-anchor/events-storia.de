// Schlussrechnung: Anzahlungsabzüge und Bestandsprüfung. Reine Logik, Supabase injiziert.
// Quelle der Anzahlungen ist v2_payments (die Tabelle, in die Webhook und Admin schreiben). Die frühere Tabelle
// event_payments wurde am 22.04.2026 zu _legacy_event_payments und ist seither eine View auf v2_payments.
// deno-lint-ignore no-explicit-any
type Supa = any;

export interface DownPaymentRow {
  id: string;
  amount_cents: number | null;
  payment_type: string;
  lexoffice_invoice_id: string | null;
  lexoffice_invoice_number: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Deduction {
  invoice_number: string | null;
  date_iso: string;
  gross: number;
  tax_rate: number;
}

export const DOWNPAYMENT_TAX_RATE = 7; // muss dem Steuersatz der Anzahlungsrechnung entsprechen (downpayment-invoice)

export function toDeductions(rows: DownPaymentRow[]): Deduction[] {
  const seen = new Set<string>();
  const out: Deduction[] = [];
  for (const p of rows) {
    if (!p.lexoffice_invoice_id || seen.has(p.lexoffice_invoice_id)) continue; // eine Rechnung nie doppelt abziehen
    seen.add(p.lexoffice_invoice_id);
    out.push({
      invoice_number: p.lexoffice_invoice_number,
      date_iso: p.paid_at || p.created_at,
      gross: (p.amount_cents || 0) / 100,
      tax_rate: DOWNPAYMENT_TAX_RATE,
    });
  }
  return out;
}

export async function loadDownPaymentDeductions(supabase: Supa, eventId: string): Promise<Deduction[]> {
  const { data } = await supabase
    .from("v2_payments")
    .select("id, amount_cents, payment_type, lexoffice_invoice_id, lexoffice_invoice_number, paid_at, created_at")
    .eq("event_id", eventId)
    .in("payment_type", ["deposit", "prepayment"])
    .eq("status", "paid")
    .not("lexoffice_invoice_id", "is", null)
    .order("created_at", { ascending: true });
  return toDeductions((data || []) as DownPaymentRow[]);
}

/** Bereits vorhandene End-/Standardrechnung. Eine Anzahlung setzt v2_events.invoice_lexoffice_id/lexoffice_document_type nicht mehr. */
export function findExistingFinalInvoice(ev: {
  final_lexoffice_invoice_id?: string | null;
  final_lexoffice_invoice_number?: string | null;
  invoice_lexoffice_id?: string | null;
  invoice_lexoffice_number?: string | null;
  lexoffice_document_type?: string | null;
} | null | undefined): { id: string; number: string | null } | null {
  const isInvoice = ev?.lexoffice_document_type === "invoice";
  const id = ev?.final_lexoffice_invoice_id || (isInvoice ? ev?.invoice_lexoffice_id : null);
  if (!id) return null;
  return { id, number: ev?.final_lexoffice_invoice_number || (isInvoice ? ev?.invoice_lexoffice_number ?? null : null) };
}
