import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { getTenantConfig, tenantSender, resolveTenantFromEntity } from "../_shared/tenant.ts";
import {
  queryEsignaturesContract,
  resendEsignaturesSignRequest,
} from "../_shared/esignatures-client.ts";
import {
  bilingualSubject,
  BILINGUAL_SEPARATOR_HTML,
  emailLanguagePlan,
  resolveCustomerLanguage,
  type CustomerLang,
} from "../_shared/customer-language.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (cents == null || !Number.isFinite(Number(cents))) return null;
  try {
    return (Number(cents) / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
    });
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${currency || "EUR"}`;
  }
}

function formatDateForLang(d: string | null | undefined, lang: CustomerLang): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const locale =
    lang === "de" ? "de-DE" : lang === "it" ? "it-IT" : lang === "fr" ? "fr-FR" : "en-GB";
  return dt.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

interface BlockCopy {
  greetingWith: (name: string) => string;
  greetingFallback: string;
  intro: string;
  labels: { offer: string; event: string; date: string; amount: string };
  cta: string;
  linkNote: string;
  contact: string;
  closing: string;
  brand: string;
}

const BLOCK_COPY: Record<CustomerLang, BlockCopy> = {
  de: {
    greetingWith: (n) => `Sehr geehrte/r ${n},`,
    greetingFallback: "Sehr geehrte Damen und Herren,",
    intro:
      "für Ihre Veranstaltung steht die digitale Kostenübernahme zur Unterschrift bereit. Sie können sie bequem online prüfen und mit wenigen Klicks rechtssicher unterzeichnen.",
    labels: { offer: "Angebotsnummer", event: "Veranstaltung", date: "Datum", amount: "Bruttobetrag" },
    cta: "Kostenübernahme digital unterschreiben",
    linkNote: "Dieser Link ist personenbezogen und sollte nicht weitergeleitet werden.",
    contact: "Bei Fragen erreichen Sie uns jederzeit unter",
    closing: "Herzliche Grüße<br/>Ihr Team von STORIA Catering &amp; Events",
    brand: "Catering &amp; Events — München",
  },
  en: {
    greetingWith: (n) => `Dear ${n},`,
    greetingFallback: "Dear Sir or Madam,",
    intro:
      "the digital cost acceptance for your event is ready to sign. You can review and sign it securely online in just a few clicks.",
    labels: { offer: "Offer number", event: "Event", date: "Date", amount: "Gross amount" },
    cta: "Sign cost acceptance online",
    linkNote: "This link is personal — please do not forward it.",
    contact: "If you have any questions, simply reply or write us at",
    closing: "Warm regards,<br/>Your STORIA Catering &amp; Events team",
    brand: "Catering &amp; Events — Munich",
  },
  it: {
    greetingWith: (n) => `Gentile ${n},`,
    greetingFallback: "Gentili Signore e Signori,",
    intro:
      "la dichiarazione digitale di assunzione costi per il vostro evento è pronta per la firma. Potete consultarla e firmarla online in modo semplice e sicuro.",
    labels: { offer: "Numero offerta", event: "Evento", date: "Data", amount: "Importo lordo" },
    cta: "Firma online la dichiarazione",
    linkNote: "Questo link è personale — si prega di non inoltrarlo.",
    contact: "Per qualsiasi domanda potete contattarci a",
    closing: "Cordiali saluti,<br/>Il team STORIA Catering &amp; Events",
    brand: "Catering &amp; Events — Monaco",
  },
  fr: {
    greetingWith: (n) => `Bonjour ${n},`,
    greetingFallback: "Madame, Monsieur,",
    intro:
      "la prise en charge des coûts au format numérique est prête à être signée pour votre événement. Vous pouvez la consulter et la signer en ligne en quelques clics.",
    labels: { offer: "Numéro d'offre", event: "Événement", date: "Date", amount: "Montant TTC" },
    cta: "Signer la prise en charge en ligne",
    linkNote: "Ce lien est personnel — merci de ne pas le transférer.",
    contact: "Pour toute question, vous pouvez nous écrire à",
    closing: "Cordialement,<br/>L'équipe STORIA Catering &amp; Events",
    brand: "Catering &amp; Events — Munich",
  },
};

function buildBlockHtml(opts: {
  signerName: string | null;
  signUrl: string;
  offerNumber: string | null;
  eventTitle: string | null;
  eventDateRaw: string | null;
  amountFormatted: string | null;
  lang: CustomerLang;
  contactEmail: string;
}): string {
  const copy = BLOCK_COPY[opts.lang];
  const greeting = opts.signerName
    ? copy.greetingWith(escapeHtml(opts.signerName))
    : copy.greetingFallback;
  const dateFormatted = formatDateForLang(opts.eventDateRaw, opts.lang);

  const detailsRows: string[] = [];
  if (opts.offerNumber)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${copy.labels.offer}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.offerNumber)}</td></tr>`);
  if (opts.eventTitle)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${copy.labels.event}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.eventTitle)}</td></tr>`);
  if (dateFormatted)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${copy.labels.date}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(dateFormatted)}</td></tr>`);
  if (opts.amountFormatted)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${copy.labels.amount}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.amountFormatted)}</td></tr>`);

  const detailsTable = detailsRows.length
    ? `<table style="border-collapse:collapse;margin:18px 0;font-size:15px;color:#333;">${detailsRows.join("")}</table>`
    : "";

  return `
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${copy.intro}</p>
    ${detailsTable}
    <div style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(opts.signUrl)}"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
        ${copy.cta}
      </a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#666;margin:18px 0 0;">${copy.linkNote}</p>
    <p style="font-size:13px;line-height:1.6;color:#666;margin:24px 0 0;">
      ${copy.contact}
      <a href="mailto:${escapeHtml(opts.contactEmail)}" style="color:#333;">${escapeHtml(opts.contactEmail)}</a>.
    </p>
    <p style="font-size:13px;line-height:1.5;color:#333;margin:18px 0 0;">${copy.closing}</p>
  `;
}

function buildBilingualHtml(opts: {
  lang: CustomerLang;
  signerName: string | null;
  signUrl: string;
  offerNumber: string | null;
  eventTitle: string | null;
  eventDateRaw: string | null;
  amountFormatted: string | null;
  contactEmail: string;
}): string {
  const plan = emailLanguagePlan(opts.lang);
  const primaryBlock = buildBlockHtml({ ...opts, lang: plan.primary });
  const secondaryBlock = plan.secondary
    ? `${BILINGUAL_SEPARATOR_HTML}<tr><td style="padding:0 32px 40px;">${buildBlockHtml({ ...opts, lang: plan.secondary })}</td></tr>`
    : "";
  const headLang = plan.primary;
  return `<!DOCTYPE html>
