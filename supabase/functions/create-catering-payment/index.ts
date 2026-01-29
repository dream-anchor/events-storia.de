import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CATERING-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { amount, customerEmail, customerName, orderNumber, items, paymentMethod } = await req.json();
    
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
        .select('id, order_number, total_amount, customer_email, payment_status')
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

    logStep("Order validated successfully", { 
      orderId: order.id, 
      orderType,
      dbAmount: order.total_amount, 
      requestAmount: amount 
    });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
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
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/checkout?payment=success&order=${orderNumber}`,
      cancel_url: `${req.headers.get("origin")}/checkout?payment=cancelled`,
      metadata: {
        order_number: orderNumber,
        customer_name: customerName,
        order_type: orderType,
        payment_method_selected: paymentMethod || 'stripe',
      },
    };

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
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
