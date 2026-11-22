import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { reportEdgeError } from '../_shared/reportError.ts';
import { REJECT_MESSAGES_DE, verifyCateringOrder, type ClientLine } from '../_shared/cateringPricing.ts';
import { loadCatalog, oneWayDistanceKm } from '../_shared/cateringServer.ts';
import { MIXED_SESSION_MINUTES, giftLineName, mixedPaymentMethodTypes, validateGiftForCateringPayment } from '../_shared/giftMixed.ts';



const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CATERING-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { amount, customerEmail, customerName, orderNumber, items, paymentMethod, giftOrderNumber } = await req.json();
    
    // Determine base URL for Stripe redirect URLs
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");

    let baseUrl = origin;
    if (!baseUrl && referer) {
      try {
        const refererUrl = new URL(referer);
        baseUrl = refererUrl.origin;
      } catch {
        baseUrl = null;
      }
    }

    // Fallback to production domain if no origin detected
    if (!baseUrl) {
      baseUrl = "https://ristorantestoria.de";
    }

    logStep("Base URL determined", { origin, referer, baseUrl });
    
    // Validate input
    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }
    if (!customerEmail) {
      throw new Error("Email required");
    }
    if (!orderNumber) {
      throw new Error("Order number required");
    }
    
    logStep("Input validated", { amount, customerEmail, orderNumber, itemCount: items?.length, paymentMethod });

    // SECURITY: Verify order exists and amount matches database record
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Determine if this is an event booking or catering order based on order number prefix
    const isEventBooking = orderNumber.startsWith('EVT-BUCHUNG');
    let order: { id: string; total_amount: number; customer_email: string; payment_status: string | null } | null = null;
    let orderType = 'catering';
    // Catering: Zeile für die Preisprüfung (Positionen, Lieferung); bei Event-Buchungen null
    // deno-lint-ignore no-explicit-any
    let cateringRow: any = null;
    // Serverseitig verifizierter Betrag in Cent (nur Catering); Stripe berechnet NUR diesen Wert
    let verifiedCents: number | null = null;

    if (isEventBooking) {
      // Query event_bookings table
      const { data: eventOrder, error: eventError } = await supabase
        .from('event_bookings')
        .select('id, booking_number, total_amount, customer_email, payment_status')
        .eq('booking_number', orderNumber)
        .single();

      if (eventError || !eventOrder) {
        logStep("ERROR: Event booking not found", { orderNumber, error: eventError?.message });
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      order = {
        id: eventOrder.id,
        total_amount: eventOrder.total_amount || 0,
        customer_email: eventOrder.customer_email,
        payment_status: eventOrder.payment_status,
      };
      orderType = 'event';
      logStep("Found event booking", { bookingId: order.id });
    } else {
      // Query catering_orders table
      const { data: cateringOrder, error: orderError } = await supabase
        .from('catering_orders')
        .select('id, order_number, total_amount, customer_email, payment_status, items, is_pickup, delivery_street, delivery_zip, delivery_city, delivery_cost, minimum_order_surcharge')
        .eq('order_number', orderNumber)
        .single();

      if (orderError || !cateringOrder) {
        logStep("ERROR: Catering order not found", { orderNumber, error: orderError?.message });
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      order = {
        id: cateringOrder.id,
        total_amount: cateringOrder.total_amount || 0,
        customer_email: cateringOrder.customer_email,
        payment_status: cateringOrder.payment_status,
      };
      cateringRow = cateringOrder;
      logStep("Found catering order", { orderId: order.id });
    }

    // Verify email matches order
    if (order.customer_email !== customerEmail) {
      logStep("ERROR: Email mismatch", { 
        orderEmail: order.customer_email, 
        requestEmail: customerEmail 
      });
      return new Response(
        JSON.stringify({ error: "Email mismatch" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify amount matches (allow small rounding differences)
    const amountDifference = Math.abs(order.total_amount - amount);
    if (amountDifference > 0.02) {
      logStep("ERROR: Amount mismatch", { 
        orderAmount: order.total_amount, 
        requestAmount: amount,
        difference: amountDifference
      });
      return new Response(
        JSON.stringify({ error: "Amount mismatch - order may have been modified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if already paid
    if (order.payment_status === 'paid') {
      logStep("ERROR: Order already paid", { orderNumber });
      return new Response(
        JSON.stringify({ error: "Order already paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // SECURITY (I3): Preise NICHT dem Client glauben. Positionen aus menu_items, Liefergebühr aus Server-Entfernung,
    // Mindestbestellwert und Summe werden nachgerechnet; Abweichung > 1 Cent => Ablehnung, Stripe wird nie erreicht.
    if (cateringRow) {
      const rawItems = Array.isArray(cateringRow.items) ? cateringRow.items : [];
      const lines: ClientLine[] = rawItems.map((i: { id?: unknown; quantity?: unknown; price?: unknown; name?: unknown; name_en?: unknown }) => ({
        name: typeof i?.name === 'string' ? i.name : null,
        name_en: typeof i?.name_en === 'string' ? i.name_en : null,
        id: String(i?.id ?? ''),
        quantity: Number(i?.quantity),
        price: Number(i?.price),
      }));
      const catalog = await loadCatalog(supabase, lines.map((l) => l.id));
      const isPickup = cateringRow.is_pickup === true;
      const oneWayKm = isPickup
        ? null
        : await oneWayDistanceKm(
            `${cateringRow.delivery_street ?? ''}, ${cateringRow.delivery_zip ?? ''} ${cateringRow.delivery_city ?? ''}`,
            Deno.env.get("OPENROUTE_API_KEY"),
          );
      const verdict = verifyCateringOrder({
        lines,
        catalog,
        isPickup,
        oneWayKm,
        clientDeliveryEuro: Number(cateringRow.delivery_cost ?? 0),
        clientSurchargeEuro: Number(cateringRow.minimum_order_surcharge ?? 0),
        clientTotalEuro: Number(order.total_amount),
      });
      if (!verdict.ok) {
        logStep("ERROR: Catering price verification failed", { orderNumber, code: verdict.code, detail: verdict.detail });
        reportEdgeError({
          source: 'edge:create-catering-payment',
          severity: verdict.code === 'delivery_unverifiable' ? 'critical' : 'warning',
          message: `price_verification_failed:${verdict.code} order=${orderNumber} ${JSON.stringify(verdict.detail)}`,
        });
        return new Response(
          JSON.stringify({ error: verdict.code, message: REJECT_MESSAGES_DE[verdict.code] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: verdict.code === 'delivery_unverifiable' ? 503 : 409 }
        );
      }
      // auch der angefragte Betrag muss zum Serverwert passen
      if (Math.abs(Math.round(Number(amount) * 100) - verdict.expectedTotalCents) > 1) {
        logStep("ERROR: Request amount differs from server price", { amount, expectedCents: verdict.expectedTotalCents });
        return new Response(
          JSON.stringify({ error: 'total_mismatch', message: REJECT_MESSAGES_DE.total_mismatch }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      verifiedCents = verdict.expectedTotalCents;
      logStep("Catering prices verified", { orderNumber, expectedCents: verdict.expectedTotalCents });
    }

    logStep("Order validated successfully", { 
      orderId: order.id, 
      orderType,
      dbAmount: order.total_amount, 
      requestAmount: amount 
    });

    // Mischbestellung (optional, rückwärtskompatibel): Geschenkkorb-Bestellung "mit Catering" an diese Zahlung hängen.
    // Beträge kommen ausschließlich aus gift_order_items (Serverpreise), nie vom Client.
    let giftOrder: { id: string; order_number: string } | null = null;
    let giftItems: { basket_name: string; variant_label: string; qty: number; unit_price_cents: number }[] = [];
    if (giftOrderNumber !== undefined && giftOrderNumber !== null && giftOrderNumber !== '') {
      if (isEventBooking || typeof giftOrderNumber !== 'string') {
        return new Response(
          JSON.stringify({ error: "Invalid gift order" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      const { data: g, error: gErr } = await supabase
        .from('gift_orders')
        .select('id, order_number, status, customer_email, handover, payment_method, catering_order_number, is_test')
        .eq('order_number', giftOrderNumber)
        .maybeSingle();
      if (gErr || !g) {
        logStep("ERROR: Gift order not found", { giftOrderNumber, error: gErr?.message });
        return new Response(
          JSON.stringify({ error: "Gift order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      const { data: holds } = await supabase
        .from('gift_stock_holds')
        .select('expires_at')
        .eq('order_id', g.id)
        .eq('status', 'held');
      // Frühester Ablauf aller Holds der Bestellung zählt (ein abgelaufener Hold = Bestand nicht mehr gesichert)
      const holdExpiresAt = (holds ?? []).length > 0
        ? (holds ?? []).map((h: { expires_at: string }) => h.expires_at).sort()[0]
        : null;
      const check = validateGiftForCateringPayment(g, { orderNumber, customerEmail, holdExpiresAt, now: new Date() });
      if (!check.ok) {
        logStep("ERROR: Gift order rejected", { giftOrderNumber, reason: check.error });
        return new Response(
          JSON.stringify({ error: check.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      const { data: gi, error: giErr } = await supabase
        .from('gift_order_items')
        .select('basket_name, variant_label, qty, unit_price_cents')
        .eq('order_id', g.id);
      if (giErr || !gi || gi.length === 0) {
        throw new Error(`gift_items_load_failed: ${giErr?.message ?? 'empty'}`);
      }
      giftOrder = { id: g.id, order_number: g.order_number };
      giftItems = gi;
      logStep("Gift order attached", { giftOrderNumber, lines: gi.length });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      logStep("No existing customer found, will create new");
    }

    // Build item description (truncated to 500 chars for Stripe limit)
    const itemDescription = items
      ?.map((i: { quantity: number; name: string }) => `${i.quantity}× ${i.name}`)
      .join(", ")
      .slice(0, 500) || (isEventBooking ? "Event Buchung" : "Catering Order");

    // Determine product name based on order type
    const productName = isEventBooking 
      ? `STORIA Event Buchung #${orderNumber}`
      : `STORIA Catering #${orderNumber}`;

    // Create checkout session with dynamic price
    // If paymentMethod is 'billie', restrict to Billie only
    // Otherwise, let Stripe show all enabled payment methods
    const sessionConfig: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: itemDescription,
            },
            unit_amount: verifiedCents ?? Math.round(amount * 100), // Stripe expects cents; Catering: Serverwert (I3)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/checkout?payment=success&order=${orderNumber}`,
      cancel_url: `${baseUrl}/checkout?payment=cancelled`,
      metadata: {
        order_number: orderNumber,
        customer_name: customerName,
        order_type: orderType,
        payment_method_selected: paymentMethod || 'stripe',
      },
    };

    // Mischbestellung: Körbe als eigene Positionen (Serverbetrag), Session endet nach 31 Min (Hold >= 36 Min), Verknüpfung in den Metadaten
    if (giftOrder) {
      for (const gi of giftItems) {
        sessionConfig.line_items!.push({
          price_data: {
            currency: "eur",
            product_data: { name: giftLineName(gi.basket_name, gi.variant_label) },
            unit_amount: gi.unit_price_cents,
          },
          quantity: gi.qty,
        });
      }
      // nur Karte (sofort), außer Billie: asynchrone Methoden würden den Hold überdauern
      const mixedTypes = mixedPaymentMethodTypes(paymentMethod);
      if (mixedTypes) sessionConfig.payment_method_types = mixedTypes as Parameters<typeof stripe.checkout.sessions.create>[0]['payment_method_types'];
      sessionConfig.expires_at = Math.floor(Date.now() / 1000) + MIXED_SESSION_MINUTES * 60;
      sessionConfig.metadata = { ...sessionConfig.metadata, gift_order_id: giftOrder.id, gift_order_number: giftOrder.order_number };
    }

    // For Billie B2B invoice, restrict payment methods to Billie only
    if (paymentMethod === 'billie') {
      sessionConfig.payment_method_types = ['billie'];
      logStep("Billie payment method selected - restricting to Billie only");
    }
    // For regular stripe, don't set payment_method_types to allow all dashboard-enabled methods

    const session = await stripe.checkout.sessions.create(sessionConfig);

    logStep("Checkout session created", { sessionId: session.id, orderNumber, orderType });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    reportEdgeError({ source: 'edge:create-catering-payment', severity: 'critical', message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
