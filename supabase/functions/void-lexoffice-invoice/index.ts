// ════════════════════════════════════════════════════════════════════════════
// VOID LEXOFFICE INVOICE
//
// Versucht eine LexOffice-Rechnung zu stornieren. Finalisierte Rechnungen
// können nicht direkt gevoided werden — dann wird automatisch eine Gutschrift
// (credit-note) als Gegenbeleg erzeugt. Anschließend werden die referenzierenden
// Spalten in Maestro (v2_events / v2_payments) zurückgesetzt.
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (auth.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin-Rechte erforderlich" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, voucherId } = await req.json();
    if (!orderId || !voucherId) {
      return new Response(
        JSON.stringify({ error: "orderId und voucherId erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    // 1. Rechnung laden, um Status & Daten zu kennen
    const invRes = await fetch(`https://api.lexoffice.io/v1/invoices/${voucherId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!invRes.ok) {
      const t = await invRes.text();
      return new Response(
        JSON.stringify({ error: `LexOffice-Rechnung nicht abrufbar: ${t}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const inv = await invRes.json();
    const oldStatus: string | null = inv?.voucherStatus ?? null;
    const oldNumber: string | null = inv?.voucherNumber ?? null;

    let creditNoteId: string | null = null;
    let creditNoteNumber: string | null = null;
    let action: "voided" | "credit_noted" = "voided";

    if (oldStatus === "voided") {
      // Bereits storniert — nur DB bereinigen
      action = "voided";
    } else if (oldStatus === "draft") {
      // Drafts können direkt voided werden via DELETE
      const del = await fetch(`https://api.lexoffice.io/v1/invoices/${voucherId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!del.ok) {
        const t = await del.text();
        return new Response(
          JSON.stringify({ error: `Voiding fehlgeschlagen: ${t}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      action = "voided";
    } else {
      // Finalisiert → Gutschrift als Gegenbeleg erzeugen
      const cnBody = {
        voucherDate: new Date().toISOString(),
        address: inv.address,
        lineItems: (inv.lineItems ?? []).map((li: Record<string, unknown>) => ({
          type: li.type,
          name: li.name,
          description: li.description,
          quantity: li.quantity,
          unitName: li.unitName,
          unitPrice: li.unitPrice,
          discountPercentage: li.discountPercentage,
        })),
        totalPrice: { currency: inv?.totalPrice?.currency ?? "EUR" },
        taxConditions: inv.taxConditions,
        title: "Gutschrift",
        introduction: `Stornogutschrift zur Rechnung ${oldNumber ?? voucherId}`,
        remark: `Stornogutschrift zur Rechnung ${oldNumber ?? voucherId}`,
      };
      const cnRes = await fetch(
        "https://api.lexoffice.io/v1/credit-notes?finalize=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(cnBody),
        },
      );
      if (!cnRes.ok) {
        const t = await cnRes.text();
        return new Response(
          JSON.stringify({ error: `Gutschrift konnte nicht erstellt werden: ${t}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const cn = await cnRes.json();
      creditNoteId = cn?.id ?? null;
      creditNoteNumber = cn?.resourceUri ?? null;
      action = "credit_noted";
    }

    // 2. Maestro-Spalten zurücksetzen, je nach Quelle
    let cleared: string[] = [];

    const { data: ev } = await admin
      .from("v2_events")
      .select(
        "final_lexoffice_invoice_id, invoice_lexoffice_id, lexoffice_quotation_id",
      )
      .eq("id", orderId)
      .maybeSingle();

    const updates: Record<string, unknown> = {};
    if (ev?.final_lexoffice_invoice_id === voucherId) {
      updates.final_lexoffice_invoice_id = null;
      updates.final_lexoffice_invoice_number = null;
      cleared.push("final");
    }
    if (ev?.invoice_lexoffice_id === voucherId) {
      updates.invoice_lexoffice_id = null;
      updates.invoice_lexoffice_number = null;
      updates.lexoffice_document_type = null;
      cleared.push("standard");
    }
    if (Object.keys(updates).length > 0) {
      await admin.from("v2_events").update(updates).eq("id", orderId);
    }

    const { data: matchedPayments } = await admin
      .from("v2_payments")
      .update({
        lexoffice_invoice_id: null,
        lexoffice_invoice_number: null,
      })
      .eq("event_id", orderId)
      .eq("lexoffice_invoice_id", voucherId)
      .select("id");
    if ((matchedPayments?.length ?? 0) > 0) cleared.push("deposit");

    // 3. Activity log
    try {
      await admin.from("activity_logs").insert({
        entity_type: "event_inquiry",
        entity_id: orderId,
        action: "invoice_voided",
        actor_id: auth.userId,
        actor_email: auth.email,
        metadata: {
          voucher_id: voucherId,
          voucher_number: oldNumber,
          previous_status: oldStatus,
          action,
          credit_note_id: creditNoteId,
          credit_note_number: creditNoteNumber,
          cleared_columns: cleared,
        },
      });
    } catch { /* non-fatal */ }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        creditNoteId,
        creditNoteNumber,
        cleared,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[void-lexoffice-invoice]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});