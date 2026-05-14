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
const FROM_AUTOREPLY = "Familia Speranza <info@events-storia.de>";
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
    case "10-20": return "10–20 Personen";
    case "20-50": return "20–50 Personen";
    case "50-100": return "50–100 Personen";
    case "100+": return "über 100 Personen";
    default: return b || "—";
  }
}
function fmtDate(l: LeadRow) {
  if (l.date_mode === "fixed" && l.date_value) return l.date_value;
  if (l.date_mode === "range" && l.date_range_start && l.date_range_end) {
    return `${l.date_range_start} – ${l.date_range_end}`;
  }
  if (l.date_mode === "flexible") return "Flexibel (mehrere Termine möglich)";
  return "Termin noch offen";
}
function fmtOccasion(l: LeadRow) {
  if (l.occasion === "other") return l.occasion_other || "Sonstiges";
  return l.occasion || "—";
}
function fmtIntent(i: string | null) {
  switch (i) {
    case "catering": return "Catering";
    case "location": return "Location bei Storia";
    case "both": return "Catering + Location";
    case "consult": return "Erstberatung";
    case "unsure": return "Noch unentschieden";
    default: return i || "—";
  }
}
function fullName(l: LeadRow) {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
}
function esc(s: string | null | undefined) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAutoReplyHtml(l: LeadRow): string {
  const name = l.first_name ? esc(l.first_name) : "Sie";
  const formatLine = l.format ? `Format: ${esc(l.format)}<br>` : "";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
    <p>Liebe/r ${name},</p>
    <p>vielen Dank für Ihre Anfrage bei Familia Speranza. Wir haben Ihre Angaben erhalten und melden uns innerhalb eines Werktags persönlich bei Ihnen.</p>
    <p><strong>Ihre Anfrage im Überblick:</strong><br>
    Anlass: ${esc(fmtOccasion(l))}<br>
    Personen: ${esc(fmtPeople(l.people_bucket))}<br>
    Datum: ${esc(fmtDate(l))}<br>
    ${formatLine}Anliegen: ${esc(fmtIntent(l.intent))}</p>
    <p>Bei Rückfragen erreichen Sie uns jederzeit unter <a href="mailto:info@events-storia.de">info@events-storia.de</a>.</p>
    <p>Herzliche Grüße<br>Familia Speranza<br>Storia Restaurant &amp; Catering</p>
  </body></html>`;
}

function buildInternalHtml(l: LeadRow, score: number): string {
  const utm = [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || "—";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6">
    <h2 style="margin:0 0 12px">Neuer Lead — Score ${score}${score >= 70 ? " 🔥" : ""}</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      <tr><td><b>Name</b></td><td>${esc(fullName(l))}</td></tr>
      <tr><td><b>E-Mail</b></td><td>${esc(l.email)}</td></tr>
      <tr><td><b>Telefon</b></td><td>${esc(l.phone)}</td></tr>
      <tr><td><b>Anliegen</b></td><td>${esc(fmtIntent(l.intent))}</td></tr>
      <tr><td><b>Anlass</b></td><td>${esc(fmtOccasion(l))}</td></tr>
      <tr><td><b>Personen</b></td><td>${esc(fmtPeople(l.people_bucket))}</td></tr>
      <tr><td><b>Datum</b></td><td>${esc(fmtDate(l))}</td></tr>
      <tr><td><b>Format</b></td><td>${esc(l.format) || "—"}</td></tr>
      <tr><td><b>Notiz</b></td><td>${esc(l.notes)}</td></tr>
      <tr><td><b>UTM</b></td><td>${esc(utm)}</td></tr>
      <tr><td><b>Quelle</b></td><td>${esc(l.source_url)}</td></tr>
      <tr><td><b>Lead-ID</b></td><td><code>${esc(l.id)}</code></td></tr>
    </table>
    <p style="margin-top:16px"><a href="https://events-storia.de/admin/leads/${esc(l.id)}">In Maestro öffnen</a></p>
  </body></html>`;
}

function subjectForScore(score: number, l: LeadRow): string {
  const base = `${fullName(l)} • ${fmtOccasion(l)} • ${fmtPeople(l.people_bucket)}`;
  if (score >= 70) return `🔥 HOT LEAD (${score}) — ${base}`;
  return `Lead (${score}) — ${base}`;
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
          subject: "Wir haben Ihre Anfrage erhalten — Familia Speranza",
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
      score,
      internal_to: TEST_BLOCK ? "BLOCKED" : INTERNAL_TO,
      override_raw_len: OVERRIDE_RAW.length,
      override_trimmed: OVERRIDE_TRIMMED ? OVERRIDE_TRIMMED.replace(/(.{2}).+(@.+)/, "$1***$2") : null,
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
