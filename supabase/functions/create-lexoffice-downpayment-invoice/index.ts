// ════════════════════════════════════════════════════════════════════════════
// CREATE LEXOFFICE DOWN-PAYMENT INVOICE (Anzahlungsrechnung)
//
// Triggered after an event_payments row with payment_type ∈ {deposit,prepayment}
// is marked as paid. Creates a UStG-konforme Anzahlungsrechnung in LexOffice
// (Brutto, USt separat ausgewiesen, Bezug zum Veranstaltungsdatum) and stores
// the resulting invoice ID + number back on the event_payments row.
// Idempotent: skips if the payment already has a lexoffice_invoice_id.
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  loadBusinessData,
  resolveBillingAddress,
} from "../_shared/addressResolver.ts";

const FOOD_TAX_RATE = 7;

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[downpayment-invoice] ${step}${d}`);
};

function formatDateDE(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) throw new Error("payment_id ist erforderlich");

    const lexofficeApiKey = Deno.env.get("LEXOFFICE_API_KEY");
    if (!lexofficeApiKey) throw new Error("LEXOFFICE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Payment laden (über event_payments_enriched für Customer-Felder)
    const { data: payment, error: payErr } = await supabase
      .from("event_payments_enriched")
      .select("*")
      .eq("id", payment_id)
      .single();

    if (payErr || !payment) throw new Error(`Payment nicht gefunden: ${payErr?.message}`);

    // 2. Validierungen
    if (payment.status !== "paid") {
      log("Payment not paid yet — skip", { status: payment.status });
      return new Response(JSON.stringify({ skipped: true, reason: "not_paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payment.lexoffice_invoice_id) {
      log("Already has lexoffice invoice — skip (idempotent)", {
        invoice_id: payment.lexoffice_invoice_id,
      });
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_exists", invoiceId: payment.lexoffice_invoice_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!["deposit", "prepayment"].includes(payment.payment_type)) {
      log("Not a down-payment type — skip", { payment_type: payment.payment_type });
      return new Response(JSON.stringify({ skipped: true, reason: "wrong_type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Inquiry laden für Adresse + Event-Daten
    const { data: inquiry, error: inqErr } = await supabase
      .from("event_inquiries")
      .select("*")
      .eq("id", payment.inquiry_id)
      .single();
    if (inqErr || !inquiry) throw new Error(`Inquiry nicht gefunden: ${inqErr?.message}`);

    // 4. Anzahlungs-Index ermitteln (1. / 2. / 3. ...)
    const { data: priorPayments } = await supabase
      .from("event_payments")
      .select("id, created_at, payment_type")
      .eq("inquiry_id", payment.inquiry_id)
      .in("payment_type", ["deposit", "prepayment"])
      .order("created_at", { ascending: true });
    const index =
      (priorPayments || []).findIndex((p: { id: string }) => p.id === payment_id) + 1 || 1;

    // 5. Adresse auflösen
    const businessData = await loadBusinessData(supabase);
    const billing = resolveBillingAddress(inquiry as never);
    const addressBlock = {
      name: billing.name || inquiry.contact_name,
      supplement:
        billing.name && inquiry.contact_name && billing.name !== inquiry.contact_name
          ? inquiry.contact_name
          : undefined,
      street: billing.street || "",
      zip: billing.postalCode || "",
      city: billing.city || "",
      countryCode: billing.countryCode,
    };

    // 6. Line item — einzelne Brutto-Position
    const grossAmount = (payment.amount_cents || 0) / 100;
    const eventDateDE = formatDateDE(payment.preferred_date || payment.event_date);
    const eventLabel = payment.event_type || "Veranstaltung";
    const titlePrefix = index === 1 ? "Anzahlung" : `${index}. Anzahlung`;

    const lineItem = {
      type: "custom",
      name: `${titlePrefix} für ${eventLabel}${eventDateDE ? ` am ${eventDateDE}` : ""}`,
      description: [
        `Anzahlung gemäß Auftrag${eventDateDE ? ` vom ${eventDateDE}` : ""}.`,
        "Die zugrunde liegenden Leistungen werden zum Veranstaltungstermin erbracht.",
        "Eine vollständige Aufstellung erhalten Sie mit der Schlussrechnung.",
      ].join(" "),
      quantity: 1,
      unitName: "Pauschale",
      unitPrice: {
        currency: "EUR",
        grossAmount,
        taxRatePercentage: FOOD_TAX_RATE, // Catering-Hauptsteuersatz; Schlussrechnung gleicht etwaige Differenzen aus
      },
    };

    // 7. Introduction & Remark
    const introduction = [
      `Anzahlungsrechnung zu Ihrer Buchung${eventDateDE ? ` für die Veranstaltung am ${eventDateDE}` : ""}.`,
      payment.guest_count ? `Gäste: ${payment.guest_count}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const paidAtDE = formatDateDE(payment.paid_at);
    const remark = [
      `Bereits bezahlt${paidAtDE ? ` am ${paidAtDE}` : ""} via ${payment.paid_via || "Online-Zahlung"}.`,
      "Die in dieser Anzahlung enthaltene Umsatzsteuer wird in der Schlussrechnung explizit abgezogen (§ 14 Abs. 5 UStG).",
      "",
      `Veranstaltungsort: ${[
        inquiry.location_name,
        inquiry.location_street,
        inquiry.location_postal_code && inquiry.location_city
          ? `${inquiry.location_postal_code} ${inquiry.location_city}`
          : "",
      ]
        .filter(Boolean)
        .join(", ") || "siehe Auftrag"}`,
    ].join("\n");

    // 8. Document payload
    const eventDateISO = payment.preferred_date || payment.event_date;
    const documentPayload = {
      voucherDate: new Date().toISOString(),
      address: addressBlock,
      lineItems: [lineItem],
      totalPrice: { currency: "EUR" },
      taxConditions: { taxType: "gross" as const },
      shippingConditions: {
        shippingType: "service" as const,
        shippingDate: eventDateISO
          ? new Date(`${eventDateISO}T12:00:00Z`).toISOString()
          : new Date().toISOString(),
      },
      paymentConditions: {
        paymentTermLabel: `Bereits bezahlt${paidAtDE ? ` am ${paidAtDE}` : ""} – Vielen Dank!`,
        paymentTermDuration: 0,
      },
      introduction,
      remark,
      title: index === 1 ? "Anzahlungsrechnung" : `${index}. Anzahlungsrechnung`,
    };

    log("Creating LexOffice invoice", {
      inquiry_id: payment.inquiry_id,
      gross: grossAmount,
      index,
    });

    const response = await fetch("https://api.lexoffice.io/v1/invoices?finalize=true", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lexofficeApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(documentPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LexOffice API error: ${response.status} – ${errText}`);
    }

    const result = await response.json();
    const invoiceId = result?.id as string | undefined;
    const invoiceNumber = (result?.voucherNumber || result?.invoiceNumber || null) as string | null;
    log("LexOffice invoice created", { invoiceId, invoiceNumber });

    if (!invoiceId) throw new Error("LexOffice returned no invoice id");

    // 9. Persistieren — direkt auf v2_payments schreiben (event_payments-View hat
    //    INSTEAD OF UPDATE Trigger, der diese Felder mappt).
    const { error: updErr } = await supabase
      .from("v2_payments")
      .update({
        lexoffice_invoice_id: invoiceId,
        lexoffice_invoice_number: invoiceNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment_id);
    if (updErr) log("Failed to persist invoice id", { error: updErr.message });

    // 10. Activity log
    try {
      await supabase.from("activity_logs").insert({
        entity_type: "event_inquiry",
        entity_id: payment.inquiry_id,
        action: "downpayment_invoice_created",
        actor_email: "system",
        metadata: {
          payment_id,
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          gross_amount: grossAmount,
          index,
        },
      });
    } catch { /* non-fatal */ }

    // 11. PDF an Kunde mailen — non-blocking fire-and-forget
    (async () => {
      try {
        const pdfResp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/get-lexoffice-document-by-id`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ voucherId: invoiceId, voucherType: "invoice" }),
          },
        );
        if (!pdfResp.ok) {
          log("PDF fetch failed (non-fatal)", { status: pdfResp.status });
          return;
        }
        const pdfJson = await pdfResp.json();
        const pdfBase64 = pdfJson.pdf;
        const filename =
          pdfJson.filename || `STORIA_Anzahlungsrechnung_${invoiceNumber || invoiceId}.pdf`;
        if (!pdfBase64) return;

        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) return;

        const subject = `Ihre Anzahlungsrechnung${invoiceNumber ? ` ${invoiceNumber}` : ""} | STORIA Events`;
        const html = `<!DOCTYPE html><html lang="de"><body style="font-family:Arial,sans-serif;color:#333;font-size:15px;line-height:1.6;">
<p>Guten Tag ${payment.customer_name || ""},</p>
<p>vielen Dank für Ihre Anzahlung${paidAtDE ? ` vom ${paidAtDE}` : ""}.<br/>
Im Anhang finden Sie Ihre Anzahlungsrechnung${invoiceNumber ? ` Nr. <strong>${invoiceNumber}</strong>` : ""} über <strong>${grossAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong>.</p>
<p>Die in dieser Anzahlung enthaltene Umsatzsteuer wird in Ihrer Schlussrechnung nach der Veranstaltung gemäß § 14 Abs. 5 UStG explizit abgezogen.</p>
<p>Bei Fragen sind wir jederzeit für Sie da.<br/>Herzliche Grüße<br/><strong>Ihr STORIA Events Team</strong></p>
</body></html>`;

        const recipients = [payment.customer_email, "info@events-storia.de"].filter(Boolean);
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "STORIA Events <info@events-storia.de>",
            to: recipients,
            subject,
            html,
            attachments: [{ filename, content: pdfBase64, content_type: "application/pdf" }],
          }),
        });
        log("Anzahlungsrechnung PDF emailed", { recipients });
      } catch (err) {
        log("PDF email error (non-fatal)", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId,
        invoiceNumber,
        index,
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
