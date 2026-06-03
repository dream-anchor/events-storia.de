// ════════════════════════════════════════════════════════════════════════════
// LIST LEXOFFICE DOCUMENTS
//
// Sammelt alle LexOffice-Belege zu einem Auftrag (v2_events + v2_payments)
// und reichert sie mit Metadaten (Nummer, Datum, Brutto, Status) aus LexOffice an.
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

type Kind = "final" | "standard" | "deposit" | "quotation";
type DocType = "invoice" | "quotation";

interface SendEvent {
  to: string;
  sent_at: string;
  message_id?: string | null;
}

interface LexDoc {
  id: string;
  type: DocType;
  kind: Kind;
  number: string | null;
  date: string | null;
  gross: number | null;
  status: string | null;
  paymentId?: string | null;
  sends?: SendEvent[];
}

const KIND_ORDER: Record<Kind, number> = { quotation: 0, deposit: 1, standard: 2, final: 3 };

async function fetchVoucherMeta(
  apiKey: string,
  id: string,
  type: DocType,
): Promise<Partial<LexDoc>> {
  const endpoint = type === "invoice" ? "invoices" : "quotations";
  try {
    const res = await fetch(`https://api.lexoffice.io/v1/${endpoint}/${id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      await res.text();
      return { number: null, date: null, gross: null, status: "unknown" };
    }
    const data = await res.json();
    return {
      number: data?.voucherNumber ?? null,
      date: data?.voucherDate ?? null,
      gross: data?.totalPrice?.totalGrossAmount ?? null,
      status: data?.voucherStatus ?? null,
    };
  } catch (e) {
    console.error(`[list-lexoffice-documents] fetch ${type} ${id} failed`, e);
    return { number: null, date: null, gross: null, status: "error" };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await requireAuth(req);

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LEXOFFICE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ev } = await admin
      .from("v2_events")
      .select(
        "id, booking_number, final_lexoffice_invoice_id, invoice_lexoffice_id, lexoffice_quotation_id, lexoffice_document_type",
      )
      .eq("id", orderId)
      .maybeSingle();

    const { data: payments } = await admin
      .from("v2_payments")
      .select("id, lexoffice_invoice_id, payment_type")
      .eq("event_id", orderId)
      .not("lexoffice_invoice_id", "is", null);

    const seen = new Set<string>();
    const tasks: Array<{ entry: LexDoc; meta: Promise<Partial<LexDoc>> }> = [];

    const push = (entry: LexDoc) => {
      const key = `${entry.type}:${entry.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      tasks.push({ entry, meta: fetchVoucherMeta(apiKey, entry.id, entry.type) });
    };

    if (ev?.final_lexoffice_invoice_id) {
      push({
        id: ev.final_lexoffice_invoice_id,
        type: "invoice",
        kind: "final",
        number: null,
        date: null,
        gross: null,
        status: null,
      });
    }
    if (
      ev?.invoice_lexoffice_id &&
      ev.invoice_lexoffice_id !== ev.final_lexoffice_invoice_id &&
      ev.invoice_lexoffice_id !== ev.lexoffice_quotation_id
    ) {
      push({
        id: ev.invoice_lexoffice_id,
        type: "invoice",
        kind: "standard",
        number: null,
        date: null,
        gross: null,
        status: null,
      });
    }
    for (const p of payments ?? []) {
      if (!p.lexoffice_invoice_id) continue;
      push({
        id: p.lexoffice_invoice_id,
        type: "invoice",
        kind: "deposit",
        number: null,
        date: null,
        gross: null,
        status: null,
        paymentId: p.id,
      });
    }
    if (ev?.lexoffice_quotation_id) {
      push({
        id: ev.lexoffice_quotation_id,
        type: "quotation",
        kind: "quotation",
        number: null,
        date: null,
        gross: null,
        status: null,
      });
    }

    const metas = await Promise.all(tasks.map((t) => t.meta));
    const docs: LexDoc[] = tasks.map((t, i) => ({ ...t.entry, ...metas[i] }));

    // Versand-Historie pro Beleg aus email_delivery_logs (Angebote) + activity_logs (Rechnungen)
    const quotationIds = docs.filter((d) => d.type === "quotation").map((d) => d.id);
    const invoiceIds = docs.filter((d) => d.type === "invoice").map((d) => d.id);

    const sendsByDocId = new Map<string, SendEvent[]>();

    if (quotationIds.length > 0) {
      const { data: offerSends } = await admin
        .from("email_delivery_logs")
        .select("recipient_email, sent_at, provider_message_id, metadata")
        .eq("entity_type", "v2_event")
        .eq("entity_id", orderId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false });
      for (const row of offerSends ?? []) {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const quotId = meta.lexoffice_quotation_id as string | null | undefined;
        if (!quotId || !quotationIds.includes(quotId)) continue;
        const list = sendsByDocId.get(quotId) ?? [];
        list.push({
          to: row.recipient_email,
          sent_at: row.sent_at,
          message_id: row.provider_message_id ?? null,
        });
        sendsByDocId.set(quotId, list);
      }
    }

    if (invoiceIds.length > 0) {
      const { data: invoiceSends } = await admin
        .from("activity_logs")
        .select("created_at, metadata")
        .eq("entity_type", "v2_event")
        .eq("entity_id", orderId)
        .eq("action", "invoice_email_sent")
        .order("created_at", { ascending: false });
      for (const row of invoiceSends ?? []) {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const invId = meta.lexoffice_invoice_id as string | null | undefined;
        if (!invId || !invoiceIds.includes(invId)) continue;
        const list = sendsByDocId.get(invId) ?? [];
        list.push({
          to: (meta.recipient as string) ?? "",
          sent_at: row.created_at as string,
          message_id: (meta.resend_message_id as string | null) ?? null,
        });
        sendsByDocId.set(invId, list);
      }
    }

    for (const d of docs) {
      d.sends = sendsByDocId.get(d.id) ?? [];
    }

    docs.sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      if (da !== db) return da - db;
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    });

    return new Response(
      JSON.stringify({ docs, bookingNumber: ev?.booking_number ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[list-lexoffice-documents]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});