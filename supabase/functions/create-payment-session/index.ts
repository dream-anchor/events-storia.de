import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';

interface CreatePaymentSessionRequest {
  inquiryId: string;
  optionId: string;
  paymentType: 'full' | 'deposit';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as CreatePaymentSessionRequest;
    const { inquiryId, optionId, paymentType } = body;

    if (!inquiryId || !optionId || !paymentType) {
      throw new Error('inquiryId, optionId und paymentType sind erforderlich');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Anfrage + Option laden
    const { data: inquiry, error: inqError } = await supabase
      .from('event_inquiries')
      .select('id, contact_name, email, preferred_date, guest_count, deposit_percent')
      .eq('id', inquiryId)
      .single();

    if (inqError || !inquiry) throw new Error('Anfrage nicht gefunden');

    // Sicherheitsnetz: deposit_percent === 0 darf nicht zu Anzahlung führen
    const inquiryDeposit = (inquiry as { deposit_percent: number | null }).deposit_percent;
    if (paymentType === 'deposit' && inquiryDeposit === 0) {
      throw new Error('Anzahlung ist für dieses Angebot nicht vorgesehen');
    }

    const { data: option, error: optError } = await supabase
      .from('inquiry_offer_options')
      .select('id, option_label, total_amount, guest_count, offer_mode, menu_selection, package_id')
      .eq('id', optionId)
      .single();

    if (optError || !option) throw new Error('Angebotsoption nicht gefunden');

    const inq = inquiry as {
      id: string; contact_name: string; email: string;
      preferred_date: string | null; guest_count: string | null; deposit_percent: number | null;
    };
    const opt = option as {
      id: string; option_label: string;
      total_amount: number; guest_count: number; offer_mode: string;
      menu_selection: Record<string, unknown> | null;
      package_id: string | null;
    };

    // Paketnamen auflösen: Override aus menu_selection > packages-Tabelle > Default
    let packageName = 'Individuelles Angebot';
    const nameOverride = opt.menu_selection?.packageNameOverride as string | undefined;
    if (nameOverride) {
      packageName = nameOverride;
    } else if (opt.package_id) {
      const { data: pkg } = await supabase
        .from('packages')
        .select('name')
        .eq('id', opt.package_id)
        .single();
      if (pkg?.name) packageName = pkg.name;
    } else if (opt.offer_mode === 'menu') {
      packageName = 'Individuelles Menü';
    }

    const totalAmount = opt.total_amount; // already total (not per person)
    const depositPercent = inq.deposit_percent ?? 20;

    const amountEur = paymentType === 'deposit'
      ? Math.round(totalAmount * depositPercent) / 100
      : totalAmount;

    const amountCents = Math.round(amountEur * 100);

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Stripe nicht konfiguriert');

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    const productName = paymentType === 'deposit'
      ? `Anzahlung (${depositPercent}%) — Event ${inq.preferred_date || ''}`
      : `Event-Buchung — ${inq.preferred_date || ''}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: inq.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: productName,
            description: `Option ${opt.option_label} · ${opt.guest_count} Gäste · ${packageName}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: `https://events-storia.de/offer/${inquiryId}?payment=success`,
      cancel_url: `https://events-storia.de/offer/${inquiryId}?payment=cancelled`,
      metadata: {
        inquiry_id: inquiryId,
        option_id: optionId,
        payment_type: paymentType,
        total_amount: String(totalAmount),
        deposit_percent: String(depositPercent),
      },
    });

    // payment_type + Betrag in event_inquiries speichern
    await supabase
      .from('event_inquiries')
      .update({
        payment_type: paymentType,
        remaining_amount: paymentType === 'deposit' ? totalAmount - amountEur : 0,
      } as Record<string, unknown>)
      .eq('id', inquiryId);

    return new Response(
      JSON.stringify({ success: true, checkoutUrl: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('create-payment-session error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
