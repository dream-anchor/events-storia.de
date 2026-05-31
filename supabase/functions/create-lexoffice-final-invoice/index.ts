// ════════════════════════════════════════════════════════════════════════════
// CREATE LEXOFFICE FINAL INVOICE (Schlussrechnung)
//
// Erzeugt für einen Auftrag eine Schlussrechnung in LexOffice. Sammelt alle
// bereits in LexOffice angelegten Anzahlungsrechnungen (event_payments mit
// lexoffice_invoice_id) und übergibt sie als negative Abzugszeilen
// (§ 14 Abs. 5 UStG) an create-event-quotation mit forceDocumentType=invoice
// und isFinalInvoice=true.
//
// Idempotent: skippt, wenn v2_events.final_lexoffice_invoice_id schon gesetzt.
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[final-invoice] ${step}${d}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { inquiryId, force } = await req.json();
    if (!inquiryId) throw new Error("inquiryId ist erforderlich");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Idempotenz-Check
    const { data: ev } = await supabase
      .from("v2_events")
      .select("id, final_lexoffice_invoice_id, final_lexoffice_invoice_number")
      .eq("id", inquiryId)
      .single();
    if (ev?.final_lexoffice_invoice_id && !force) {
      log("Final invoice exists — skip (idempotent)", {
        invoiceId: ev.final_lexoffice_invoice_id,
      });
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "already_exists",
          invoiceId: ev.final_lexoffice_invoice_id,
          invoiceNumber: ev.final_lexoffice_invoice_number,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Alle Anzahlungsrechnungen sammeln (deposit + prepayment, paid, mit invoice id)
    const { data: dpPayments } = await supabase
      .from("event_payments")
      .select("id, amount_cents, payment_type, lexoffice_invoice_id, lexoffice_invoice_number, paid_at, created_at")
      .eq("inquiry_id", inquiryId)
      .in("payment_type", ["deposit", "prepayment"])
      .eq("status", "paid")
      .not("lexoffice_invoice_id", "is", null)
      .order("created_at", { ascending: true });

    const deductions = (dpPayments || []).map((p) => ({
      invoice_number: p.lexoffice_invoice_number,
      date_iso: p.paid_at || p.created_at,
      gross: (p.amount_cents || 0) / 100,
      tax_rate: 7, // muss dem Steuersatz der Anzahlungsrechnung entsprechen
    }));

    log("Schlussrechnung wird erzeugt", {
      inquiryId,
      deductionCount: deductions.length,
    });

    // 3. create-event-quotation aufrufen
    const resp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-event-quotation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify({
          inquiryId,
          useSelectedQuantity: true,
          forceDocumentType: "invoice",
          downPaymentDeductions: deductions,
          isFinalInvoice: true,
        }),
      },
    );

    const result = await resp.json();
    if (!resp.ok || !result?.success) {
      throw new Error(result?.error || `create-event-quotation failed: ${resp.status}`);
    }

    // 4. Activity log
    try {
      await supabase.from("activity_logs").insert({
        entity_type: "event_inquiry",
        entity_id: inquiryId,
        action: "final_invoice_created",
        actor_email: "system",
        metadata: {
          invoice_id: result.invoiceId,
          invoice_number: result.invoiceNumber,
          deduction_count: deductions.length,
        },
      });
    } catch { /* non-fatal */ }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        deductionCount: deductions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log("ERROR", { message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
