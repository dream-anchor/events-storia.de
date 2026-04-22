// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';



const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[HANDLE-OFFER-PAYMENT] ${step}${detailsStr}`);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generate booking number
async function generateBookingNumber(supabase: any): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  const { data, error } = await supabase.rpc('get_next_order_number', {
    p_prefix: 'EVT',
    p_year: currentYear,
  });

  if (error) {
    logStep("Error generating booking number", error);
    // Fallback to timestamp-based number
    return `EVT-${currentYear}-${Date.now().toString().slice(-4)}`;
  }

  return `EVT-${currentYear}-${String(data).padStart(4, '0')}`;
}

interface OfferOption {
  id: string;                         // v2_offer_options.id
  event_id: string;
  package_id: string | null;
  label: string;
  guest_count: number;
  menu_selection: unknown;
  amount_total: number;
  stripe_payment_link_id: string | null;
  source_option_id: string | null;
}

interface V2Event {
  id: string;
  customer_id: string;
  status: string;
  date: string | null;
  time_from: string | null;
  event_time: string | null;
  booking_number: string | null;
}

interface V2Customer {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if this is a webhook or a manual check
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      // Manual check: verify payment status for specific option
      const body = await req.json();
      const { optionId, inquiryId } = body;

      if (!optionId) {
        throw new Error("optionId is required");
      }
      if (typeof optionId !== "string" || !UUID_RE.test(optionId)) {
        return new Response(
          JSON.stringify({ error: "optionId must be a valid UUID" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      logStep("Manual payment check", { optionId, inquiryId });

      // Lookup in v2_offer_options:
      // - new links carry v2-UUID  → matches `id`
      // - legacy links carry old UUID → matches `source_option_id`
      const { data: option, error: optionError } = await supabaseAdmin
        .from("v2_offer_options")
        .select("id, event_id, package_id, label, guest_count, menu_selection, amount_total, stripe_payment_link_id, source_option_id")
        .or(`id.eq.${optionId},source_option_id.eq.${optionId}`)
        .maybeSingle();

      if (optionError || !option) {
        throw new Error(`v2_offer_option not found for ${optionId}`);
      }

      const typedOption = option as OfferOption;

      if (!typedOption.stripe_payment_link_id) {
        return new Response(
          JSON.stringify({ paid: false, message: "No payment link created yet" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Check for completed checkout sessions using this payment link
      const sessions = await stripe.checkout.sessions.list({
        payment_link: typedOption.stripe_payment_link_id,
        limit: 10,
      });

      const completedSession = sessions.data.find(
        (s: any) => s.payment_status === "paid" && s.status === "complete"
      );

      if (completedSession) {
        logStep("Found completed payment session", { sessionId: completedSession.id });

        // Process the payment - create booking if not already created
        const result = await processSuccessfulPayment(
          supabaseAdmin,
          typedOption,
          completedSession
        );

        return new Response(
          JSON.stringify({
            paid: true,
            bookingId: result.bookingId,
            bookingNumber: result.bookingNumber,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({ paid: false, message: "Payment not completed yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      // Stripe Webhook handling
      const signature = req.headers.get("stripe-signature");
      const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

      if (!signature || !webhookSecret) {
        throw new Error("Missing webhook signature or secret");
      }

      const body = await req.text();
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      
      logStep("Webhook event received", { type: event.type });

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is from our offer payment links
        const metadata = session.metadata || {};
        const optionId = metadata.option_id;
        const inquiryId = metadata.inquiry_id;

        if (optionId && UUID_RE.test(optionId)) {
          logStep("Processing offer payment", { optionId, inquiryId });

          // optionId from Stripe metadata may be legacy UUID → look up via source_option_id OR id
          const { data: option, error: optionError } = await supabaseAdmin
            .from("v2_offer_options")
            .select("id, event_id, package_id, label, guest_count, menu_selection, amount_total, stripe_payment_link_id, source_option_id")
            .or(`id.eq.${optionId},source_option_id.eq.${optionId}`)
            .maybeSingle();

          if (optionError || !option) {
            throw new Error(`v2_offer_option not found: ${optionId}`);
          }

          const typedOption = option as OfferOption;
          await processSuccessfulPayment(supabaseAdmin, typedOption, session);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function processSuccessfulPayment(
  supabase: any,
  option: OfferOption,
  session: Stripe.Checkout.Session
): Promise<{ bookingId: string; bookingNumber: string }> {
  logStep("Processing successful payment", { optionId: option.id });

  // Idempotency: did we already create a v2_payment for this option?
  const { data: existingPayment } = await supabase
    .from("v2_payments")
    .select("id, event_id")
    .eq("source_offer_option_id", option.id)
    .maybeSingle();

  if (existingPayment) {
    logStep("v2_payment already exists for option", existingPayment);
    const { data: ev } = await supabase
      .from("v2_events")
      .select("id, booking_number")
      .eq("id", existingPayment.event_id)
      .single();
    return {
      bookingId: ev?.id ?? existingPayment.event_id,
      bookingNumber: ev?.booking_number ?? "pending",
    };
  }

  // Load v2_event
  const { data: eventData, error: eventError } = await supabase
    .from("v2_events")
    .select("id, customer_id, date, time_from, event_time, booking_number, status")
    .eq("id", option.event_id)
    .single();

  if (eventError || !eventData) {
    throw new Error(`v2_event not found: ${option.event_id}`);
  }
  const ev = eventData as V2Event;

  // Load customer
  const { data: customerData, error: customerError } = await supabase
    .from("v2_customers")
    .select("id, name, email, company, phone")
    .eq("id", ev.customer_id)
    .single();

  if (customerError || !customerData) {
    throw new Error(`v2_customer not found: ${ev.customer_id}`);
  }
  const customer = customerData as V2Customer;

  // Insert v2_payments row
  const amountCents = Math.round(option.amount_total * 100);
  const { data: paymentData, error: paymentError } = await supabase
    .from("v2_payments")
    .insert({
      event_id: ev.id,
      amount_cents: amountCents,
      payment_type: "full",
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString(),
      paid_via: "stripe_checkout",
      source_offer_option_id: option.id,
    })
    .select()
    .single();

  if (paymentError) {
    if (paymentError.code === "23505") {
      logStep("v2_payment unique violation (race), fetching existing");
      const { data: retry } = await supabase
        .from("v2_payments")
        .select("id, event_id")
        .eq("source_offer_option_id", option.id)
        .single();
      if (retry) {
        return { bookingId: retry.event_id, bookingNumber: ev.booking_number ?? "exists" };
      }
    }
    throw new Error(`Failed to create v2_payment: ${paymentError.message}`);
  }

  // Promote event + assign booking number if missing
  let bookingNumber = ev.booking_number;
  if (!bookingNumber) {
    bookingNumber = await generateBookingNumber(supabase);
  }

  await supabase
    .from("v2_events")
    .update({
      status: "paid",
      booking_number: bookingNumber,
      package_id: option.package_id,
      menu_selection: option.menu_selection,
      guest_count: option.guest_count,
      amount_total: option.amount_total,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", ev.id);

  logStep("v2_event promoted to paid", { eventId: ev.id, bookingNumber });

  // Mark chosen option + deactivate siblings
  await supabase
    .from("v2_offer_options")
    .update({ is_chosen: true, chosen_at: new Date().toISOString() })
    .eq("id", option.id);

  await supabase
    .from("v2_offer_options")
    .update({ is_active: false })
    .eq("event_id", ev.id)
    .neq("id", option.id);

  // Create LexOffice invoice for the paid booking
  try {
    logStep("Creating LexOffice invoice for event booking");
    
    const lexofficePayload = {
      orderId: ev.id,
      orderNumber: bookingNumber,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || '',
      companyName: customer.company || undefined,
      billingAddress: {
        name: customer.company || customer.name,
        street: '',
        zip: '',
        city: '',
        country: 'DE',
      },
      items: [{
        id: option.package_id || 'event-package',
        name: `Event-Paket: ${option.label}`,
        quantity: option.guest_count,
        price: option.amount_total / option.guest_count,
      }],
      subtotal: option.amount_total,
      deliveryCost: 0,
      minimumOrderSurcharge: 0,
      grandTotal: option.amount_total,
      isPickup: false,
      documentType: 'invoice' as const,
      isPaid: true,
      desiredDate: ev.date || undefined,
      desiredTime: ev.event_time || ev.time_from || undefined,
      paymentMethod: 'stripe' as const,
      isEventBooking: true,
    };

    const lexofficeResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lexoffice-invoice`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(lexofficePayload),
      }
    );

    if (lexofficeResponse.ok) {
      const lexofficeResult = await lexofficeResponse.json();
      
      if (lexofficeResult.invoiceId || lexofficeResult.quotationId) {
        const invoiceId = lexofficeResult.invoiceId || lexofficeResult.quotationId;
        const documentType = lexofficeResult.invoiceId ? 'invoice' : 'quotation';
        
        // Central reference on v2_events
        await supabase
          .from("v2_events")
          .update({
            invoice_lexoffice_id: invoiceId,
            invoice_lexoffice_number: lexofficeResult.invoiceNumber || null,
            lexoffice_document_type: documentType,
          })
          .eq("id", ev.id);

        // Mirror onto the v2_payments row for payment-centric queries
        await supabase
          .from("v2_payments")
          .update({
            lexoffice_invoice_id: invoiceId,
            lexoffice_invoice_number: lexofficeResult.invoiceNumber || null,
          })
          .eq("id", paymentData.id);

        logStep("LexOffice invoice created and linked", { 
          invoiceId, 
          documentType,
          eventId: ev.id 
        });
      } else if (lexofficeResult.skipped) {
        logStep("LexOffice skipped", { reason: lexofficeResult.reason });
      }
    } else {
      const errorText = await lexofficeResponse.text();
      logStep("LexOffice invoice creation failed", { 
        status: lexofficeResponse.status, 
        error: errorText 
      });
    }
  } catch (lexError) {
    // Don't fail the payment processing if LexOffice fails
    logStep("LexOffice invoice creation error (non-fatal)", { 
      error: lexError instanceof Error ? lexError.message : String(lexError) 
    });
  }

  return {
    bookingId: ev.id,
    bookingNumber: bookingNumber || "pending",
  };
}
