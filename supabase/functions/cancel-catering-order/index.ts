import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-ORDER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get request body
    const { orderId, reason } = await req.json();
    if (!orderId) {
      throw new Error("Order ID is required");
    }
    logStep("Request parsed", { orderId, reason });

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Authentication failed");
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Admin access required");
    }
    logStep("Admin verified", { userId: userData.user.id });

    // Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from("catering_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }
    logStep("Order fetched", { 
      orderNumber: order.order_number, 
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      lexofficeDocType: order.lexoffice_document_type,
      lexofficeInvoiceId: order.lexoffice_invoice_id
    });

    // Check if already cancelled
    if (order.status === "cancelled") {
      throw new Error("Order is already cancelled");
    }

    let stripeRefundId: string | null = null;
    let lexofficeCreditNoteId: string | null = null;

    // Step 1: Stripe Refund (if paid via Stripe)
    if (order.payment_method === "stripe" && order.payment_status === "paid") {
      logStep("Processing Stripe refund");
      
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        throw new Error("Stripe not configured");
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      // Find payment intent by searching for customer email
      const paymentIntents = await stripe.paymentIntents.search({
        query: `metadata['order_id']:'${orderId}'`,
        limit: 1
      });

      let paymentIntentId = order.stripe_payment_intent_id;

      // If not found by metadata, try searching by customer email
      if (!paymentIntentId && paymentIntents.data.length === 0) {
        logStep("Searching payment by customer email", { email: order.customer_email });
        const customers = await stripe.customers.list({ email: order.customer_email, limit: 1 });
        if (customers.data.length > 0) {
          const charges = await stripe.charges.list({ 
            customer: customers.data[0].id, 
            limit: 10 
          });
          // Find charge matching order amount
          const orderAmount = Math.round((order.total_amount || 0) * 100);
          const matchingCharge = charges.data.find((c: Stripe.Charge) => 
            c.amount === orderAmount && 
            c.status === "succeeded" &&
            !c.refunded
          );
          if (matchingCharge?.payment_intent) {
            paymentIntentId = matchingCharge.payment_intent as string;
          }
        }
      } else if (paymentIntents.data.length > 0) {
        paymentIntentId = paymentIntents.data[0].id;
      }

      if (paymentIntentId) {
        logStep("Creating refund", { paymentIntentId });
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: "requested_by_customer"
        });
        stripeRefundId = refund.id;
        logStep("Refund created", { refundId: stripeRefundId });
      } else {
        logStep("WARNING: No payment intent found for refund - manual refund may be needed");
      }
    }

    // Step 2: LexOffice Credit Note (if invoice exists)
    if (order.lexoffice_invoice_id && order.lexoffice_document_type === "invoice") {
      logStep("Creating LexOffice credit note");
      
      const lexofficeApiKey = Deno.env.get("LEXOFFICE_API_KEY");
      if (!lexofficeApiKey) {
        throw new Error("LexOffice not configured");
      }

      // Fetch original invoice to get line items
      const invoiceResponse = await fetch(
        `https://api.lexoffice.io/v1/invoices/${order.lexoffice_invoice_id}`,
        {
          headers: {
            "Authorization": `Bearer ${lexofficeApiKey}`,
            "Accept": "application/json"
          }
        }
      );

      if (invoiceResponse.ok) {
        const invoice = await invoiceResponse.json();
        logStep("Original invoice fetched", { invoiceId: invoice.id });

        // Create credit note based on original invoice
        const creditNotePayload = {
          voucherDate: new Date().toISOString().split("T")[0],
          address: invoice.address,
          lineItems: invoice.lineItems,
          totalPrice: invoice.totalPrice,
          taxConditions: invoice.taxConditions,
          title: `Gutschrift zu ${order.order_number}`,
          introduction: `Stornierung der Bestellung ${order.order_number}${reason ? `\nGrund: ${reason}` : ""}`,
          remark: `Bezug: Rechnung ${order.order_number}`
        };

        const creditNoteResponse = await fetch(
          "https://api.lexoffice.io/v1/credit-notes?finalize=true",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lexofficeApiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(creditNotePayload)
          }
        );

        if (creditNoteResponse.ok) {
          const creditNote = await creditNoteResponse.json();
          lexofficeCreditNoteId = creditNote.id;
          logStep("Credit note created", { creditNoteId: lexofficeCreditNoteId });
        } else {
          const errorText = await creditNoteResponse.text();
          logStep("WARNING: Credit note creation failed", { error: errorText });
        }
      }
    }

    // Step 3: Update database
    const updateData: Record<string, unknown> = {
      status: "cancelled",
      cancellation_reason: reason || null,
      cancelled_at: new Date().toISOString()
    };

    if (stripeRefundId) {
      updateData.payment_status = "refunded";
    }

    if (lexofficeCreditNoteId) {
      updateData.lexoffice_credit_note_id = lexofficeCreditNoteId;
    }

    const { error: updateError } = await supabaseAdmin
      .from("catering_orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }
    logStep("Order updated in database");

    return new Response(
      JSON.stringify({
        success: true,
        stripeRefunded: !!stripeRefundId,
        lexofficeCreditNote: !!lexofficeCreditNoteId,
        message: "Bestellung erfolgreich storniert"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
