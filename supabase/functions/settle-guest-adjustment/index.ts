// ════════════════════════════════════════════════════════════════════════════
// SETTLE GUEST ADJUSTMENT
//
// Klärt eine Gästezahl-Differenz aus einer Stripe-Zahlung:
//  • action="invoice"  → Nachberechnung als LexOffice-Rechnung (Mehr-Gäste)
//  • action="refund"   → Stripe-Rückerstattung + LexOffice-Gutschrift (Weniger)
//  • action="waive"    → nur dokumentieren, kein Beleg
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[settle-guest-adjustment] ${step}${details ? " " + JSON.stringify(details) : ""}`);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nicht angemeldet" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Nicht angemeldet" }, 401);

    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff } = await userClient.rpc("has_role", { _user_id: user.id, _role: "staff" });
    if (!isAdmin && !isStaff) return json({ error: "Keine Berechtigung" }, 403);

    const body = await req.json().catch(() => ({}));
    const adjustmentId: string | undefined = body.adjustmentId;
    const action: string = body.action;
    if (!adjustmentId || !["invoice", "refund", "waive"].includes(action)) {
      return json({ error: "adjustmentId und gültige action sind erforderlich" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: adj, error: adjErr } = await admin
      .from("v2_guest_adjustments")
      .select("*")
      .eq("id", adjustmentId)
      .maybeSingle();
    if (adjErr || !adj) return json({ error: "Anpassung nicht gefunden" }, 404);
    if (adj.status !== "open") {
      return json({ error: `Anpassung ist bereits erledigt (${adj.status})` }, 409);
    }

    const { data: ev } = await admin
      .from("v2_events")
      .select(
        "id, event_date, order_number, company_name, billing_company_name, billing_name, billing_street, billing_postal_code, billing_city, billing_country, company_street, company_postal_code, company_city, company_country, customer_id",
      )
      .eq("id", adj.event_id)
      .maybeSingle();
    const { data: cust } = ev?.customer_id
      ? await admin
        .from("v2_customers")
        .select("name, company, email, phone, lexoffice_contact_id, address_street, address_zip, address_city")
        .eq("id", ev.customer_id)
        .maybeSingle()
      : { data: null };

    const absGuests = Math.abs(adj.delta_guests);
    const absAmountCents = Math.abs(adj.delta_amount_cents);
    const unitPrice = adj.price_per_person_cents / 100;

    // ─── WAIVE ────────────────────────────────────────────────────────────
    if (action === "waive") {
      await admin.from("v2_guest_adjustments").update({
        status: "waived",
        settled_at: new Date().toISOString(),
        notes: body.notes ?? adj.notes,
        updated_at: new Date().toISOString(),
      }).eq("id", adj.id);
      await admin.from("v2_events").update({ guest_delta_settled_at: new Date().toISOString() })
        .eq("id", adj.event_id);
      return json({ success: true, status: "waived" });
    }

    // ─── INVOICE (Nachberechnung) ─────────────────────────────────────────
    if (action === "invoice") {
      if (adj.delta_guests <= 0) {
        return json({ error: "Nachberechnung nur bei zusätzlichen Gästen möglich" }, 400);
      }
      const email = cust?.email;
      if (!email) return json({ error: "Keine Kunden-E-Mail hinterlegt" }, 400);

      const street = ev?.billing_street || ev?.company_street || cust?.address_street || "";
      const zip = ev?.billing_postal_code || ev?.company_postal_code || cust?.address_zip || "";
      const city = ev?.billing_city || ev?.company_city || cust?.address_city || "";

      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-manual-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            contactName: ev?.billing_name || cust?.name || "Kunde",
            companyName: ev?.billing_company_name || ev?.company_name || cust?.company || undefined,
            email,
            phone: cust?.phone ?? undefined,
            address: street ? { street, zip, city, country: ev?.billing_country || "DE" } : undefined,
            eventInquiryId: adj.event_id,
            documentType: "invoice",
            introduction:
              `Nachberechnung zusätzlicher Gäste für Ihre Veranstaltung${ev?.event_date ? ` am ${new Date(ev.event_date).toLocaleDateString("de-DE")}` : ""}.`,
            items: [{
              name: `Zusätzliche Gäste (${adj.guests_before} → ${adj.guests_after})`,
              description: `${absGuests} zusätzliche Gäste`,
              quantity: absGuests,
              unitPrice,
              taxRate: 19,
            }],
          }),
        },
      );
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.error || !out.documentId) {
        log("invoice failed", { status: res.status, out });
        return json({ error: out.error || `Rechnung fehlgeschlagen (HTTP ${res.status})`, details: out.details }, 502);
      }

      await admin.from("v2_guest_adjustments").update({
        status: "invoiced",
        lexoffice_invoice_id: out.documentId,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", adj.id);
      await admin.from("v2_events").update({ guest_delta_settled_at: new Date().toISOString() })
        .eq("id", adj.event_id);

      return json({ success: true, status: "invoiced", documentId: out.documentId });
    }

    // ─── REFUND (Storno / Rückerstattung) ─────────────────────────────────
    if (adj.delta_guests >= 0) {
      return json({ error: "Rückerstattung nur bei weniger Gästen möglich" }, 400);
    }

    const { data: pay } = adj.payment_id
      ? await admin.from("v2_payments").select("id, stripe_payment_intent_id, amount_cents").eq("id", adj.payment_id).maybeSingle()
      : { data: null };
    if (!pay?.stripe_payment_intent_id) {
      return json({ error: "Keine Stripe-Zahlung zur Erstattung gefunden" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const refund = await stripe.refunds.create({
      payment_intent: pay.stripe_payment_intent_id,
      amount: absAmountCents,
      metadata: { event_id: adj.event_id, adjustment_id: adj.id },
    });
    log("refund created", { id: refund.id, amount: absAmountCents });

    // LexOffice-Gutschrift (nur wenn Kontakt bekannt) — nicht fatal
    let creditNoteId: string | null = null;
    const lexKey = Deno.env.get("LEXOFFICE_API_KEY");
    if (lexKey && cust?.lexoffice_contact_id) {
      try {
        const cnRes = await fetch("https://api.lexoffice.io/v1/credit-notes?finalize=true", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lexKey}` },
          body: JSON.stringify({
            voucherDate: new Date().toISOString(),
            address: { contactId: cust.lexoffice_contact_id },
            lineItems: [{
              type: "custom",
              name: `Stornierung Gäste (${adj.guests_before} → ${adj.guests_after})`,
              quantity: absGuests,
              unitName: "Person",
              unitPrice: { currency: "EUR", grossAmount: unitPrice, taxRatePercentage: 19 },
            }],
            totalPrice: { currency: "EUR" },
            taxConditions: { taxType: "gross" },
            title: "Gutschrift",
            introduction: "Gutschrift aufgrund reduzierter Gästezahl.",
          }),
        });
        const cn = await cnRes.json().catch(() => ({}));
        if (cnRes.ok && cn.id) creditNoteId = cn.id;
        else log("credit note failed", { status: cnRes.status, cn });
      } catch (e) {
        log("credit note error", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    await admin.from("v2_guest_adjustments").update({
      status: "refunded",
      stripe_refund_id: refund.id,
      lexoffice_credit_note_id: creditNoteId,
      settled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", adj.id);
    await admin.from("v2_payments").update({
      stripe_refund_id: refund.id,
      lexoffice_credit_note_id: creditNoteId,
      updated_at: new Date().toISOString(),
    }).eq("id", pay.id);
    await admin.from("v2_events").update({ guest_delta_settled_at: new Date().toISOString() })
      .eq("id", adj.event_id);

    return json({
      success: true,
      status: "refunded",
      refundId: refund.id,
      creditNoteId,
      creditNoteSkipped: !creditNoteId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});