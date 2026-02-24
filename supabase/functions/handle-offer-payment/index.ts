// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';



const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[HANDLE-OFFER-PAYMENT] ${step}${detailsStr}`);
};

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
  id: string;
  inquiry_id: string;
  package_id: string;
  option_label: string;
  guest_count: number;
  menu_selection: unknown;
  total_amount: number;
  stripe_payment_link_id: string;
}

interface Inquiry {
  id: string;
  email: string;
  contact_name: string;
  company_name: string | null;
  phone: string | null;
  preferred_date: string | null;
  time_slot: string | null;
}

interface EventBooking {
  id: string;
  booking_number: string;
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

      logStep("Manual payment check", { optionId, inquiryId });

      // Get the option with its payment link
      const { data: option, error: optionError } = await supabaseAdmin
        .from("inquiry_offer_options")
        .select("*")
        .eq("id", optionId)
        .single();

      if (optionError || !option) {
        throw new Error("Option not found");
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

        if (optionId && inquiryId) {
          logStep("Processing offer payment", { optionId, inquiryId });

          // Get the option
          const { data: option, error: optionError } = await supabaseAdmin
            .from("inquiry_offer_options")
            .select("*")
            .eq("id", optionId)
            .single();

          if (optionError || !option) {
            throw new Error(`Option not found: ${optionId}`);
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

  // Check if booking already exists for this option
  const { data: existingBookingData } = await supabase
    .from("event_bookings")
    .select("id, booking_number")
    .eq("source_option_id", option.id)
    .single();

  if (existingBookingData) {
    const existingBooking = existingBookingData as EventBooking;
    logStep("Booking already exists", existingBooking);
    return {
      bookingId: existingBooking.id,
      bookingNumber: existingBooking.booking_number,
    };
  }

  // Get inquiry details
  const { data: inquiryData, error: inquiryError } = await supabase
    .from("event_inquiries")
    .select("*")
    .eq("id", option.inquiry_id)
    .single();

  if (inquiryError || !inquiryData) {
    throw new Error(`Inquiry not found: ${option.inquiry_id}`);
  }

  const inquiry = inquiryData as Inquiry;

  // Generate booking number
  const bookingNumber = await generateBookingNumber(supabase);
  logStep("Generated booking number", { bookingNumber });

  // Create the event booking
  const { data: bookingData, error: bookingError } = await supabase
    .from("event_bookings")
    .insert({
      booking_number: bookingNumber,
      customer_email: inquiry.email,
      customer_name: inquiry.contact_name,
      company_name: inquiry.company_name,
      phone: inquiry.phone,
      package_id: option.package_id,
      guest_count: option.guest_count,
      event_date: inquiry.preferred_date,
      event_time: inquiry.time_slot,
      menu_selection: option.menu_selection,
      menu_confirmed: false,
      total_amount: option.total_amount,
      payment_status: "paid",
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_payment_link_id: option.stripe_payment_link_id,
      status: "menu_pending",
      source_inquiry_id: option.inquiry_id,
      source_option_id: option.id,
    })
    .select()
    .single();

  if (bookingError) {
    throw new Error(`Failed to create booking: ${bookingError.message}`);
  }

  const booking = bookingData as EventBooking;
  logStep("Booking created", { bookingId: booking.id, bookingNumber });

  // Update the inquiry status, offer_phase, and link to booking
  await supabase
    .from("event_inquiries")
    .update({
      status: "confirmed",
      offer_phase: "confirmed",
      selected_option_id: option.id,
      converted_to_booking_id: booking.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", option.inquiry_id);

  logStep("Inquiry updated to confirmed");

  // Create LexOffice invoice for the paid booking
  try {
    logStep("Creating LexOffice invoice for event booking");
    
    const lexofficePayload = {
      orderId: booking.id,
      orderNumber: bookingNumber,
      customerName: inquiry.contact_name,
      customerEmail: inquiry.email,
      customerPhone: inquiry.phone || '',
      companyName: inquiry.company_name || undefined,
      billingAddress: {
        name: inquiry.company_name || inquiry.contact_name,
        street: '',
        zip: '',
        city: '',
        country: 'DE',
      },
      items: [{
        id: option.package_id || 'event-package',
        name: `Event-Paket: ${option.option_label}`,
        quantity: option.guest_count,
        price: option.total_amount / option.guest_count,
      }],
      subtotal: option.total_amount,
      deliveryCost: 0,
      minimumOrderSurcharge: 0,
      grandTotal: option.total_amount,
      isPickup: false,
      documentType: 'invoice' as const,
      isPaid: true,
      desiredDate: inquiry.preferred_date || undefined,
      desiredTime: inquiry.time_slot || undefined,
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
        
        // Update booking with LexOffice data
        await supabase
          .from("event_bookings")
          .update({
            lexoffice_invoice_id: invoiceId,
            lexoffice_document_type: documentType,
            lexoffice_contact_id: lexofficeResult.contactId || null,
          })
          .eq("id", booking.id);

        logStep("LexOffice invoice created and linked", { 
          invoiceId, 
          documentType,
          bookingId: booking.id 
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
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
  };
}
