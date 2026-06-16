/**
 * Public-Offer-Integration: erzeugt eine cost_acceptances-Row und einen
 * eSignatures-Contract. Gibt sign_page_url_embedded für den iframe zurück.
 *
 * Schritt 4 — serverseitig gehärtet:
 *  - Strikte Body-Validierung
 *  - offer_option_id MUSS zur Anfrage gehören und aktiv sein
 *  - Betrag IMMER aus Maestro (v2_offer_options oder v2_events), nie aus Body
 *  - Phasen- und Lock-Regeln (locked_after_signature, offer_phase)
 *  - Idempotenz für signed/aktive Rows + Bereinigung defekter Pending-Rows
 *  - Robuste Fehlerbehandlung nach lokalem Insert: Row wird auf "error" gesetzt
 *  - Contract-Erstellung via Shared eSignatures-Client
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  renderCostAcceptanceMarkdown,
  resolveMfaMethod,
  TEMPLATE_VERSION,
} from "../_shared/cost-acceptance-template.ts";
import {
  createEsignaturesContract,
  getEsignaturesApiKey,
} from "../_shared/esignatures-client.ts";

interface Body {
  inquiry_id: string;
  offer_option_id?: string | null;
  signer: {
    name: string;
    email: string;
    mobile: string;
    company_name?: string;
  };
  event: {
    company: string;
    title: string;
    date: string;
    onsite_contact: string;
    guest_count: number;
  };
  invoice: {
    company: string;
    street: string;
    zip_city: string;
    reference?: string;
  };
  confirmations: Record<string, boolean>;
  is_b2b: boolean;
}

function eur(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Erlaubte öffentliche Angebotsphasen für die Kostenübernahme. */
const ALLOWED_OFFER_PHASES = new Set([
  "final_sent",
  "confirmed",
  "order_confirmed",
]);

