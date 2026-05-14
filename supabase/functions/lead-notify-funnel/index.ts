// Edge Function: lead-notify-funnel
// Phase 1: server-side scoring + auto-reply (Resend, info@events-storia.de)
//          + internal notification (noreply@events-storia.de)
//          + failure logging into lead_notify_failures
// Phase 1.5 (stub, commented): Slack hot-lead alert + Slack failure alert
// Fire-and-forget: must NEVER return 5xx to caller; always 200/4xx with JSON.
//
// TEST-MODUS: Wenn die Env-Variable INTERNAL_MAIL_OVERRIDE_TO gesetzt ist,
// wird die interne Notification an diese Adresse statt info@events-storia.de
// geschickt. VOR PHASE-1-LAUNCH MUSS DIESE VARIABLE GELÖSCHT WERDEN.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Phase 1.5 (optional)
const SLACK_ALERTS_WEBHOOK_URL = Deno.env.get("SLACK_ALERTS_WEBHOOK_URL");

const RESEND_API = "https://api.resend.com";
const FROM_AUTOREPLY = "Domenico Speranza · Storia <info@events-storia.de>";
const FROM_INTERNAL = "Lead-Funnel <noreply@events-storia.de>";
const INTERNAL_TO_DEFAULT = "info@events-storia.de";
const INTERNAL_MAIL_OVERRIDE_TO = Deno.env.get("INTERNAL_MAIL_OVERRIDE_TO");
const OVERRIDE_RAW = INTERNAL_MAIL_OVERRIDE_TO ?? "";
const OVERRIDE_TRIMMED = OVERRIDE_RAW.trim();
// TEST-SAFETY: solange der Wert "TESTMODE_BLOCK_INTERNAL" ist, wird die interne
// Mail vollständig blockiert (nicht an info@ gesendet). Vor Phase-1-Launch
// muss diese Env-Variable entweder gelöscht oder auf eine echte Adresse
// gesetzt werden.
const TEST_BLOCK = OVERRIDE_TRIMMED === "TESTMODE_BLOCK_INTERNAL";
const INTERNAL_TO = OVERRIDE_TRIMMED.includes("@")
  ? OVERRIDE_TRIMMED
  : INTERNAL_TO_DEFAULT;

type LeadRow = {
  id: string;
  intent: string | null;
  occasion: string | null;
  occasion_other: string | null;
  people_bucket: string | null;
  format: string | null;
  date_mode: string | null;
  date_value: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lead_score: number | null;
  notified_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source_url: string | null;
};

function scoreLead(l: LeadRow): number {
  let s = 0;
  switch (l.people_bucket) {
    case "2-10": s += 5; break;
    case "10-20": s += 10; break;
    case "20-50": s += 20; break;
    case "50-100": s += 25; break;
    case "100+": s += 30; break;
  }
  switch (l.date_mode) {
    case "fixed": s += 25; break;
    case "range": s += 15; break;
    case "flexible": s += 10; break;
    case "open": s += 5; break;
  }
  if (l.occasion && l.occasion !== "other") s += 15;
  else if (l.occasion === "other" && l.occasion_other) s += 10;
  switch (l.intent) {
    case "catering": s += 20; break;
    case "location": s += 20; break;
    case "both": s += 25; break;
    case "consult":
    case "unsure": s += 10; break;
  }
  return Math.min(100, s);
}

async function logFailure(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  step: string,
  error: string
) {
  try {
    await supabase.from("lead_notify_failures").insert({
      lead_id: leadId,
      step,
      error_message: error.slice(0, 2000),
    });
  } catch (_) { /* swallow */ }
  // Phase 1.5 stub — Slack failure alert (commented)
  // if (SLACK_ALERTS_WEBHOOK_URL) { ... }
}

