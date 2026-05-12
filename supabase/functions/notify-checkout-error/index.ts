import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { errorMessage, items, paymentMethod, deliveryType, timestamp } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500, headers: corsHeaders });
    }

    const itemsList = Array.isArray(items)
      ? items.map((i: { name: string; quantity: number }) => `• ${i.quantity}x ${i.name}`).join('\n')
      : 'Unbekannt';

    const subject = `🚨 Checkout-Fehler auf events-storia.de`;
    const body = `Ein Kunde konnte seine Bestellung nicht abschicken.

FEHLER: ${errorMessage}

WARENKORB:
${itemsList}

Zahlungsart: ${paymentMethod || 'Unbekannt'}
Lieferart: ${deliveryType || 'Unbekannt'}
Zeitpunkt: ${timestamp || new Date().toISOString()}

→ Bitte prüfe die Supabase Logs und kontaktiere ggf. den Kunden.`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "STORIA Alert <info@events-storia.de>",
        to: ["info@events-storia.de"],
        subject,
        text: body,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('notify-checkout-error failed:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