const ACTIVE_STATUSES = [
  "pending_signature",
  "signature_started",
  "sent",
  "viewed",
  "signer_signed",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isPlausibleMobile(v: string): boolean {
  if (typeof v !== "string") return false;
  const trimmed = v.trim();
  if (!/^[+0-9 ()\-./]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 20;
}

type FieldErrors = Record<string, string>;

function validateBody(body: Partial<Body>): FieldErrors {
  const errors: FieldErrors = {};

  if (!body.inquiry_id || typeof body.inquiry_id !== "string") {
    errors.inquiry_id = "inquiry_id fehlt";
  }

  const signer = (body.signer ?? {}) as Partial<Body["signer"]>;
  const name = (signer.name ?? "").trim();
  if (name.length < 2) errors.signer_name = "Name ist zu kurz";
  const email = (signer.email ?? "").trim();
  if (!EMAIL_RE.test(email)) errors.signer_email = "E-Mail ist ungültig";
  if (!isPlausibleMobile(signer.mobile ?? "")) {
    errors.signer_mobile = "Mobilnummer ist ungültig";
  }

  const invoice = (body.invoice ?? {}) as Partial<Body["invoice"]>;
  if (!(invoice.street ?? "").trim()) errors.invoice_street = "Straße fehlt";
  if (!(invoice.zip_city ?? "").trim()) errors.invoice_zip_city = "PLZ / Ort fehlt";

  const ev = (body.event ?? {}) as Partial<Body["event"]>;
  if (ev.title !== undefined && !(ev.title ?? "").trim()) {
    errors.event_title = "Veranstaltungstitel fehlt";
  }
  if (ev.date !== undefined && !(ev.date ?? "").trim()) {
    errors.event_date = "Veranstaltungsdatum fehlt";
  }
  if (ev.onsite_contact !== undefined && !(ev.onsite_contact ?? "").trim()) {
    errors.event_onsite_contact = "Ansprechpartner vor Ort fehlt";
  }
  if (ev.guest_count !== undefined) {
    const n = Number(ev.guest_count);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) {
      errors.event_guest_count = "Gästezahl ist ungültig";
    }
  }

  const c = body.confirmations ?? {};
  const required = [
    "berechtigt",
    "kostenuebernahme",
    "zusatzleistungen",
    "rechnungsanschrift",
  ];
  for (const key of required) {
    if (c[key] !== true) errors[`confirmations_${key}`] = "Bestätigung fehlt";
  }
  if (body.is_b2b === false && c.b2c_verbraucherinfo !== true) {
    errors.confirmations_b2c_verbraucherinfo = "Verbraucherinformation fehlt";
  }

  return errors;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    getEsignaturesApiKey(); // wirft verständlich, wenn Secret fehlt

    const body = (await req.json()) as Body;
    const fieldErrors = validateBody(body);
    if (Object.keys(fieldErrors).length > 0) {
      return jsonResponse(400, {
        error: "Validierung fehlgeschlagen",
        fields: fieldErrors,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Event + Phase/Lock laden
    const { data: event, error: evErr } = await supabase
      .from("v2_events")
      .select(
        "id, amount_total, occasion, date, guest_count, customer_id, locked_after_signature, offer_phase, status",
      )
      .eq("id", body.inquiry_id)
      .maybeSingle();
    if (evErr || !event) {
      return jsonResponse(404, { error: "Anfrage nicht gefunden" });
    }

    // 2. Idempotenz prüfen
    const { data: existingRows } = await supabase
      .from("cost_acceptances")
      .select(
        "id, status, sign_page_url, sign_page_url_embedded, esignatures_contract_id",
      )
      .eq("inquiry_id", body.inquiry_id)
      .order("created_at", { ascending: false });

    const signedRow = existingRows?.find((r) => r.status === "signed");
    if (signedRow) {
      return jsonResponse(200, {
        cost_acceptance_id: signedRow.id,
        contract_id: signedRow.esignatures_contract_id,
        sign_page_url: signedRow.sign_page_url,
        sign_page_url_embedded: signedRow.sign_page_url_embedded,
        status: "signed",
        reused: true,
      });
    }

    // Lock: gesperrt + keine signed Row → 409
    if (event.locked_after_signature) {
      return jsonResponse(409, {
        error:
          "Angebot ist nach Signatur gesperrt. Es kann keine neue Kostenübernahme erstellt werden.",
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
        sign_page_url_embedded: activeWithUrl.sign_page_url_embedded,
        status: activeWithUrl.status,
        reused: true,
      });
    }

    // Aktive Rows ohne URL → defekt, auf error setzen
    const brokenActiveRows = (existingRows ?? []).filter(
      (r) => ACTIVE_STATUSES.includes(r.status as string) && !r.sign_page_url,
    );
    for (const broken of brokenActiveRows) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("cost_acceptances")
        .update({
          status: "error",
          last_contract_error: "Active row without signing URL superseded",
          last_contract_error_at: nowIso,
          webhook_events: [
            { event: "active_row_without_url_superseded", at: nowIso },
          ],
        })
        .eq("id", broken.id);
    }

    // Phasen-Regel
    const phase = (event.offer_phase ?? "").toString();
    if (!ALLOWED_OFFER_PHASES.has(phase)) {
      return jsonResponse(409, {
        error:
          "In der aktuellen Angebotsphase kann keine Kostenübernahme erstellt werden.",
      });
    }

    // 3. Offer Option sicher laden — MUSS zur Anfrage gehören + aktiv sein
    let option:
      | { id: string; amount_total: number; label: string | null }
      | null = null;
    if (body.offer_option_id) {
      const { data: opt, error: optErr } = await supabase
        .from("v2_offer_options")
        .select("id, amount_total, label, event_id, is_active")
        .eq("id", body.offer_option_id)
        .eq("event_id", body.inquiry_id)
        .maybeSingle();
      if (optErr || !opt || opt.is_active === false) {
        return jsonResponse(400, {
          error: "Validierung fehlgeschlagen",
          fields: {
            offer_option_id:
              "Angebots-Option gehört nicht zur Anfrage oder ist nicht aktiv",
          },
        });
      }
      option = { id: opt.id, amount_total: opt.amount_total, label: opt.label };
    }

    // 4. Betrag serverseitig aus Maestro
    const amountTotalRaw = option?.amount_total ?? event.amount_total;
    const amountNumber = Number(amountTotalRaw);
    const amountCents = Math.round(amountNumber * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonResponse(400, {
        error: "Validierung fehlgeschlagen",
        fields: {
          amount: "Betrag ist 0 oder fehlt — Kostenübernahme nicht möglich",
        },
      });
    }

    // 5. Template-Konfig
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
          "Kein eSignatures-Template konfiguriert. Bitte zuerst Setup-Funktion ausführen.",
      });
    }

    // 6. Markdown-Snapshot rendern
    const today = new Date().toISOString().slice(0, 10);
    const placeholders = {
      offer_number: option?.label ?? event.id.slice(0, 8),
      customer_number: event.customer_id?.slice(0, 8) ?? "—",
      offer_date: today,
      valid_until: today,
      amount_gross: eur(amountCents),
      currency: "EUR",
      event_company: body.event.company,
      event_title: body.event.title,
      event_date: body.event.date,
      onsite_contact: body.event.onsite_contact,
      guest_count: String(body.event.guest_count),
      invoice_company: body.invoice.company,
      invoice_street: body.invoice.street,
      invoice_zip_city: body.invoice.zip_city,
      invoice_reference: body.invoice.reference ?? "—",
      signer_name: body.signer.name,
      signer_email: body.signer.email,
      signer_mobile: body.signer.mobile,
      signer_company_name: body.signer.company_name ?? "—",
      signature_date: today,
      additional_terms: Object.entries(body.confirmations)
        .map(([k, v]) => `- ${k}: ${v ? "✓ bestätigt" : "✗"}`)
        .join("\n"),
    };
    const markdownSnapshot = renderCostAcceptanceMarkdown(placeholders);

    // 7. Lokale cost_acceptances Row erzeugen
    const { data: row, error: rowErr } = await supabase
      .from("cost_acceptances")
      .insert({
        inquiry_id: body.inquiry_id,
        offer_option_id: body.offer_option_id ?? null,
        status: "pending_signature",
        signer_name: body.signer.name,
        signer_email: body.signer.email,
        signer_mobile: body.signer.mobile,
        signer_company_name: body.signer.company_name ?? null,
        event_company: body.event.company,
        event_title: body.event.title,
        event_date: body.event.date,
        onsite_contact: body.event.onsite_contact,
        guest_count: body.event.guest_count,
        invoice_company: body.invoice.company,
        invoice_street: body.invoice.street,
        invoice_zip_city: body.invoice.zip_city,
        invoice_reference: body.invoice.reference ?? null,
        confirmations: body.confirmations,
        amount_gross_cents: amountCents,
        currency: "EUR",
        offer_number: placeholders.offer_number,
        customer_number: placeholders.customer_number,
        offer_date: placeholders.offer_date,
        valid_until: placeholders.valid_until,
        esignatures_template_id: templateConfig.template_id,
        template_version: templateConfig.template_version ?? TEMPLATE_VERSION,
        document_markdown_snapshot: markdownSnapshot,
        mfa_method: resolveMfaMethod({ amountCents, isB2B: body.is_b2b }),
      })
      .select()
      .single();
    if (rowErr || !row) throw new Error(rowErr?.message ?? "Insert failed");

    // 8. Contract bei eSignatures.com erzeugen (Shared Client)
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
      throw new Error(
        "SUPABASE_URL ist nicht konfiguriert — Webhook-URL kann nicht aufgebaut werden.",
      );
    }
    const webhookUrl = `${supabaseUrl}/functions/v1/esignatures-webhook`;
    const contractPayload = {
      template_id: templateConfig.template_id,
      locale: "de",
      metadata: row.id,
      custom_webhook_url: webhookUrl,
      signature_request_delivery_methods: [],
      signed_document_delivery_method: "email",
      signers: [{
        name: body.signer.name,
        email: body.signer.email,
        mobile: body.signer.mobile,
        company_name: body.signer.company_name,
        signature_request_delivery_methods: [],
        signing_options: { mfa_via_sms: row.mfa_method === "sms" },
      }],
      placeholder_fields: Object.entries(placeholders).map(([k, v]) => ({
        api_key: k,
        value: String(v),
      })),
    };

    // deno-lint-ignore no-explicit-any
    let contract: any;
    try {
      const result = await createEsignaturesContract(contractPayload);
      contract = result.contract;
    } catch (err) {
      const message = (err as Error).message ?? "Unbekannter eSignatures-Fehler";
      console.error("[create-cost-acceptance] contract failed");
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
      const nowIso = new Date().toISOString();
      await supabase
        .from("cost_acceptances")
        .update({
          status: "error",
          last_contract_error:
            "eSignatures response missing sign_page_url or contract id",
          last_contract_error_at: nowIso,
          webhook_events: [
            { event: "contract_creation_failed", at: nowIso },
          ],
        })
        .eq("id", row.id);
      return jsonResponse(502, {
        error:
          "eSignatures-Vertrag unvollständig — keine Signatur-URL erhalten",
      });
    }

    const embedded = `${signPageUrl}${
      signPageUrl.includes("?") ? "&" : "?"
    }embedded=yes&redirect_iframe=yes`;

    await supabase
      .from("cost_acceptances")
      .update({
        esignatures_contract_id: contractId,
        sign_page_url: signPageUrl,
        sign_page_url_embedded: embedded,
        webhook_events: [
          { event: "contract_created", at: new Date().toISOString() },
        ],
      })
      .eq("id", row.id);

    return jsonResponse(200, {
      cost_acceptance_id: row.id,
      contract_id: contractId,
      sign_page_url: signPageUrl,
      sign_page_url_embedded: embedded,
      status: "pending_signature",
    });
  } catch (err) {
    console.error("[create-cost-acceptance]", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