async function sendResend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY missing");
  }
  const r = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${txt.slice(0, 500)}`);
  return txt;
}

function fmtPeople(b: string | null) {
  switch (b) {
    case "2-10": return "bis zu zehn Personen";
    case "10-20": return "11 bis 20 Personen";
    case "20-50": return "21 bis 50 Personen";
    case "50-100": return "51 bis 100 Personen";
    case "100+": return "über 100 Personen";
    default: return b || "";
  }
}

function fmtDateValue(d: string | null): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function fmtDate(l: LeadRow) {
  if (l.date_mode === "fixed" && l.date_value) return fmtDateValue(l.date_value);
  if (l.date_mode === "flexible" && l.date_range_start && l.date_range_end) {
    return `${fmtDateValue(l.date_range_start)} bis ${fmtDateValue(l.date_range_end)}`;
  }
  if (l.date_mode === "open") return "noch offen";
  return "";
}
function fmtOccasion(l: LeadRow) {
  switch (l.occasion) {
    case "geburtstag": return "Geburtstag";
    case "firmenfeier": return "Firmenfeier";
    case "hochzeit": return "Hochzeit";
    case "weihnachtsfeier": return "Weihnachtsfeier";
    case "privat": return "Privater Anlass";
    case "sonstiges":
    case "other":
      return l.occasion_other ? `Sonstiges (${l.occasion_other})` : "Sonstiges";
    default: return l.occasion || "";
  }
}
function fmtIntent(i: string | null) {
  switch (i) {
    case "inhouse": return "Im Restaurant feiern";
    case "delivery": return "Catering / Lieferung";
    case "consult": return "Beratung gewünscht";
    // Legacy fallbacks
    case "catering": return "Catering";
    case "location": return "Location bei Storia";
    case "both": return "Catering + Location";
    case "unsure": return "Noch unentschieden";
    default: return i || "";
  }
}
function fmtFormat(f: string | null) {
  switch (f) {
    case "a_la_carte": return "À la carte";
    case "3_gaenge": return "3-Gänge-Menü";
    case "aperitivo_flying_buffet": return "Aperitivo + Flying Buffet";
    case "exklusivmiete": return "Exklusivmiete";
    case "fingerfood": return "Fingerfood";
    case "pizza_napoletana": return "Pizza Napoletana";
    case "warme_aufläufe":
    case "warme_auflaeufe": return "Warme Aufläufe";
    case "komplett_buffet": return "Komplett-Buffet";
    case "beratung": return "Beratung gewünscht";
    default: return f || "";
  }
}
function fmtPriority(score: number) {
  if (score >= 70) return `hoch (${score})`;
  if (score >= 40) return `mittel (${score})`;
  return `niedrig (${score})`;
}
function fullName(l: LeadRow) {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || "";
}
function esc(s: string | null | undefined) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAutoReplyHtml(l: LeadRow): string {
  const greeting = l.first_name ? `Hallo ${esc(l.first_name)},` : "Hallo,";
  const rows: string[] = [];
  const occ = fmtOccasion(l); if (occ) rows.push(`Anlass: ${esc(occ)}`);
  const ppl = fmtPeople(l.people_bucket); if (ppl) rows.push(`Personen: ${esc(ppl)}`);
  const dt = fmtDate(l); if (dt) rows.push(`Datum: ${esc(dt)}`);
  const fmt = fmtFormat(l.format);
  if (fmt && l.intent !== "consult") rows.push(`Format: ${esc(fmt)}`);
  const intent = fmtIntent(l.intent); if (intent) rows.push(`Anliegen: ${esc(intent)}`);
  const detailsBlock = rows.length
    ? `<p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.7"><strong style="color:#1a1a1a">Ihre Angaben:</strong><br>${rows.join("<br>")}</p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#faf6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Wir haben Ihre Anfrage erhalten und melden uns kurz.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf6f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04);">
        <tr><td style="padding:32px 32px 20px;text-align:center;border-bottom:1px solid #f0ead8;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;color:#1a1a1a;letter-spacing:0.08em;">STORIA</h1>
          <p style="margin:6px 0 0;font-size:11px;color:#999;letter-spacing:0.18em;text-transform:uppercase;">Catering &amp; Events &mdash; München</p>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;color:#444;line-height:1.7">
          <p style="margin:0 0 18px">${greeting}</p>
          <p style="margin:0 0 18px">vielen Dank für Ihre Nachricht. Ich habe Ihre Anfrage erhalten und melde mich innerhalb von 4 Stunden persönlich bei Ihnen, außerhalb unserer Öffnungszeiten am nächsten Morgen.</p>
          ${detailsBlock}
          <p style="margin:0 0 24px">Falls in der Zwischenzeit etwas dazukommt oder sich ändert, schreiben Sie mir gerne direkt an <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none">info@events-storia.de</a>.</p>
          <p style="margin:0;color:#1a1a1a">Herzliche Grüße<br>Domenico Speranza<br>Storia &middot; Restaurant &amp; Catering</p>
          <p style="margin:18px 0 0;font-size:13px;color:#666;line-height:1.6">
            Karlstraße 47a &middot; 80333 München<br>
            <a href="tel:+498951519696" style="color:#b45309;text-decoration:none">+49 89 51519696</a> &middot; <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none">info@events-storia.de</a><br>
            <a href="https://www.events-storia.de" style="color:#b45309;text-decoration:none">www.events-storia.de</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;background-color:#faf6f0;text-align:center;border-top:1px solid #f0ead8;">
          <p style="margin:0 0 8px;font-size:13px;color:#666;"><strong>STORIA Catering &amp; Events</strong><br>Karlstraße 47a, 80333 München</p>
          <p style="margin:8px 0 0;font-size:13px;">
            <a href="tel:+498951519696" style="color:#b45309;text-decoration:none;">089 51519696</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none;">info@events-storia.de</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildInternalHtml(l: LeadRow, score: number): string {
  const utm = [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ");
  const fmt = fmtFormat(l.format);
  const showFormat = !(l.intent === "consult" && !l.format) && fmt;

  const rows: Array<[string, string]> = [];
  const push = (label: string, val: string | null | undefined) => {
    if (val && String(val).trim()) rows.push([label, String(val)]);
  };
  push("Name", fullName(l));
  push("E-Mail", l.email);
  push("Telefon", l.phone);
  push("Anliegen", fmtIntent(l.intent));
  push("Anlass", fmtOccasion(l));
  push("Personen", fmtPeople(l.people_bucket));
  push("Datum", fmtDate(l));
  if (showFormat) push("Format", fmt);
  push("Notiz", l.notes);
  push("Priorität", fmtPriority(score));
  if (utm) push("UTM", utm);
  push("Quelle", l.source_url);
  rows.push(["Lead-ID", l.id]);

  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#666;vertical-align:top"><b>${esc(k)}</b></td><td style="padding:4px 0">${k === "Lead-ID" ? `<code>${esc(v)}</code>` : esc(v)}</td></tr>`
  ).join("");

  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6">
    <h2 style="margin:0 0 16px;font-weight:600">Neue Anfrage</h2>
    <table cellpadding="0" style="border-collapse:collapse;font-size:14px">
      ${tableRows}
    </table>
    <p style="margin-top:20px"><a href="https://events-storia.de/admin/leads/${esc(l.id)}">In Maestro öffnen →</a></p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 12px">
    <p style="font-size:12px;color:#888;margin:0">Diese Anfrage kam über das Online-Formular auf events-storia.de/anfrage. Lead-ID: ${esc(l.id)}</p>
  </body></html>`;
}

function subjectForScore(score: number, l: LeadRow): string {
  const parts = [fullName(l), fmtOccasion(l), fmtPeople(l.people_bucket)].filter(Boolean);
  const base = parts.join(" • ");
  if (score >= 70) return `Anfrage (Priorität): ${base}`;
  return `Anfrage: ${base}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let leadId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    leadId = typeof body?.lead_id === "string" ? body.lead_id : null;
    if (!leadId) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: lead, error: fetchErr } = await supabase
      .from("leads_funnel")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchErr || !lead) {
      return new Response(
        JSON.stringify({ error: "lead not found", detail: fetchErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const l = lead as LeadRow;

    // Idempotency: wenn bereits notified, no-op
    if (l.notified_at) {
      console.log("[lead-notify-funnel] noop already_notified", l.id);
      return new Response(
        JSON.stringify({ ok: true, score: l.lead_score, noop: true, reason: "already_notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const score = scoreLead(l);

    // Score persistieren + notified_at setzen (verhindert Doppelversand)
    const { error: updErr } = await supabase
      .from("leads_funnel")
      .update({ lead_score: score, notified_at: new Date().toISOString() })
      .eq("id", l.id)
      .is("notified_at", null);

    if (updErr) {
      console.error("[lead-notify-funnel] update score failed", updErr.message);
    }

    console.log("[lead-notify-funnel] processing", l.id, "score=", score, "internal_to=", INTERNAL_TO);

    // 1) Auto-Reply
    if (l.email) {
      try {
        await sendResend({
          from: FROM_AUTOREPLY,
          to: [l.email],
          subject: "Ihre Anfrage bei Storia — wir melden uns kurz",
          html: buildAutoReplyHtml(l),
          reply_to: "info@events-storia.de",
        });
        console.log("[lead-notify-funnel] auto_reply sent to", l.email);
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        console.error("[lead-notify-funnel] auto_reply failed:", msg);
        await logFailure(supabase, l.id, "auto_reply", msg);
      }
    }

    // 2) Interne Mail (mit optionalem Override)
    if (TEST_BLOCK) {
      console.log("[lead-notify-funnel] internal_mail BLOCKED (TESTMODE)");
    } else {
    try {
      await sendResend({
        from: FROM_INTERNAL,
        to: [INTERNAL_TO],
        subject: subjectForScore(score, l),
        html: buildInternalHtml(l, score),
        reply_to: l.email || undefined,
      });
      console.log("[lead-notify-funnel] internal_mail sent to", INTERNAL_TO);
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      console.error("[lead-notify-funnel] internal_mail failed:", msg);
      await logFailure(supabase, l.id, "internal_mail", msg);
    }
    }

    // Phase 1.5 stub — Slack hot-lead alert (commented)
    // if (score >= 70 && SLACK_ALERTS_WEBHOOK_URL) { ... }

    return new Response(JSON.stringify({
      ok: true,
      lead_id: l.id,
      lead_score: score,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lead-notify-funnel] unhandled", e);
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message ?? e), lead_id: leadId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
