import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { reportEdgeError } from '../_shared/reportError.ts';

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EVENT-PAYMENT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id } = await req.json();
    if (!payment_id) throw new Error('payment_id ist erforderlich');

    logStep("Creating payment session", { payment_id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Zahlung + Anfragedaten aus der View laden
    const { data: payment, error: payError } = await supabase
      .from('event_payments_enriched')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (payError || !payment) {
      logStep("Payment not found", { payment_id, error: payError?.message });
      throw new Error('Zahlung nicht gefunden');
    }

    logStep("Payment loaded", {
      type: payment.payment_type,
      amount_cents: payment.amount_cents,
      status: payment.status,
    });

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Stripe nicht konfiguriert');

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    const typeLabels: Record<string, string> = {
      deposit: 'Anzahlung',
      prepayment: 'Vorauszahlung',
      final: 'Endabrechnung',
    };

    const eventDateStr = payment.preferred_date
      ? new Date(payment.preferred_date).toLocaleDateString('de-DE')
      : 'Termin offen';

    const guestCount = payment.guest_count || '–';
    const eventType = payment.event_type || 'Event';
    const typeLabel = typeLabels[payment.payment_type] || payment.payment_type;

    const productName = `${typeLabel} — ${eventType} am ${eventDateStr} (${guestCount} Gäste)`;

    // Stripe Checkout Session erstellen
    // KEIN payment_method_types → Stripe zeigt automatisch alle aktivierten Methoden
    // inkl. Billie (B2B BNPL), Karte, SEPA-Lastschrift
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: payment.customer_email || undefined,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: productName,
          },
          unit_amount: payment.amount_cents,
        },
        quantity: 1,
      }],
      // Billie braucht Firmenname + Adresse für B2B-Bonitätsprüfung
      billing_address_collection: 'required',
      success_url: `https://events-storia.de/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://events-storia.de/payment/cancelled?payment_id=${payment_id}`,
      expires_at: Math.floor(Date.now() / 1000) + 23 * 60 * 60, // 23 Stunden gültig (Stripe max 24h)
      metadata: {
        payment_id,
        inquiry_id: payment.inquiry_id,
        payment_type: payment.payment_type,
        source: 'maestro',
      },
    });

    logStep("Stripe session created", { session_id: session.id });

    // Payment-Record aktualisieren
    const { error: updateError } = await supabase
      .from('event_payments')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_link_url: session.url,
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    if (updateError) {
      logStep("Failed to update payment record (non-fatal)", { error: updateError.message });
    }

    logStep("Done", { payment_id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    logStep("ERROR", { error: msg });
    reportEdgeError({ source: 'edge:create-event-payment-session', severity: 'critical', message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
