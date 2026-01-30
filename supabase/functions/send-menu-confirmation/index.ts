import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuConfirmationRequest {
  bookingId: string;
  sendEmail: boolean;
  sentBy?: string; // Admin email who triggered the send
}

interface EmailLogEntry {
  entity_type: string;
  entity_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  provider: string;
  provider_message_id: string | null;
  status: string;
  error_message: string | null;
  sent_by: string | null;
  metadata: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function logEmailDelivery(supabase: any, entry: EmailLogEntry) {
  try {
    const { error } = await supabase
      .from('email_delivery_logs')
      .insert(entry);
    
    if (error) {
      console.error('Failed to log email delivery:', error);
    } else {
      console.log('Email delivery logged:', entry.status, entry.recipient_email);
    }
  } catch (err) {
    console.error('Error logging email delivery:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId, sendEmail, sentBy } = await req.json() as MenuConfirmationRequest;

    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: booking, error: bookingError } = await supabase
      .from('event_bookings')
      .select('*, packages(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    console.log('Booking found:', booking.booking_number);

    const menuSelection = booking.menu_selection as {
      courses: Array<{ courseLabel: string; itemName: string; itemDescription?: string }>;
      drinks: Array<{ drinkLabel: string; selectedChoice?: string; customDrink?: string }>;
    } | null;

    let menuText = '';
    
    if (menuSelection?.courses?.length) {
      menuText += 'MENÜ\n\n';
      for (const course of menuSelection.courses) {
        if (course.itemName) {
          menuText += `${course.courseLabel}\n`;
          menuText += `${course.itemName}\n`;
          if (course.itemDescription) {
            menuText += `${course.itemDescription}\n`;
          }
          menuText += '\n';
        }
      }
    }

    if (menuSelection?.drinks?.length) {
      menuText += '\nGETRÄNKE\n\n';
      for (const drink of menuSelection.drinks) {
        const selection = drink.selectedChoice || drink.customDrink;
        if (selection) {
          menuText += `${drink.drinkLabel}: ${selection}\n`;
        }
      }
    }

    const eventDate = new Date(booking.event_date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const packageName = booking.packages?.name || 'Event-Paket';

    const emailSubject = `Ihr Menü für ${eventDate} steht fest`;
    const emailBody = `Sehr geehrte/r ${booking.customer_name},

vielen Dank für Ihre Buchung des ${packageName} am ${eventDate}.

Wir haben folgendes Menü für Ihre Veranstaltung mit ${booking.guest_count} Gästen zusammengestellt:

${menuText}

Sollten Ihre Gäste besondere Ernährungsbedürfnisse haben (Allergien, vegetarisch, vegan), teilen Sie uns dies bitte rechtzeitig mit. Wir passen das Menü entsprechend an.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
Ihr STORIA Team

STORIA · Ristorante
Karlstraße 47a
80333 München
Tel: +49 89 51519696
info@events-storia.de`;

    console.log('Email content generated');

    let emailSent = false;
    let emailProvider = '';
    let emailMessageId: string | null = null;
    let emailError: string | null = null;

    if (sendEmail) {
      const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.ionos.de';
      const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
      const smtpUser = Deno.env.get('SMTP_USER')?.trim();
      const smtpPassword = Deno.env.get('SMTP_PASSWORD');
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (smtpUser && smtpPassword) {
        try {
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          
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

          await client.send({
            from: `STORIA Events <${smtpUser}>`,
            to: [booking.customer_email],
            subject: emailSubject,
            html: `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailBody}</div>
</body>
</html>`,
          });

          await client.close();
          console.log('Email sent successfully via IONOS SMTP');
          emailSent = true;
          emailProvider = 'ionos_smtp';
        } catch (smtpError) {
          console.error('SMTP error, trying Resend fallback:', smtpError);
          emailError = smtpError instanceof Error ? smtpError.message : 'SMTP error';
          
          if (resendApiKey) {
            try {
              const resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  from: 'STORIA Events <info@events-storia.de>',
                  to: booking.customer_email,
                  subject: emailSubject,
                  text: emailBody,
                }),
              });

              if (!resendResponse.ok) {
                const error = await resendResponse.text();
                console.error('Resend error:', error);
                emailError = `Resend error: ${error}`;
              } else {
                const resendData = await resendResponse.json();
                console.log('Email sent successfully via Resend (fallback)');
                emailSent = true;
                emailProvider = 'resend';
                emailMessageId = resendData.id || null;
                emailError = null;
              }
            } catch (resendErr) {
              emailError = resendErr instanceof Error ? resendErr.message : 'Resend error';
            }
          }
        }
      } else if (resendApiKey) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              from: 'STORIA Events <info@events-storia.de>',
              to: booking.customer_email,
              subject: emailSubject,
              text: emailBody,
            }),
          });

          if (!resendResponse.ok) {
            const error = await resendResponse.text();
            console.error('Resend error:', error);
            emailError = `Resend error: ${error}`;
          } else {
            const resendData = await resendResponse.json();
            console.log('Email sent successfully via Resend');
            emailSent = true;
            emailProvider = 'resend';
            emailMessageId = resendData.id || null;
          }
        } catch (resendErr) {
          emailError = resendErr instanceof Error ? resendErr.message : 'Resend error';
        }
      } else {
        console.warn('No email provider configured (SMTP or Resend)');
        emailError = 'No email provider configured';
      }

      // Log email delivery to database
      await logEmailDelivery(supabase, {
        entity_type: 'event_booking',
        entity_id: bookingId,
        recipient_email: booking.customer_email,
        recipient_name: booking.customer_name,
        subject: emailSubject,
        provider: emailProvider || 'none',
        provider_message_id: emailMessageId,
        status: emailSent ? 'sent' : 'failed',
        error_message: emailError,
        sent_by: sentBy || null,
        metadata: {
          booking_number: booking.booking_number,
          email_type: 'menu_confirmation',
          package_name: packageName,
          event_date: booking.event_date,
        },
      });
    }

    const { error: updateError } = await supabase
      .from('event_bookings')
      .update({ 
        menu_confirmed: true,
        status: 'ready',
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailSent: emailSent,
        bookingNumber: booking.booking_number,
        provider: emailProvider || undefined,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: 400,
      }
    );
  }
});
