import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuConfirmationRequest {
  bookingId: string;
  sendEmail: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId, sendEmail } = await req.json() as MenuConfirmationRequest;

    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch booking with package details
    const { data: booking, error: bookingError } = await supabase
      .from('event_bookings')
      .select('*, packages(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    console.log('Booking found:', booking.booking_number);

    // Generate email content from menu selection
    const menuSelection = booking.menu_selection as {
      courses: Array<{ courseLabel: string; itemName: string; itemDescription?: string }>;
      drinks: Array<{ drinkLabel: string; selectedChoice?: string; customDrink?: string }>;
    } | null;

    let menuText = '';
    
    if (menuSelection?.courses?.length) {
      menuText += '🍽️ MENÜ\n\n';
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
      menuText += '🍷 GETRÄNKE\n\n';
      for (const drink of menuSelection.drinks) {
        const selection = drink.selectedChoice || drink.customDrink;
        if (selection) {
          menuText += `${drink.drinkLabel}: ${selection}\n`;
        }
      }
    }

    // Format event date
    const eventDate = new Date(booking.event_date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const packageName = booking.packages?.name || 'Event-Paket';

    // Compose email
    const emailSubject = `Ihr Menü für ${eventDate} steht fest`;
    const emailBody = `Sehr geehrte/r ${booking.customer_name},

vielen Dank für Ihre Buchung des ${packageName} am ${eventDate}.

Wir haben folgendes Menü für Ihre Veranstaltung mit ${booking.guest_count} Gästen zusammengestellt:

${menuText}

Sollten Ihre Gäste besondere Ernährungsbedürfnisse haben (Allergien, vegetarisch, vegan), teilen Sie uns dies bitte rechtzeitig mit. Wir passen das Menü entsprechend an.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
Ihr STORIA Team

---
STORIA · Ristorante
Karlstraße 47a
80333 München
Tel: +49 89 51519696
info@events-storia.de`;

    console.log('Email content generated');

    // Send email if requested
    if (sendEmail) {
      const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.ionos.de';
      const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
      const smtpUser = Deno.env.get('SMTP_USER')?.trim();
      const smtpPassword = Deno.env.get('SMTP_PASSWORD');
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      // Primary: Try IONOS SMTP
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
            html: `<html><body><pre style="font-family: monospace; white-space: pre-wrap;">${emailBody}</pre></body></html>`,
          });

          await client.close();
          console.log('Email sent successfully via IONOS SMTP');
        } catch (smtpError) {
          console.error('SMTP error, trying Resend fallback:', smtpError);
          
          // Fallback: Try Resend if SMTP fails
          if (resendApiKey) {
            const resendResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
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
              throw new Error('Failed to send email via both SMTP and Resend');
            }

            console.log('Email sent successfully via Resend (fallback)');
          } else {
            throw smtpError;
          }
        }
      } else if (resendApiKey) {
        // No SMTP configured, use Resend directly
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
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
          throw new Error('Failed to send email via Resend');
        }

        console.log('Email sent successfully via Resend');
      } else {
        console.warn('No email provider configured (SMTP or Resend)');
      }
    }

    // Update booking to mark menu as confirmed
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
        emailSent: sendEmail,
        bookingNumber: booking.booking_number,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
