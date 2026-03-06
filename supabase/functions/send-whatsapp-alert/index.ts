import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

interface WhatsAppAlertRequest {
  type: 'new_order' | 'new_inquiry' | 'email_failed';
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  desiredDate?: string;
  totalAmount?: number;
  guestCount?: string;
  eventType?: string;
  errorDetails?: string;
  entityType?: string;
  entityId?: string;
}

const formatPrice = (price: number) => price.toFixed(2).replace('.', ',') + ' €';

function buildMessage(data: WhatsAppAlertRequest): string {
  if (data.type === 'email_failed') {
    return [
      '⚠️ EMAIL-VERSAND FEHLGESCHLAGEN',
      '',
      data.orderNumber ? `Bestellung/Anfrage: ${data.orderNumber}` : '',
      data.customerName ? `Kunde: ${data.customerName}` : '',
      data.customerEmail ? `E-Mail: ${data.customerEmail}` : '',
      '',
      data.errorDetails ? `Fehler: ${data.errorDetails}` : 'Fehler: Resend + SMTP beide fehlgeschlagen',
      '',
      '→ Bitte sofort prüfen!',
      'https://events-storia.de/admin',
    ].filter(Boolean).join('\n');
  }

  if (data.type === 'new_order') {
    return [
      `📦 Neue Catering-Bestellung ${data.orderNumber || ''}`,
      '',
      data.customerName ? `Kunde: ${data.customerName}` : '',
      data.desiredDate ? `Datum: ${data.desiredDate}` : '',
      data.totalAmount ? `Summe: ${formatPrice(data.totalAmount)}` : '',
      '',
      '→ https://events-storia.de/admin',
    ].filter(Boolean).join('\n');
  }

  // new_inquiry
  return [
    `📋 Neue Event-Anfrage`,
    '',
    data.customerName ? `Kunde: ${data.customerName}` : '',
    data.eventType ? `Eventart: ${data.eventType}` : '',
    data.guestCount ? `Gäste: ${data.guestCount}` : '',
    data.desiredDate ? `Datum: ${data.desiredDate}` : '',
    '',
    '→ https://events-storia.de/admin',
  ].filter(Boolean).join('\n');
}

async function sendWhatsApp(message: string): Promise<{ sent: boolean; error?: string }> {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const recipient = Deno.env.get("WHATSAPP_RECIPIENT") || "491636033912";

  if (!accessToken || !phoneNumberId) {
    console.warn("WhatsApp not configured — WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing");
    return { sent: false, error: "WhatsApp not configured" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (res.ok) {
      const result = await res.json();
      console.log("WhatsApp sent successfully:", result.messages?.[0]?.id);
      return { sent: true };
    } else {
      const errorText = await res.text();
      console.error("WhatsApp API error:", res.status, errorText);
      return { sent: false, error: `WhatsApp API ${res.status}: ${errorText}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown WhatsApp error";
    console.error("WhatsApp exception:", errorMsg);
    return { sent: false, error: errorMsg };
  }
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: WhatsAppAlertRequest = await req.json();
    console.log("WhatsApp alert request:", JSON.stringify(data));

    const message = buildMessage(data);
    const result = await sendWhatsApp(message);

    // Log WhatsApp delivery attempt if we have entity info
    if (data.entityType && data.entityId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from('email_delivery_logs').insert({
          entity_type: data.entityType,
          entity_id: data.entityId,
          recipient_email: `whatsapp:${Deno.env.get("WHATSAPP_RECIPIENT") || "491636033912"}`,
          recipient_name: 'STORIA Team (WhatsApp)',
          subject: data.type === 'email_failed' ? '⚠️ Email-Fehler Alert' : `WhatsApp: ${data.type}`,
          provider: 'whatsapp_meta',
          provider_message_id: null,
          status: result.sent ? 'sent' : 'failed',
          error_message: result.error || null,
          sent_by: 'system',
          metadata: {
            channel: 'whatsapp',
            alert_type: data.type,
            order_number: data.orderNumber,
          },
        });
      } catch (logErr) {
        console.error("Failed to log WhatsApp delivery:", logErr);
      }
    }

    return new Response(
      JSON.stringify({ success: result.sent, error: result.error }),
      {
        status: result.sent ? 200 : 502,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-whatsapp-alert:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  }
};

serve(handler);
