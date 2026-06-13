/**
 * Public-Offer-Integration: erzeugt eine cost_acceptances-Row und einen
 * eSignatures-Contract. Gibt sign_page_url_embedded für den iframe zurück.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  renderCostAcceptanceMarkdown,
  resolveMfaMethod,
  TEMPLATE_VERSION,
} from "../_shared/cost-acceptance-template.ts";

const ESIGNATURES_API = "https://esignatures.com/api";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ESIGNATURES_API_KEY");
    if (!apiKey) throw new Error("ESIGNATURES_API_KEY fehlt");

    const body = await req.json() as Body;
    if (!body.inquiry_id || !body.signer?.email || !body.signer?.mobile) {
      return new Response(JSON.stringify({ error: "Pflichtfelder fehlen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get event + chosen option + customer
    const { data: event, error: evErr } = await supabase
      .from("v2_events")
      .select(
        "id, amount_total, occasion, date, guest_count, customer_id, locked_after_signature",
      )
      .eq("id", body.inquiry_id)
      .maybeSingle();
    if (evErr || !event) throw new Error("Inquiry nicht gefunden");
    if (event.locked_after_signature) {
      throw new Error("Angebot ist nach Signatur bereits gesperrt");
    }

    // Idempotenz: bestehende cost_acceptance prüfen
    const { data: existingRows } = await supabase
      .from("cost_acceptances")
      .select(
        "id, status, sign_page_url, sign_page_url_embedded, esignatures_contract_id",
      )
      .eq("inquiry_id", body.inquiry_id)
      .order("created_at", { ascending: false });

    const signedRow = existingRows?.find((r) => r.status === "signed");
    if (signedRow) {
      return new Response(
        JSON.stringify({
          cost_acceptance_id: signedRow.id,
          status: "signed",
          reused: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const activeRow = existingRows?.find((r) =>
      ["pending_signature", "signature_started", "sent", "viewed", "signer_signed"]
        .includes(r.status as string)
    );
    if (activeRow?.sign_page_url) {
      return new Response(
        JSON.stringify({
          cost_acceptance_id: activeRow.id,
          contract_id: activeRow.esignatures_contract_id,
          sign_page_url: activeRow.sign_page_url,
          sign_page_url_embedded: activeRow.sign_page_url_embedded,
          reused: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: option } = body.offer_option_id
      ? await supabase
        .from("v2_offer_options")
        .select("id, amount_total, label")
        .eq("id", body.offer_option_id)
        .maybeSingle()
      : { data: null };

    const amountTotal = option?.amount_total ?? event.amount_total ?? 0;
    const amountCents = Math.round(Number(amountTotal) * 100);

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
      throw new Error(
        "Kein eSignatures-Template konfiguriert. Bitte zuerst Setup-Funktion ausführen.",
      );
    }

    // 2. Render Markdown-Snapshot
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

    // 3. Create cost_acceptances row
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

    // 4. Create contract at eSignatures.com
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

    const cRes = await fetch(
      `${ESIGNATURES_API}/contracts?token=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contractPayload),
      },
    );
    const cJson = await cRes.json();
    if (!cRes.ok || cJson?.status === "error") {
      throw new Error(`Contract failed: ${JSON.stringify(cJson)}`);
    }
    const contract = cJson?.data?.contract ?? cJson?.contract;
    const signer = contract?.signers?.[0];
    const signPageUrl: string | undefined = signer?.sign_page_url;
    const contractId: string | undefined = contract?.id;

    const embedded = signPageUrl
      ? `${signPageUrl}${
        signPageUrl.includes("?") ? "&" : "?"
      }embedded=yes&redirect_iframe=yes`
      : null;

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

    return new Response(
      JSON.stringify({
        cost_acceptance_id: row.id,
        contract_id: contractId,
        sign_page_url: signPageUrl,
        sign_page_url_embedded: embedded,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-cost-acceptance]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});