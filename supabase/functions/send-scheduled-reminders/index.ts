import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getCorsHeaders } from '../_shared/cors.ts';



interface ReminderResult {
  type: string;
  inquiryId?: string;
  bookingId?: string;
  email: string;
  success: boolean;
  error?: string;
}

async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  fromName: string
): Promise<void> {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP credentials not configured");
  }

  console.log(`Sending reminder email to: ${to.join(", ")}`);

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: true,
      auth: { username: smtpUser, password: smtpPassword },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: to,
      subject: subject,
      html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  ${html}
</body>
</html>`,
    });
    console.log(`Email sent successfully to ${to.join(", ")}`);
  } finally {
    await client.close();
  }
}

async function logEmailDelivery(
  supabase: any,
  data: {
    entity_type: string;
    entity_id: string;
    recipient_email: string;
    recipient_name: string | null;
    subject: string;
    status: string;
    error_message?: string;
  }
) {
  try {
    await supabase.from("email_delivery_logs").insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      recipient_email: data.recipient_email,
      recipient_name: data.recipient_name,
      subject: data.subject,
      provider: "ionos_smtp",
      status: data.status,
      error_message: data.error_message || null,
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

          try {
            await sendEmail([inquiry.email], subject, html, "STORIA Events");

            // Update reminder count
            await supabase
              .from("event_inquiries")
              .update({
                reminder_count: reminderNumber,
                reminder_sent_at: now.toISOString(),
              })
              .eq("id", inquiry.id);

            await logEmailDelivery(supabase, {
              entity_type: "event_inquiry",
              entity_id: inquiry.id,
              recipient_email: inquiry.email,
              recipient_name: inquiry.contact_name,
              subject: subject,
              status: "sent",
            });

            results.push({
              type: "offer_reminder",
              inquiryId: inquiry.id,
              email: inquiry.email,
              success: true,
            });
          } catch (error) {
            console.error(`Failed to send offer reminder to ${inquiry.email}:`, error);
            results.push({
              type: "offer_reminder",
              inquiryId: inquiry.id,
              email: inquiry.email,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
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

        try {
          await sendEmail([booking.customer_email], subject, html, "STORIA Events");

          await logEmailDelivery(supabase, {
            entity_type: "event_booking",
            entity_id: booking.id,
            recipient_email: booking.customer_email,
            recipient_name: booking.customer_name,
            subject: subject,
            status: "sent",
          });

          results.push({
            type: "menu_reminder",
            bookingId: booking.id,
            email: booking.customer_email,
            success: true,
          });
        } catch (error) {
          console.error(`Failed to send menu reminder to ${booking.customer_email}:`, error);
          results.push({
            type: "menu_reminder",
            bookingId: booking.id,
            email: booking.customer_email,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
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

        try {
          await sendEmail([booking.customer_email], subject, html, "STORIA Events");

          await logEmailDelivery(supabase, {
            entity_type: "event_booking",
            entity_id: booking.id,
            recipient_email: booking.customer_email,
            recipient_name: booking.customer_name,
            subject: subject,
            status: "sent",
          });

          results.push({
            type: "event_tomorrow",
            bookingId: booking.id,
            email: booking.customer_email,
            success: true,
          });
        } catch (error) {
          console.error(`Failed to send tomorrow reminder to ${booking.customer_email}:`, error);
          results.push({
            type: "event_tomorrow",
            bookingId: booking.id,
            email: booking.customer_email,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
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