<html lang="${headLang}">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;margin:0 auto;">
        <tr><td style="padding:40px 32px ${plan.secondary ? '24px' : '40px'};">${primaryBlock}</td></tr>
        ${secondaryBlock}
        <tr><td style="padding:0 32px 24px;">
          <hr style="border:none;border-top:1px solid #eee;margin:0 0 12px;" />
          <p style="margin:0;font-size:11px;color:#999;letter-spacing:0.18em;text-transform:uppercase;text-align:center;">
            ${BLOCK_COPY[plan.primary].brand}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const auth = await requireAuth(req);

    const body = await req.json().catch(() => ({} as any));
    const costAcceptanceId = String(body?.cost_acceptance_id ?? "").trim();
    const mode = body?.mode === "resend" ? "resend" : "send";
    if (!costAcceptanceId) return json(400, { error: "cost_acceptance_id fehlt." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: loadErr } = await supabase
      .from("cost_acceptances")
      .select(
        "id, inquiry_id, status, signer_email, signer_name, sign_page_url, sign_page_url_embedded, esignatures_contract_id, amount_gross_cents, currency, event_title, event_date, offer_number, sent_at, sent_to, sent_message_id, send_count, last_send_error, webhook_events",
      )
      .eq("id", costAcceptanceId)
      .maybeSingle();

    if (loadErr) return json(500, { error: "Kostenübernahme konnte nicht geladen werden." });
    if (!row) return json(404, { error: "Kostenübernahme nicht gefunden." });

    if (row.status === "signed" || row.status === "signed_pending_pdf") {
      return json(400, { error: "Kostenübernahme ist bereits unterschrieben." });
    }
    if (row.status === "withdrawn")
      return json(400, { error: "Kostenübernahme wurde zurückgezogen und kann nicht versendet werden." });
    if (row.status === "cancelled")
      return json(400, { error: "Kostenübernahme wurde storniert und kann nicht versendet werden." });
    if (row.status === "expired")
      return json(400, { error: "Kostenübernahme ist abgelaufen und kann nicht versendet werden." });

    const signUrl = (row.sign_page_url ?? "").trim();
    if (!signUrl) {
      return json(400, {
        error: "Signatur-Link fehlt. Bitte Kostenübernahme neu erstellen.",
      });
    }

    const contractId = (row.esignatures_contract_id ?? "").trim();
    if (!contractId) {
      return json(400, {
        error: "eSignatures-Vertrags-ID fehlt. Bitte Kostenübernahme neu erstellen.",
      });
    }

    const signerEmail = (row.signer_email ?? "").trim().toLowerCase();
    if (!signerEmail || !EMAIL_RE.test(signerEmail)) {
      return json(400, { error: "Signer E-Mail-Adresse fehlt oder ist ungültig." });
    }

    // Mandant über das Event auflösen (Phase 4b) + Cross-Tenant-Schutz.
    const eventTenantId = await resolveTenantFromEntity(supabase, "v2_events", row.inquiry_id);
    if (eventTenantId !== auth.tenantId) {
      return json(403, { error: "Kostenübernahme gehört nicht zu Ihrem Mandanten." });
    }
    const tenantCfg = await getTenantConfig(supabase, eventTenantId);
    const sender = tenantSender(tenantCfg);

    const nowIso = new Date().toISOString();
    const events = Array.isArray(row.webhook_events) ? [...(row.webhook_events as any[])] : [];

    let signerId = "";
    try {
      const { contract } = await queryEsignaturesContract(contractId);
      const signers = Array.isArray(contract?.signers) ? contract.signers : [];
      const signer = signers.find((s: any) =>
        String(s?.email ?? "").trim().toLowerCase() === signerEmail ||
        String(s?.sign_page_url ?? "").trim() === signUrl
      ) ?? signers[0];
      signerId = String(signer?.id ?? "").trim();
      if (!signerId) {
        throw new Error("Signer-ID fehlt in der eSignatures-Antwort.");
      }
    } catch (err) {
      const errMsg = ((err as Error).message || "eSignatures-Vertrag konnte nicht gelesen werden.").slice(0, 500);
      events.push({
        event: "cost_acceptance_esignatures_resend_failed",
        at: nowIso,
        mode,
        error: errMsg,
        actor: auth.email,
      });
      await supabase
        .from("cost_acceptances")
        .update({
          last_send_error: errMsg,
          last_send_error_at: nowIso,
          webhook_events: events,
        })
        .eq("id", row.id);
      return json(502, { error: `eSignatures-Versand fehlgeschlagen: ${errMsg}` });
    }

    try {
      await resendEsignaturesSignRequest(contractId, signerId);
    } catch (err) {
      const errMsg = ((err as Error).message || "eSignatures-Versand fehlgeschlagen.").slice(0, 500);
      events.push({
        event: "cost_acceptance_esignatures_resend_failed",
        at: nowIso,
        mode,
        error: errMsg,
        actor: auth.email,
      });
      await supabase
        .from("cost_acceptances")
        .update({
          last_send_error: errMsg,
          last_send_error_at: nowIso,
          webhook_events: events,
        })
        .eq("id", row.id);
      return json(502, { error: `eSignatures-Versand fehlgeschlagen: ${errMsg}` });
    }

    const keepStatuses = new Set(["sent", "viewed", "signature_started", "signer_signed"]);
    const nextStatus = keepStatuses.has(row.status as string) ? row.status : "sent";

    events.push({
      event: "cost_acceptance_esignatures_email_resent",
      at: nowIso,
      to: signerEmail,
      mode,
      provider: "esignatures",
      contract_id: contractId,
      signer_id: signerId,
      actor: auth.email,
    });

    const { error: updErr } = await supabase
      .from("cost_acceptances")
      .update({
        sent_at: nowIso,
        sent_to: signerEmail,
        sent_message_id: null,
        send_count: (Number(row.send_count) || 0) + 1,
        last_send_error: null,
        last_send_error_at: null,
        status: nextStatus,
        webhook_events: events,
      })
      .eq("id", row.id);

    if (updErr) {
      console.error("[send-cost-acceptance-email] update failed:", updErr.message);
    }

    // Activity Log (best effort)
    try {
      if (row.inquiry_id) {
        await supabase.from("activity_logs").insert({
          entity_type: "event_inquiry",
          entity_id: row.inquiry_id,
          action: "cost_acceptance_email_sent",
          actor_email: auth.email,
          metadata: {
            cost_acceptance_id: row.id,
            mode,
            provider: "esignatures",
            contract_id: contractId,
            signer_id: signerId,
            tenant_id: eventTenantId,
          },
        });
      }
    } catch (e) {
      console.warn("[send-cost-acceptance-email] activity log failed:", (e as Error).message);
    }

    return json(200, {
      success: true,
      provider: "esignatures",
      contract_id: contractId,
      signer_id: signerId,
      mode,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[send-cost-acceptance-email] error:", (e as Error).message);
    return new Response(JSON.stringify({ error: "Interner Fehler beim Versand." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});