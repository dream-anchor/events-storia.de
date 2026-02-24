import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface CreatePaymentLinkRequest {
  inquiryId: string;
  optionId: string;
  packageName: string;
  amount: number; // in EUR (e.g., 2415.00)
  customerEmail: string;
  customerName: string;
  eventDate: string;
  guestCount: number;
  companyName?: string;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-OFFER-PAYMENT-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Admin role required");
    }
    logStep("Admin role verified");

    // Parse request body
    const body: CreatePaymentLinkRequest = await req.json();
    logStep("Request body parsed", body);

    const {
      inquiryId,
      optionId,
      packageName,
      amount,
      customerEmail,
      customerName,
      eventDate,
      guestCount,
      companyName
    } = body;

    // Validate required fields
    if (!inquiryId || !optionId || !packageName || !amount) {
      throw new Error("Missing required fields: inquiryId, optionId, packageName, amount");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Stripe initialized");

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://events.storia.de";

    // Create a Stripe Product for this offer option
    const product = await stripe.products.create({
      name: `STORIA Event: ${packageName}`,
      description: `${guestCount} Gäste, ${eventDate}${companyName ? ` - ${companyName}` : ''}`,
      metadata: {
        inquiry_id: inquiryId,
        option_id: optionId,
        package_name: packageName,
        guest_count: guestCount.toString(),
        event_date: eventDate,
      },
    });
    logStep("Stripe product created", { productId: product.id });

    // Create a Price for this product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: "eur",
    });
    logStep("Stripe price created", { priceId: price.id });

    // Create the Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${origin}/booking-success?inquiry=${inquiryId}&option=${optionId}`,
        },
      },
      metadata: {
        inquiry_id: inquiryId,
        option_id: optionId,
        package_name: packageName,
        customer_email: customerEmail,
        customer_name: customerName,
        company_name: companyName || '',
        guest_count: guestCount.toString(),
        event_date: eventDate,
      },
      // Pre-fill customer email if available
      ...(customerEmail && {
        custom_fields: [],
        customer_creation: "always",
      }),
    });
    logStep("Payment link created", { paymentLinkId: paymentLink.id, url: paymentLink.url });

    // Update the inquiry_offer_options table with the payment link
    const { error: updateError } = await supabaseAdmin
      .from("inquiry_offer_options")
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", optionId);

    if (updateError) {
      logStep("Warning: Failed to update option with payment link", updateError);
      // Don't throw - the payment link was created successfully
    } else {
      logStep("Option updated with payment link");
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
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
