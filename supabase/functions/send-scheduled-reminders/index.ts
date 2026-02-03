import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// German date formatting
const formatDateGerman = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
};

// Calculate days between two dates
const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
};

async function sendEmail(to: string, subject: string, body: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  if (!smtpUser || !smtpPassword) {
    console.error("SMTP credentials not configured");
    return false;
  }

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: true,
      auth: {
        username: smtpUser,
        password: smtpPassword,
      },
    },
  });

  try {
    await client.send({
      from: `STORIA Events <${smtpUser}>`,
      to: [to],
      subject: subject,
      html: `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${body}</div>
</body>
</html>`,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return false;
  } finally {
    try {
      await client.close();
    } catch (e) {
      // ignore close errors
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results = {
      offerReminders: 0,
      menuReminders: 0,
      eventTomorrowReminders: 0,
      errors: 0,
    };

    // ============================================
    // 1. OFFER REMINDERS (Day 3 and Day 7)
    // Find inquiries with offer_sent but not confirmed/declined
    // ============================================
    const { data: pendingOffers } = await supabase
      .from('event_inquiries')
      .select('*')
      .eq('status', 'offer_sent')
      .is('converted_to_booking_id', null);

    for (const inquiry of (pendingOffers || [])) {
      if (!inquiry.offer_sent_at || !inquiry.email) continue;

      const offerSentDate = new Date(inquiry.offer_sent_at);
      const daysSinceSent = daysBetween(offerSentDate, now);
      const reminderCount = inquiry.reminder_count || 0;

      // Day 3 reminder (first reminder)
      if (daysSinceSent >= 3 && daysSinceSent < 7 && reminderCount === 0) {
        const sent = await sendEmail(
          inquiry.email,
          "Erinnerung: Ihr Angebot wartet auf Sie",
          `Guten Tag ${inquiry.contact_name},

wir möchten Sie freundlich an unser Angebot für Ihr Event am ${inquiry.preferred_date ? formatDateGerman(inquiry.preferred_date) : 'Ihrem Wunschtermin'} erinnern.

Falls Sie noch Fragen haben oder Änderungen wünschen, stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr STORIA Events Team

Tel: +49 89 51519696
E-Mail: info@events-storia.de`
        );

        if (sent) {
          await supabase
            .from('event_inquiries')
            .update({
              reminder_count: 1,
              reminder_sent_at: now.toISOString()
            })
            .eq('id', inquiry.id);
          results.offerReminders++;
        } else {
          results.errors++;
        }
      }

      // Day 7 reminder (final reminder)
      if (daysSinceSent >= 7 && reminderCount === 1) {
        const sent = await sendEmail(
          inquiry.email,
          "Letzte Erinnerung: Ihr Angebot läuft bald ab",
          `Guten Tag ${inquiry.contact_name},

dies ist eine letzte freundliche Erinnerung an unser Angebot für Ihr Event.

Unser Angebot ist noch bis Ende dieser Woche gültig. Wenn Sie Interesse haben, melden Sie sich bitte zeitnah bei uns.

Mit freundlichen Grüßen
Ihr STORIA Events Team

Tel: +49 89 51519696
E-Mail: info@events-storia.de`
        );

        if (sent) {
          await supabase
            .from('event_inquiries')
            .update({
              reminder_count: 2,
              reminder_sent_at: now.toISOString()
            })
            .eq('id', inquiry.id);
          results.offerReminders++;
        } else {
          results.errors++;
        }
      }
    }

    // ============================================
    // 2. MENU CONFIRMATION REMINDERS (7 days before event)
    // Find bookings with menu_confirmed = false
    // ============================================
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    const { data: pendingMenuBookings } = await supabase
      .from('event_bookings')
      .select('*')
      .eq('menu_confirmed', false)
      .eq('status', 'menu_pending')
      .lte('event_date', sevenDaysStr);

    for (const booking of (pendingMenuBookings || [])) {
      if (!booking.customer_email || !booking.event_date) continue;

      const eventDate = new Date(booking.event_date);
      const daysUntilEvent = daysBetween(now, eventDate);

      // Only send if event is 5-7 days away (gives customer time to respond)
      if (daysUntilEvent >= 5 && daysUntilEvent <= 7) {
        const sent = await sendEmail(
          booking.customer_email,
          `Bitte bestätigen Sie Ihr Menü für ${formatDateGerman(booking.event_date)}`,
          `Guten Tag ${booking.customer_name},

Ihr Event bei STORIA findet in einer Woche statt!

Bitte bestätigen Sie noch Ihre Menüauswahl, damit wir alles perfekt für Sie vorbereiten können.

Event-Datum: ${formatDateGerman(booking.event_date)}
Gästeanzahl: ${booking.guest_count} Personen

Bei Fragen oder Änderungswünschen erreichen Sie uns unter:
Tel: +49 89 51519696
E-Mail: info@events-storia.de

Wir freuen uns auf Ihr Event!

Mit freundlichen Grüßen
Ihr STORIA Events Team`
        );

        if (sent) {
          results.menuReminders++;
        } else {
          results.errors++;
        }
      }
    }

    // ============================================
    // 3. EVENT TOMORROW REMINDERS
    // Find bookings where event_date = tomorrow
    // ============================================
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: tomorrowBookings } = await supabase
      .from('event_bookings')
      .select('*')
      .eq('event_date', tomorrowStr)
      .in('status', ['ready', 'confirmed']);

    for (const booking of (tomorrowBookings || [])) {
      if (!booking.customer_email) continue;

      const sent = await sendEmail(
        booking.customer_email,
        "Ihr Event bei STORIA ist morgen!",
        `Guten Tag ${booking.customer_name},

wir freuen uns, Sie morgen bei STORIA begrüßen zu dürfen!

Event-Details:
Datum: ${formatDateGerman(booking.event_date)}
${booking.event_time ? `Uhrzeit: ${booking.event_time} Uhr` : ''}
Gästeanzahl: ${booking.guest_count} Personen

Unser Team hat alles für Sie vorbereitet und freut sich auf einen wunderbaren Abend mit Ihnen.

Bei kurzfristigen Fragen erreichen Sie uns unter:
Tel: +49 89 51519696

Bis morgen!

Ihr STORIA Events Team`
      );

      if (sent) {
        results.eventTomorrowReminders++;
      } else {
        results.errors++;
      }
    }

    console.log("Scheduled reminders completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Scheduled reminders processed",
        results
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-scheduled-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  }
};

serve(handler);
