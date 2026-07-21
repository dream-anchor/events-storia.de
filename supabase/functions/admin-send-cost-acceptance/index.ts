/**
 * Admin-initiierter Versand einer Kostenübernahme.
 *
 * Ein Klick im Anfrage-Editor:
 *  - lädt Signer/Event/Rechnungsadresse serverseitig aus v2_events + v2_customers
 *  - erzeugt (idempotent) einen eSignatures-Contract mit dem aktiven Template
 *  - eSignatures verschickt die Signatur-Mail direkt an den Signer
 *  - setzt cost_acceptance_requested=true auf v2_events
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import {
  renderCostAcceptanceMarkdown,
  resolveMfaMethod,
  TEMPLATE_VERSION,
  buildPaymentTerms,
} from "../_shared/cost-acceptance-template.ts";
import {
  createEsignaturesContract,
  getEsignaturesApiKey,
} from "../_shared/esignatures-client.ts";

const ACTIVE_STATUSES = [
  "pending_signature",
  "signature_started",
  "sent",
  "viewed",
  "signer_signed",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function eur(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPlausibleMobile(v: string | null | undefined): boolean {
  if (!v) return false;
  const trimmed = v.trim();
  if (!/^[+0-9 ()\-./]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 20;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    getEsignaturesApiKey();

    const { inquiry_id, offer_option_id } = (await req.json()) as {
      inquiry_id?: string;
      offer_option_id?: string | null;
    };
    if (!inquiry_id || typeof inquiry_id !== "string") {
      return jsonResponse(400, { error: "inquiry_id fehlt" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Event + Customer laden
    const { data: event, error: evErr } = await supabase
      .from("v2_events")
      .select(
        "id, amount_total, occasion, date, guest_count, customer_id, locked_after_signature, offer_phase, offer_slug, company_name, company_street, company_postal_code, company_city, billing_address_different, billing_company_name, billing_street, billing_postal_code, billing_city, balance_method, balance_due_days_before_event, invoice_due_days, deposit_method, deposit_percent, deposit_amount, deposit_due_days",
      )
      .eq("id", inquiry_id)
      .maybeSingle();
    if (evErr || !event) {
      return jsonResponse(404, { error: "Anfrage nicht gefunden" });
    }
    if (event.locked_after_signature) {
      return jsonResponse(409, {
        error:
          "Angebot ist nach Signatur gesperrt. Keine neue Kostenübernahme möglich.",
      });
    }

    const { data: customer } = event.customer_id
      ? await supabase
          .from("v2_customers")
          .select(
            "id, name, email, phone, company, address_street, address_zip, address_city",
          )
          .eq("id", event.customer_id)
          .maybeSingle()
      : { data: null } as any;

    if (!customer) {
      return jsonResponse(409, {
        error: "Kein Kunde an dieser Anfrage — Kostenübernahme nicht möglich.",
      });
    }

    const signerName = (customer.name ?? "").toString().trim();
    const signerEmail = (customer.email ?? "").toString().trim();
    const signerMobile = (customer.phone ?? "").toString().trim();
    const signerCompany = (customer.company ?? "").toString().trim();
    if (signerName.length < 2) {
      return jsonResponse(409, { error: "Kundenname fehlt.", field: "signer_name" });
    }
    if (!EMAIL_RE.test(signerEmail)) {
      return jsonResponse(409, { error: "Kunden-E-Mail fehlt oder ungültig.", field: "signer_email" });
    }
    if (!isPlausibleMobile(signerMobile)) {
      return jsonResponse(409, {
        error:
          "Kunden-Mobilnummer fehlt oder ungültig — bitte im Kundenprofil pflegen.",
        field: "signer_mobile",
      });
    }

    // 2. Idempotenz
    const { data: existingRows } = await supabase
      .from("cost_acceptances")
      .select(
        "id, status, sign_page_url, sign_page_url_embedded, esignatures_contract_id",
      )
      .eq("inquiry_id", inquiry_id)
      .order("created_at", { ascending: false });

    const signedRow = existingRows?.find((r) => r.status === "signed");
    if (signedRow) {
      return jsonResponse(200, {
        cost_acceptance_id: signedRow.id,
        contract_id: signedRow.esignatures_contract_id,
        sign_page_url: signedRow.sign_page_url,
        status: "signed",
        reused: true,
      });
    }
    const activeWithUrl = existingRows?.find(
      (r) => ACTIVE_STATUSES.includes(r.status as string) && r.sign_page_url,
    );
    if (activeWithUrl) {
      return jsonResponse(200, {
        cost_acceptance_id: activeWithUrl.id,
        contract_id: activeWithUrl.esignatures_contract_id,
        sign_page_url: activeWithUrl.sign_page_url,
        status: activeWithUrl.status,
        reused: true,
      });
    }
    // defekte Pending-Rows bereinigen
    const broken = (existingRows ?? []).filter(
      (r) => ACTIVE_STATUSES.includes(r.status as string) && !r.sign_page_url,
    );
    for (const b of broken) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("cost_acceptances")
        .update({
          status: "error",
          last_contract_error: "Superseded by admin re-send",
          last_contract_error_at: nowIso,
          webhook_events: [
            { event: "superseded_by_admin_send", at: nowIso },
          ],
        })
        .eq("id", b.id);
    }

    // 3. Offer Option / Betrag
    let option: { id: string; amount_total: number; label: string | null } | null =
      null;
    if (offer_option_id) {
      const { data: opt } = await supabase
        .from("v2_offer_options")
        .select("id, amount_total, label, event_id, is_active")
        .eq("id", offer_option_id)
        .eq("event_id", inquiry_id)
        .maybeSingle();
      if (opt && opt.is_active !== false) {
        option = { id: opt.id, amount_total: opt.amount_total, label: opt.label };
      }
    }
    if (!option) {
      // aktive Option (sent) laden — sonst Event-Total
      const { data: activeOpt } = await supabase
        .from("v2_offer_options")
        .select("id, amount_total, label")
        .eq("event_id", inquiry_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeOpt) {
        option = {
          id: activeOpt.id,
          amount_total: activeOpt.amount_total,
          label: activeOpt.label,
        };
      }
    }
    const amountTotalRaw = option?.amount_total ?? event.amount_total;
    const amountNumber = Number(amountTotalRaw);
    const amountCents = Math.round(amountNumber * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonResponse(409, {
        error: "Kein Betrag am Angebot — Kostenübernahme nicht möglich.",
        field: "amount",
      });
    }

    // 4. Event/Datum
    const serverEventTitle =
      (event.occasion ?? "").toString().trim() || "Veranstaltung";
    const serverEventDateIso = event.date
      ? new Date(event.date as string).toISOString().slice(0, 10)
      : null;
    if (!serverEventDateIso) {
      return jsonResponse(409, {
        error: "Veranstaltungsdatum fehlt in Maestro.",
        field: "event_date",
      });
    }
    const serverGuestCount = Number(event.guest_count);
    if (!Number.isFinite(serverGuestCount) || serverGuestCount <= 0) {
      return jsonResponse(409, { error: "Gästezahl fehlt in Maestro.", field: "guest_count" });
    }
    const serverEventDateLabel = (() => {
      try {
        return new Date(serverEventDateIso).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
      } catch {
        return serverEventDateIso;
      }
    })();

    // 5. Rechnungsadresse aus Kundenprofil
    // Rechnungsadresse: bevorzugt separate Billing-Adresse am Event, sonst Firmenadresse am Event,
    // sonst Fallback auf Kundenprofil.
    const useSeparateBilling = Boolean((event as any).billing_address_different);
    const invoiceCompany =
      (useSeparateBilling ? (event as any).billing_company_name : null) ||
      (event as any).company_name ||
      signerCompany ||
      signerName;
    const invoiceStreet = (
      (useSeparateBilling ? (event as any).billing_street : null) ??
      (event as any).company_street ??
      (customer as any).address_street ??
      ""
    ).toString().trim();
    const invoiceZip = (
      (useSeparateBilling ? (event as any).billing_postal_code : null) ??
      (event as any).company_postal_code ??
      (customer as any).address_zip ??
      ""
    ).toString().trim();
    const invoiceCity = (
      (useSeparateBilling ? (event as any).billing_city : null) ??
      (event as any).company_city ??
      (customer as any).address_city ??
      ""
    ).toString().trim();
    if (!invoiceStreet || !(invoiceZip || invoiceCity)) {
      return jsonResponse(409, {
        error:
          "Rechnungsadresse (Straße + PLZ/Ort) fehlt — bitte Firmenadresse (oder abweichende Rechnungsadresse) an dieser Anfrage pflegen.",
        field: "invoice_address",
      });
    }
    const invoiceZipCity = `${invoiceZip} ${invoiceCity}`.trim();

    // 6. Template
    const { data: tplSetting } = await supabase
      .from("crm_settings")
      .select("value")
      .eq("key", "esignatures_cost_acceptance_template")
      .maybeSingle();
    const templateConfig = (tplSetting?.value ?? {}) as {
      template_id?: string;
      template_version?: string;
    };
    if (!templateConfig.template_id) {
      return jsonResponse(500, {
        error:
          "Kein eSignatures-Template konfiguriert. Bitte in den Einstellungen unter eSignatures einrichten.",
      });
    }

    // 7. Markdown-Snapshot
    const today = new Date().toISOString().slice(0, 10);
    const confirmations: Record<string, boolean> = {
      admin_initiated: true,
    };
    const { payment_terms, deposit_terms } = buildPaymentTerms({
      balance_method: (event as any).balance_method,
      balance_due_days_before_event: (event as any).balance_due_days_before_event,
      invoice_due_days: (event as any).invoice_due_days,
      deposit_method: (event as any).deposit_method,
      deposit_percent: (event as any).deposit_percent,
      deposit_amount: (event as any).deposit_amount,
      deposit_due_days: (event as any).deposit_due_days,
    });
    const placeholders = {
      offer_number: option?.label ?? event.id.slice(0, 8),
      customer_number: event.customer_id?.slice(0, 8) ?? "—",
      offer_date: today,
      valid_until: today,
      amount_gross: eur(amountCents),
      currency: "EUR",
      event_company: signerCompany || signerName,
      event_title: serverEventTitle,
      event_date: serverEventDateLabel,
      onsite_contact: signerName,
      guest_count: String(serverGuestCount),
      invoice_company: invoiceCompany,
      invoice_street: invoiceStreet,
      invoice_zip_city: invoiceZipCity,
      invoice_reference: "—",
      signer_name: signerName,
      signer_email: signerEmail,
      signer_mobile: signerMobile,
      signer_company_name: signerCompany || "—",
      signature_date: today,
      additional_terms: "- durch Storia versendet: ✓",
      payment_terms,
      deposit_terms,
    };
    const markdownSnapshot = renderCostAcceptanceMarkdown(placeholders);

    const isB2B = Boolean(signerCompany);

    // 8. Row einfügen
    const { data: row, error: rowErr } = await supabase
      .from("cost_acceptances")
      .insert({
        inquiry_id,
        offer_option_id: option?.id ?? null,
        status: "pending_signature",
        signer_name: signerName,
        signer_email: signerEmail,
        signer_mobile: signerMobile,
        signer_company_name: signerCompany || null,
        event_company: signerCompany || signerName,
        event_title: serverEventTitle,
        event_date: serverEventDateIso,
        onsite_contact: signerName,
        guest_count: serverGuestCount,
        invoice_company: invoiceCompany,
        invoice_street: invoiceStreet,
        invoice_zip_city: invoiceZipCity,
        invoice_reference: null,
        confirmations,
        amount_gross_cents: amountCents,
        currency: "EUR",
        offer_number: placeholders.offer_number,
        customer_number: placeholders.customer_number,
        offer_date: placeholders.offer_date,
        valid_until: placeholders.valid_until,
        esignatures_template_id: templateConfig.template_id,
        template_version: templateConfig.template_version ?? TEMPLATE_VERSION,
        document_markdown_snapshot: markdownSnapshot,
        mfa_method: resolveMfaMethod({ amountCents, isB2B }),
      })
      .select()
      .single();
    if (rowErr || !row) {
      return jsonResponse(500, {
        error: rowErr?.message ?? "Konnte cost_acceptance nicht anlegen",
      });
    }

    // 9. Contract via eSignatures.com — eSignatures verschickt die Mail
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "")
      .trim()
      .replace(/\/+$/, "");
    const webhookUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
      ? `${supabaseUrl}/functions/v1/esignatures-webhook`
      : undefined;

    const contractPayload: Record<string, unknown> = {
      template_id: templateConfig.template_id,
      locale: "de",
      metadata: row.id,
      // eSignatures verschickt die Signatur-E-Mail an den Signer:
      signature_request_delivery_methods: ["email"],
      signed_document_delivery_method: "email",
      signers: [
        {
          name: signerName,
          email: signerEmail,
          mobile: signerMobile,
          company_name: signerCompany || undefined,
          signature_request_delivery_methods: ["email"],
          signing_options: { mfa_via_sms: row.mfa_method === "sms" },
        },
      ],
      placeholder_fields: Object.entries(placeholders).map(([k, v]) => ({
        api_key: k,
        value: String(v),
      })),
    };
    if (webhookUrl) contractPayload.custom_webhook_url = webhookUrl;

    // deno-lint-ignore no-explicit-any
    let contract: any;
    try {
      const result = await createEsignaturesContract(contractPayload);
      contract = result.contract;
    } catch (err) {
      const message = (err as Error).message ?? "Unbekannter eSignatures-Fehler";
      const nowIso = new Date().toISOString();
      await supabase
        .from("cost_acceptances")
        .update({
          status: "error",
          last_contract_error: message,
          last_contract_error_at: nowIso,
          webhook_events: [
            { event: "contract_creation_failed", at: nowIso, message },
          ],
        })
        .eq("id", row.id);
      return jsonResponse(502, {
        error: "eSignatures-Vertrag konnte nicht erstellt werden",
        detail: message,
      });
    }

    const contractSigner = contract?.signers?.[0];
    const signPageUrl: string | undefined = contractSigner?.sign_page_url;
    const contractId: string | undefined = contract?.id;
    if (!signPageUrl || !contractId) {
      return jsonResponse(502, {
        error: "eSignatures-Vertrag unvollständig",
      });
    }
    const embedded = `${signPageUrl}${
      signPageUrl.includes("?") ? "&" : "?"
    }embedded=yes&redirect_iframe=yes`;

    const nowIso = new Date().toISOString();
    await supabase
      .from("cost_acceptances")
      .update({
        esignatures_contract_id: contractId,
        sign_page_url: signPageUrl,
        sign_page_url_embedded: embedded,
        status: "sent",
        sent_to: signerEmail,
        sent_at: nowIso,
        send_count: 1,
        webhook_events: [
          { event: "contract_created_by_admin", at: nowIso },
          { event: "sent", at: nowIso, channel: "esignatures_email" },
        ],
      })
      .eq("id", row.id);

    // 10. Flag am Event
    await supabase
      .from("v2_events")
      .update({
        cost_acceptance_requested: true,
        cost_acceptance_requested_at: nowIso,
      })
      .eq("id", inquiry_id);

    return jsonResponse(200, {
      cost_acceptance_id: row.id,
      contract_id: contractId,
      sign_page_url: signPageUrl,
      status: "sent",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonResponse(err.status, { error: err.message });
    }
    console.error("[admin-send-cost-acceptance]", (err as Error).message);
    return jsonResponse(500, { error: (err as Error).message });
  }
});