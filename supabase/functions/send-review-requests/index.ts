// Sends Google review request emails 2 business days after catering events.
// Triggered by pg_cron daily at 10:00 Europe/Berlin.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { sendEmailWithFallback } from '../_shared/email-sender.ts';

const BAVARIAN_HOLIDAYS = new Set<string>([
  '2026-01-01','2026-01-06','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-06-04','2026-08-15','2026-10-03','2026-11-01','2026-12-25','2026-12-26',
  '2027-01-01','2027-01-06','2027-03-26','2027-03-29','2027-05-01','2027-05-06','2027-05-17','2027-05-27','2027-08-15','2027-10-03','2027-11-01','2027-12-25','2027-12-26',
]);

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !BAVARIAN_HOLIDAYS.has(d.toISOString().slice(0, 10));
}

function subtractBusinessDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let remaining = n;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSubject(lang: string, name: string): string {
  const safe = name ? `, ${name}` : '';
  if (lang === 'en') return `Your STORIA catering experience${safe} — would you share it?`;
  return `Wie war Ihr Catering${safe}? Eine kleine Bitte`;
}

function buildHtml(opts: { greetingName: string; googleUrl: string; lang: string; unsubscribeUrl: string }): string {
  const { greetingName, googleUrl, lang, unsubscribeUrl } = opts;
  const greeting = greetingName ? `Guten Tag ${escapeHtml(greetingName)},` : 'Guten Tag,';
  const greetingEn = greetingName ? `Dear ${escapeHtml(greetingName)},` : 'Dear guest,';

  const deBlock = `
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:36px;color:#6b1f2a;font-weight:600;">Grazie für Ihr Vertrauen</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2a2520;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2a2520;">Ihr Catering mit uns liegt nun ein paar Tage zurück. Wir hoffen, es hat Ihnen und Ihren Gästen geschmeckt.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#2a2520;">Wenn Sie zwei Minuten erübrigen können, würden wir uns sehr freuen, wenn Sie Ihre Erfahrung mit uns auf Google teilen. Ein paar ehrliche Zeilen genügen – und sie helfen anderen, die gerade ein Catering für ihren eigenen Anlass suchen.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 24px;"><tr><td bgcolor="#6b1f2a" style="border-radius:6px;">
      <a href="${escapeHtml(googleUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;">Auf Google bewerten</a>
    </td></tr></table>
    <hr style="border:0;border-top:1px solid #e8e0d2;margin:24px 0;" />
    <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#6b6258;">Sie möchten uns lieber direkt etwas sagen – ob Lob oder Kritik? Antworten Sie einfach auf diese E-Mail. Wir freuen uns auf Ihre Rückmeldung.</p>
    <p style="margin:0 0 4px;font-size:15px;line-height:22px;color:#2a2520;">Mit herzlichen Grüßen aus der Maxvorstadt</p>
    <p style="margin:0 0 2px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#6b1f2a;">Domenico Speranza</p>
    <p style="margin:0;font-size:14px;color:#9a9388;">STORIA Catering &amp; Events</p>
  `;

  const enBlock = lang === 'en' ? `
    <hr style="border:0;border-top:1px dashed #d9d2c5;margin:32px 0;" />
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:32px;color:#6b1f2a;font-weight:600;">Thank you for your trust</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2a2520;">${greetingEn}</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2a2520;">Your catering with us is a few days behind you. We hope you and your guests enjoyed it.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#2a2520;">If you can spare two minutes, we would be delighted if you shared your experience on Google. A few honest lines are enough.</p>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${lang === 'en' ? 'en' : 'de'}"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>STORIA Catering</title>
<style>@media only screen and (max-width:600px){.container{width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#efe7d6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Ihre Erfahrung in zwei Minuten geteilt – wir freuen uns über Ihre Rückmeldung.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#efe7d6"><tr><td align="center" style="padding:24px 16px;">
  <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#f8f1e4;border-radius:8px;overflow:hidden;">
    <tr><td bgcolor="#6b1f2a" style="padding:32px 24px;border-bottom:3px solid #c9a96e;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:20px;color:#f8f1e4;letter-spacing:2px;">STORIA</div>
      <div style="margin-top:8px;font-size:11px;color:#c9a96e;letter-spacing:3px;">CATERING · EVENTS · LIEFERSERVICE</div>
    </td></tr>
    <tr><td class="px" style="padding:40px 40px 32px;">${deBlock}${enBlock}</td></tr>
    <tr><td bgcolor="#6b1f2a" class="px" style="padding:32px 40px;color:#e8d9b5;font-size:13px;line-height:20px;">
      <div style="font-family:Georgia,serif;font-size:16px;color:#f8f1e4;letter-spacing:2px;margin-bottom:12px;">STORIA</div>
      <div>Karlstraße 47a · 80333 München</div>
      <div>+49 89 51519696 · <a href="mailto:info@events-storia.de" style="color:#e8d9b5;text-decoration:none;">info@events-storia.de</a></div>
      <div><a href="https://events-storia.de" style="color:#e8d9b5;text-decoration:underline;">events-storia.de</a> · <a href="https://instagram.com/storia_muenchen" style="color:#e8d9b5;text-decoration:underline;">Instagram</a></div>
      <div style="margin-top:16px;font-size:12px;color:#c9a96e;">Sie erhalten diese E-Mail, weil wir für Sie ein Catering durchgeführt haben. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#c9a96e;text-decoration:underline;">Keine weiteren Nachrichten erhalten</a> · <a href="https://events-storia.de/impressum" style="color:#c9a96e;text-decoration:underline;">Impressum</a> · <a href="https://events-storia.de/datenschutz" style="color:#c9a96e;text-decoration:underline;">Datenschutz</a></div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { mode?: 'live' | 'dry'; testRecipient?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* cron */ }
  const mode = body.mode === 'dry' ? 'dry' : 'live';

  const { data: settings, error: sErr } = await supabase
    .from('review_request_settings').select('*').eq('id', true).maybeSingle();
  if (sErr || !settings) {
    return new Response(JSON.stringify({ ok: false, error: 'settings_unavailable' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (body.testRecipient) {
    const html = buildHtml({
      greetingName: 'Max Mustermann',
      googleUrl: settings.google_review_url,
      lang: 'de',
      unsubscribeUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/review-unsubscribe?email=${encodeURIComponent(body.testRecipient)}&token=preview`,
    });
    const res = await sendEmailWithFallback({
      to: body.testRecipient,
      subject: '[TEST] ' + buildSubject('de', 'Max'),
      html, replyTo: 'info@events-storia.de',
    });
    await supabase.from('review_request_log').insert({
      source: 'manual_test', recipient_email: body.testRecipient,
      status: res.success ? 'sent' : 'failed', provider: res.provider,
      message_id: res.messageId, error_message: res.success ? null : (res.resendError || res.smtpError),
    });
    return new Response(JSON.stringify({ ok: res.success, test: true, provider: res.provider }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!settings.enabled && !body.force) {
    return new Response(JSON.stringify({ ok: true, skipped: 'disabled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const delay = Math.max(1, Number(settings.delay_business_days) || 2);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const targetDate = subtractBusinessDays(today, delay).toISOString().slice(0, 10);

  const orFilters: string[] = [];
  if (settings.scope_orders) orFilters.push('source_catering_id.not.is.null');
  if (settings.scope_events) orFilters.push('source_catering_id.is.null');
  if (orFilters.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_scope' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: events, error: eErr } = await supabase
    .from('v2_events')
    .select('id, date, customer_id, customer_language, billing_name, source_catering_id, is_test, archived, customer:v2_customers(name, email)')
    .eq('status', 'completed')
    .eq('date', targetDate)
    .or(orFilters.join(','));

  if (eErr) {
    await supabase.from('review_request_settings').update({ last_run_at: new Date().toISOString(), last_run_error: eErr.message }).eq('id', true);
    return new Response(JSON.stringify({ ok: false, error: eErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let sent = 0, skipped = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const ev of events ?? []) {
    if (ev.is_test || ev.archived) { skipped++; continue; }
    const customer = (ev as { customer?: { email?: string; name?: string } }).customer;
    const email = customer?.email?.trim().toLowerCase();
    const name = customer?.name || ev.billing_name || '';
    if (!email) { skipped++; continue; }

    const { data: prior } = await supabase
      .from('review_request_log').select('id').eq('event_id', ev.id).in('status', ['sent','failed']).maybeSingle();
    if (prior) { skipped++; continue; }

    const { data: unsub } = await supabase
      .from('review_request_unsubscribes').select('email').eq('email', email).maybeSingle();
    if (unsub) {
      await supabase.from('review_request_log').insert({
        event_id: ev.id, source: ev.source_catering_id ? 'order' : 'event',
        recipient_email: email, recipient_name: name, status: 'skipped_unsubscribed',
      });
      skipped++; continue;
    }

    const lang = (ev.customer_language || 'de').toLowerCase();
    const unsubscribeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/review-unsubscribe?email=${encodeURIComponent(email)}`;
    const html = buildHtml({ greetingName: name, googleUrl: settings.google_review_url, lang, unsubscribeUrl });
    const subject = buildSubject(lang, name.split(' ')[0] || '');

    if (mode === 'dry') {
      await supabase.from('review_request_log').insert({
        event_id: ev.id, source: ev.source_catering_id ? 'order' : 'event',
        recipient_email: email, recipient_name: name, language: lang, status: 'dry_run',
      });
      results.push({ event_id: ev.id, email, mode: 'dry' });
      skipped++;
      continue;
    }

    const sendResult = await sendEmailWithFallback({
      to: email,
      bcc: settings.bcc_email || undefined,
      subject, html, replyTo: 'info@events-storia.de',
    });

    await supabase.from('review_request_log').insert({
      event_id: ev.id,
      source: ev.source_catering_id ? 'order' : 'event',
      recipient_email: email, recipient_name: name, language: lang,
      status: sendResult.success ? 'sent' : 'failed',
      provider: sendResult.provider, message_id: sendResult.messageId,
      error_message: sendResult.success ? null : (sendResult.resendError || sendResult.smtpError),
    });
    if (sendResult.success) sent++; else skipped++;
    results.push({ event_id: ev.id, email, success: sendResult.success });
  }

  await supabase.from('review_request_settings').update({
    last_run_at: new Date().toISOString(),
    last_run_sent_count: sent,
    last_run_skipped_count: skipped,
    last_run_error: null,
  }).eq('id', true);

  return new Response(JSON.stringify({ ok: true, mode, targetDate, sent, skipped, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
