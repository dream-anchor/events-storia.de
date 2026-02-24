import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface ReminderResult {
  type: string;
  inquiryId?: string;
  bookingId?: string;
  email: string;
  success: boolean;
  error?: string;
}

interface SendResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
  errorMessage: string | null;
}

async function sendEmail(
  to: string[],
  subject: string,
  htmlContent: string,
  fromName: string
): Promise<SendResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  let sent = false;
  let provider = "";
  let messageId: string | null = null;
  let errorMessage: string | null = null;

  const fullHtml = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  ${htmlContent}
</body>
</html>`;

  // Resend (primär)
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          from: `${fromName} <info@events-storia.de>`,
          to: to,
          subject: subject,
          html: fullHtml,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        sent = true;
        provider = "resend";
        messageId = data.id || null;
        console.log(`Reminder sent via Resend to: ${to.join(", ")}`);
      } else {
        errorMessage = `Resend error: ${await res.text()}`;
        console.error(errorMessage);
      }
    } catch (resendErr) {
      errorMessage = resendErr instanceof Error ? resendErr.message : "Resend error";
      console.error("Resend exception:", errorMessage);
    }
  }

  // SMTP Fallback
  if (!sent && smtpUser && smtpPassword) {
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");

      const client = new SMTPClient({
        connection: { hostname: smtpHost, port: smtpPort, tls: true, auth: { username: smtpUser, password: smtpPassword } },
      });

      await client.send({ from: `${fromName} <${smtpUser}>`, to, subject, html: fullHtml });
      await client.close();
      sent = true;
      provider = "ionos_smtp";
      errorMessage = null;
      console.log(`Reminder sent via IONOS SMTP (fallback) to: ${to.join(", ")}`);
    } catch (smtpErr) {
      errorMessage = smtpErr instanceof Error ? smtpErr.message : "SMTP error";
      console.error("SMTP fallback error:", errorMessage);
    }
  }

  if (!sent && !resendApiKey && !smtpUser) {
    errorMessage = "No email provider configured";
  }

  return { sent, provider, messageId, errorMessage };
}

// deno-lint-ignore no-explicit-any
async function logEmailDelivery(
  supabase: any,
  data: {
    entity_type: string;
    entity_id: string;
    recipient_email: string;
    recipient_name: string | null;
    subject: string;
    provider: string;
    provider_message_id: string | null;
    status: string;
    error_message?: string | null;
  }
) {
  try {
    await supabase.from("email_delivery_logs").insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      recipient_email: data.recipient_email,
      recipient_name: data.recipient_name,
      subject: data.subject,
      provider: data.provider || "none",
      provider_message_id: data.provider_message_id,
      status: data.status,
      error_message: data.error_message || null,
      sent_by: "system",
      metadata: { reminder: true },
    });
  } catch (error) {
    console.error("Failed to log email delivery:", error);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: ReminderResult[] = [];
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    console.log(`Running scheduled reminders at ${now.toISOString()}`);

    // ============================================
    // 1. ANGEBOTE OHNE ZAHLUNG (Tag 3 + Tag 7)
    // ============================================
    const { data: pendingOffers, error: offersError } = await supabase
      .from("event_inquiries")
      .select("id, email, contact_name, company_name, preferred_date, offer_sent_at, reminder_count")
      .eq("status", "offer_sent")
      .not("offer_sent_at", "is", null);

    if (offersError) {
      console.error("Error fetching pending offers:", offersError);
    } else if (pendingOffers) {
      for (const inquiry of pendingOffers) {
        if (!inquiry.offer_sent_at || !inquiry.email) continue;

        const offerSentDate = new Date(inquiry.offer_sent_at);
        const daysSinceOffer = Math.floor(
          (now.getTime() - offerSentDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const reminderCount = inquiry.reminder_count || 0;

        // Erster Reminder nach 3 Tagen, zweiter nach 7 Tagen
        const shouldSendReminder =
          (daysSinceOffer >= 3 && reminderCount === 0) ||
          (daysSinceOffer >= 7 && reminderCount === 1);

        if (shouldSendReminder) {
          const reminderNumber = reminderCount + 1;
          const subject =
            reminderNumber === 1
              ? "Erinnerung: Ihr Angebot von STORIA wartet auf Sie"
              : "Letzte Erinnerung: Ihr STORIA Angebot läuft bald ab";

          const html = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a;">Erinnerung an Ihr Angebot</h2>
              <p>Sehr geehrte/r ${inquiry.contact_name || "Kunde"},</p>
              <p>wir haben vor ${daysSinceOffer} Tagen ein Angebot für Ihre Veranstaltung${
            inquiry.preferred_date ? ` am ${inquiry.preferred_date}` : ""
          } erstellt.</p>
              <p>Falls Sie noch Fragen haben oder Änderungen wünschen, stehen wir Ihnen gerne zur Verfügung.</p>
              ${
                reminderNumber === 2
                  ? '<p style="color: #c0392b;"><strong>Bitte beachten Sie:</strong> Um Ihren Wunschtermin zu sichern, benötigen wir zeitnah Ihre Rückmeldung.</p>'
                  : ""
              }
              <p style="margin-top: 20px;">Mit freundlichen Grüßen<br>Ihr STORIA Events Team</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #666;">
                STORIA Ristorante & Events<br>
                Buttermelcherstraße 9, 80469 München<br>
                Tel: 089 20328484
              </p>
            </div>
          `;

          const offerResult = await sendEmail([inquiry.email], subject, html, "STORIA Events");

          if (offerResult.sent) {
            await supabase
              .from("event_inquiries")
              .update({
                reminder_count: reminderNumber,
                reminder_sent_at: now.toISOString(),
              })
              .eq("id", inquiry.id);
          }

          await logEmailDelivery(supabase, {
            entity_type: "event_inquiry",
            entity_id: inquiry.id,
            recipient_email: inquiry.email,
            recipient_name: inquiry.contact_name,
            subject: subject,
            provider: offerResult.provider || "none",
            provider_message_id: offerResult.messageId,
            status: offerResult.sent ? "sent" : "failed",
            error_message: offerResult.errorMessage,
          });

          results.push({
            type: "offer_reminder",
            inquiryId: inquiry.id,
            email: inquiry.email,
            success: offerResult.sent,
            error: offerResult.errorMessage || undefined,
          });
        }
      }
    }

    // ============================================
    // 2. MENÜ NICHT BESTÄTIGT (7 Tage vor Event)
    // ============================================
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysDate = sevenDaysFromNow.toISOString().split("T")[0];

    const { data: pendingMenus, error: menusError } = await supabase
      .from("event_bookings")
      .select("id, customer_email, customer_name, event_date, booking_number")
      .eq("menu_confirmed", false)
      .eq("event_date", sevenDaysDate)
      .in("status", ["menu_pending", "confirmed"]);

    if (menusError) {
      console.error("Error fetching pending menus:", menusError);
    } else if (pendingMenus) {
      for (const booking of pendingMenus) {
        if (!booking.customer_email) continue;

        const subject = `Menü-Bestätigung erforderlich für Ihr Event am ${booking.event_date}`;
        const html = `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Menü-Bestätigung erforderlich</h2>
            <p>Sehr geehrte/r ${booking.customer_name || "Kunde"},</p>
            <p>Ihr Event am <strong>${booking.event_date}</strong> rückt näher!</p>
            <p>Damit wir alle Vorbereitungen treffen können, bitten wir Sie, Ihre Menüauswahl zeitnah zu bestätigen.</p>
            <p>Bitte kontaktieren Sie uns per E-Mail oder telefonisch, um Ihre Auswahl zu finalisieren.</p>
            <p style="margin-top: 20px;">Mit freundlichen Grüßen<br>Ihr STORIA Events Team</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              Buchungsnummer: ${booking.booking_number}<br>
              STORIA Ristorante & Events<br>
              Tel: 089 20328484
            </p>
          </div>
        `;

        const menuResult = await sendEmail([booking.customer_email], subject, html, "STORIA Events");

        await logEmailDelivery(supabase, {
          entity_type: "event_booking",
          entity_id: booking.id,
          recipient_email: booking.customer_email,
          recipient_name: booking.customer_name,
          subject: subject,
          provider: menuResult.provider || "none",
          provider_message_id: menuResult.messageId,
          status: menuResult.sent ? "sent" : "failed",
          error_message: menuResult.errorMessage,
        });

        results.push({
          type: "menu_reminder",
          bookingId: booking.id,
          email: booking.customer_email,
          success: menuResult.sent,
          error: menuResult.errorMessage || undefined,
        });
      }
    }

    // ============================================
    // 3. EVENT IST MORGEN
    // ============================================
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const { data: tomorrowEvents, error: eventsError } = await supabase
      .from("event_bookings")
      .select("id, customer_email, customer_name, event_date, event_time, booking_number, guest_count")
      .eq("event_date", tomorrowDate)
      .in("status", ["confirmed", "menu_pending"]);

    if (eventsError) {
      console.error("Error fetching tomorrow events:", eventsError);
    } else if (tomorrowEvents) {
      for (const booking of tomorrowEvents) {
        if (!booking.customer_email) continue;

        const subject = `Ihr Event bei STORIA ist morgen – Alle wichtigen Infos`;
        const html = `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Ihr Event ist morgen! 🎉</h2>
            <p>Sehr geehrte/r ${booking.customer_name || "Kunde"},</p>
            <p>Wir freuen uns, Sie morgen bei uns begrüßen zu dürfen!</p>
            
            <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Event-Details</h3>
              <p><strong>Datum:</strong> ${booking.event_date}</p>
              ${booking.event_time ? `<p><strong>Uhrzeit:</strong> ${booking.event_time}</p>` : ""}
              <p><strong>Gäste:</strong> ${booking.guest_count} Personen</p>
              <p><strong>Buchungsnummer:</strong> ${booking.booking_number}</p>
            </div>
            
            <h3>Wichtige Informationen</h3>
            <ul style="color: #555;">
              <li>Adresse: Buttermelcherstraße 9, 80469 München</li>
              <li>Bei Ankunft bitte an der Rezeption melden</li>
              <li>Bei Fragen erreichen Sie uns unter 089 20328484</li>
            </ul>
            
            <p style="margin-top: 20px;">Wir freuen uns auf Sie!</p>
            <p>Ihr STORIA Events Team</p>
          </div>
        `;

        const tomorrowResult = await sendEmail([booking.customer_email], subject, html, "STORIA Events");

        await logEmailDelivery(supabase, {
          entity_type: "event_booking",
          entity_id: booking.id,
          recipient_email: booking.customer_email,
          recipient_name: booking.customer_name,
          subject: subject,
          provider: tomorrowResult.provider || "none",
          provider_message_id: tomorrowResult.messageId,
          status: tomorrowResult.sent ? "sent" : "failed",
          error_message: tomorrowResult.errorMessage,
        });

        results.push({
          type: "event_tomorrow",
          bookingId: booking.id,
          email: booking.customer_email,
          success: tomorrowResult.sent,
          error: tomorrowResult.errorMessage || undefined,
        });
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Reminder job completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failCount,
        },
        results: results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in send-scheduled-reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
