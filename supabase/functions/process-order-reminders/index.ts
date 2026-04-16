/**
 * process-order-reminders
 *
 * Wird stündlich via pg_cron aufgerufen. Erledigt 2 Aufgaben:
 *
 * 1. LIEFERUNGS-ERINNERUNG:
 *    Sendet eine Erinnerungsmail an info@events-storia.de + info@ristorantestoria.de,
 *    wenn eine Bestellung in ~2 Tagen geliefert/abgeholt wird.
 *    Trigger-Zeitpunkt: 0:30 Uhr, zwei Tage vor Liefer-/Abholtag.
 *    Wenn die Bestellung zu spät reinkommt (weniger als 2 Tage vorher),
 *    wird KEINE Erinnerung verschickt.
 *
 * 2. AUTO-ERLEDIGT:
 *    Setzt Status von "pending"/"confirmed" auf "completed",
 *    wenn Liefer-/Abholzeit mehr als 1 Stunde in der Vergangenheit liegt.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

interface CateringOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  company_name: string | null;
  is_pickup: boolean;
  delivery_street: string | null;
  delivery_zip: string | null;
  delivery_city: string | null;
  desired_date: string | null;
  desired_time: string | null;
  total_amount: number | null;
  payment_method: string | null;
  payment_status: string | null;
  status: string;
  notes: string | null;
  items: unknown;
  reminder_sent_at: string | null;
}

const TEAM_RECIPIENTS = [
  'info@events-storia.de',
  'info@ristorantestoria.de',
];

/** Sendet eine Mail via Resend. Kein PDF-Anhang nötig. */
async function sendTeamEmail(subject: string, html: string): Promise<{ sent: boolean; provider: string; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          from: "STORIA System <info@events-storia.de>",
          to: TEAM_RECIPIENTS,
          subject,
          html,
        }),
      });
      if (res.ok) {
        return { sent: true, provider: "resend" };
      }
      return { sent: false, provider: "resend", error: await res.text() };
    } catch (err) {
      return { sent: false, provider: "resend", error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { sent: false, provider: "none", error: "No RESEND_API_KEY configured" };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return '<em>keine Artikel</em>';
  return '<ul style="margin: 0; padding-left: 20px;">' +
    items.map((it: { name?: string; quantity?: number }) => {
      const qty = it.quantity || 1;
      const name = escapeHtml(it.name || '?');
      return `<li>${qty}× ${name}</li>`;
    }).join('') +
    '</ul>';
}

function buildReminderEmail(o: CateringOrderRow, siteUrl: string): { subject: string; html: string } {
  const dateStr = o.desired_date
    ? new Date(o.desired_date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '?';
  const timeStr = o.desired_time ? `${o.desired_time} Uhr` : 'Zeit offen';
  const typeLabel = o.is_pickup ? '📦 Abholung' : '🚚 Lieferung';
  const addressHtml = o.is_pickup
    ? 'Karlstraße 43, 80333 München'
    : `${escapeHtml(o.delivery_street || '')}<br>${escapeHtml(o.delivery_zip || '')} ${escapeHtml(o.delivery_city || '')}`;

  const paymentLabel = o.payment_status === 'paid'
    ? '<span style="color: #047857; font-weight: 600;">✓ Bezahlt</span>'
    : (o.payment_method === 'cash' && o.is_pickup
      ? '<span style="color: #b45309; font-weight: 600;">Bezahlung bei Abholung</span>'
      : '<span style="color: #b91c1c; font-weight: 600;">⚠ Unbezahlt</span>');

  const subject = `Erinnerung: ${typeLabel} übermorgen — ${o.order_number} (${o.customer_name})`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background: #faf6f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #fff; border-radius: 12px; overflow: hidden;">
        <tr><td style="padding: 24px; border-bottom: 1px solid #f0ead8;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #999; letter-spacing: 0.15em; text-transform: uppercase;">Erinnerung · Übermorgen</p>
          <h1 style="margin: 0; font-size: 22px; color: #1a1a1a;">${typeLabel} ${escapeHtml(dateStr)} · ${escapeHtml(timeStr)}</h1>
        </td></tr>

        <tr><td style="padding: 24px;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td style="color: #666; width: 140px; vertical-align: top;">Bestellung</td>
              <td style="font-family: monospace; font-weight: 600;">${escapeHtml(o.order_number)}</td>
            </tr>
            <tr>
              <td style="color: #666; vertical-align: top;">Kunde</td>
              <td>
                <strong>${escapeHtml(o.customer_name)}</strong>
                ${o.company_name ? `<br><span style="color: #666;">${escapeHtml(o.company_name)}</span>` : ''}
              </td>
            </tr>
            <tr>
              <td style="color: #666; vertical-align: top;">Kontakt</td>
              <td>
                ${o.customer_phone ? `<a href="tel:${escapeHtml(o.customer_phone)}" style="color: #b45309; text-decoration: none;">📞 ${escapeHtml(o.customer_phone)}</a><br>` : ''}
                ${o.customer_email ? `<a href="mailto:${escapeHtml(o.customer_email)}" style="color: #b45309; text-decoration: none;">✉ ${escapeHtml(o.customer_email)}</a>` : ''}
              </td>
            </tr>
            <tr>
              <td style="color: #666; vertical-align: top;">Adresse</td>
              <td>${addressHtml}</td>
            </tr>
            <tr>
              <td style="color: #666; vertical-align: top;">Artikel</td>
              <td>${formatItems(o.items)}</td>
            </tr>
            <tr>
              <td style="color: #666; vertical-align: top;">Summe</td>
              <td style="font-weight: 600;">${o.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || '—'}</td>
            </tr>
            <tr>
              <td style="color: #666; vertical-align: top;">Zahlstatus</td>
              <td>${paymentLabel}</td>
            </tr>
            ${o.notes ? `<tr><td style="color: #666; vertical-align: top;">Notizen</td><td style="white-space: pre-wrap;">${escapeHtml(o.notes)}</td></tr>` : ''}
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="${siteUrl}/admin/orders/${o.id}/edit"
               style="display: inline-block; background: #b45309; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;">
              In Maestro öffnen
            </a>
          </div>
        </td></tr>

        <tr><td style="padding: 16px; background: #faf6f0; text-align: center; font-size: 11px; color: #999;">
          Automatische Erinnerung · STORIA Maestro
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://events-storia.de';
  const now = new Date();
  const nowIso = now.toISOString();

  // Europe/Berlin Datum für Vergleiche
  const berlinFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }); // yyyy-mm-dd
  const today = berlinFmt.format(now);
  const twoDaysAhead = berlinFmt.format(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));

  const stats = {
    remindersSent: 0,
    remindersSkipped: 0,
    remindersFailed: 0,
    autoCompleted: 0,
    errors: [] as string[],
  };

  // === 1. REMINDER ===
  try {
    const { data: pendingReminders, error: fetchErr } = await supabase
      .from('catering_orders')
      .select('*')
      .in('status', ['pending', 'confirmed'])
      .eq('desired_date', twoDaysAhead)
      .is('reminder_sent_at', null);

    if (fetchErr) throw fetchErr;

    for (const order of (pendingReminders || []) as CateringOrderRow[]) {
      try {
        if (!order.desired_date || order.desired_date < today) {
          stats.remindersSkipped++;
          continue;
        }

        const { subject, html } = buildReminderEmail(order, siteUrl);
        const result = await sendTeamEmail(subject, html);

        if (result.sent) {
          await supabase
            .from('catering_orders')
            .update({ reminder_sent_at: nowIso })
            .eq('id', order.id);
          stats.remindersSent++;
        } else {
          stats.remindersFailed++;
          stats.errors.push(`Reminder ${order.order_number}: ${result.error}`);
        }
      } catch (err) {
        stats.remindersFailed++;
        stats.errors.push(`Reminder ${order.order_number}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    stats.errors.push(`Reminder fetch: ${err instanceof Error ? err.message : String(err)}`);
  }

  // === 2. AUTO-ERLEDIGT ===
  try {
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000); // vor 1 Stunde
    const cutoffDate = berlinFmt.format(cutoff);
    const cutoffTime = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(cutoff);

    const { data: candidates, error: fetchErr } = await supabase
      .from('catering_orders')
      .select('id, order_number, desired_date, desired_time, status')
      .in('status', ['pending', 'confirmed'])
      .not('desired_date', 'is', null)
      .lte('desired_date', cutoffDate);

    if (fetchErr) throw fetchErr;

    for (const order of (candidates || []) as Array<{ id: string; order_number: string; desired_date: string; desired_time: string | null; status: string }>) {
      let shouldComplete = false;
      if (order.desired_date < cutoffDate) {
        shouldComplete = true;
      } else if (order.desired_date === cutoffDate) {
        if (order.desired_time) {
          const orderTime = order.desired_time.substring(0, 5);
          if (orderTime <= cutoffTime) shouldComplete = true;
        }
      }

      if (shouldComplete) {
        await supabase
          .from('catering_orders')
          .update({ status: 'completed' })
          .eq('id', order.id);
        stats.autoCompleted++;
      }
    }
  } catch (err) {
    stats.errors.push(`Auto-complete: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('process-order-reminders:', JSON.stringify(stats));

  return new Response(
    JSON.stringify({ success: true, ...stats }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
});
