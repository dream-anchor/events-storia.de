import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    // ─── Stripe signature verification ───
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Invalid signature", { error: msg });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // ─── Initialize Supabase with service role (bypasses RLS) ───
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ─── Route by event type ───
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      logStep("Checkout completed", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        metadata,
      });

      // Only process if payment is actually received
      if (session.payment_status !== "paid") {
        logStep("Payment not yet received, skipping", {
          paymentStatus: session.payment_status,
        });
        return new Response(JSON.stringify({ received: true, action: "skipped_unpaid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderType = metadata.order_type;
      const orderNumber = metadata.order_number;

      if (orderType === "catering" && orderNumber) {
        // ━━━ CATERING ORDER PAYMENT ━━━
        await handleCateringPayment(supabase, session, orderNumber, metadata);
      } else if (metadata.option_id && metadata.inquiry_id) {
        // ━━━ EVENT OFFER PAYMENT ━━━
        await handleEventOfferPayment(supabase, stripe, session, metadata);
      } else if (orderType === "event" && orderNumber) {
        // ━━━ EVENT BOOKING DIRECT PAYMENT ━━━
        await handleEventBookingPayment(supabase, session, orderNumber, metadata);
      } else {
        logStep("Unknown payment type, no matching metadata", { metadata });
      }
    } else if (event.type === "checkout.session.expired") {
      logStep("Checkout session expired", { sessionId: (event.data.object as Stripe.Checkout.Session).id });
      // Could update order status to 'expired' here if needed
    } else {
      logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("FATAL ERROR", { message: msg });
    // Return 200 even on error to prevent Stripe from retrying indefinitely
    // Log the error for debugging but acknowledge receipt
    return new Response(JSON.stringify({ received: true, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CATERING ORDER: Update status + LexOffice + notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function handleCateringPayment(
  supabase: any,
  session: Stripe.Checkout.Session,
  orderNumber: string,
  metadata: Record<string, string>
) {
  logStep("Processing catering payment", { orderNumber });

  // 1. Fetch order from DB
  const { data: order, error: orderError } = await supabase
    .from("catering_orders")
    .select("*")
    .eq("order_number", orderNumber)
    .single();

  if (orderError || !order) {
    logStep("ERROR: Catering order not found", { orderNumber, error: orderError?.message });
    return;
  }

  // 2. Check if already processed (idempotency)
  if (order.payment_status === "paid") {
    logStep("Order already marked as paid, skipping", { orderNumber });
    return;
  }

  // 3. Update payment status + stripe reference
  const { error: updateError } = await supabase
    .from("catering_orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      stripe_payment_intent_id: session.payment_intent as string || null,
    })
    .eq("id", order.id);

  if (updateError) {
    logStep("ERROR: Failed to update payment status", { error: updateError.message });
    return;
  }

  logStep("Payment status updated to paid", { orderId: order.id });

  // 4. Log activity
  await logActivity(supabase, {
    entity_type: "catering_order",
    entity_id: order.id,
    action: "payment_confirmed",
    description: `Stripe-Zahlung bestätigt: ${formatEUR(order.total_amount)} (Session: ${session.id})`,
    metadata: {
      stripe_session_id: session.id,
      payment_intent: session.payment_intent,
      amount: order.total_amount,
    },
  });

  // 5. Create LexOffice invoice (fire-and-forget, non-blocking)
  const lexofficePayload = buildLexofficePayload(order, metadata);
  try {
    const lexResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lexoffice-invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(lexofficePayload),
      }
    );

    if (lexResponse.ok) {
      const lexResult = await lexResponse.json();
      logStep("LexOffice invoice created", {
        invoiceId: lexResult.documentId,
        documentType: lexResult.documentType,
      });
    } else {
      const errText = await lexResponse.text();
      logStep("LexOffice invoice failed (non-fatal)", { status: lexResponse.status, error: errText });
    }
  } catch (lexErr) {
    logStep("LexOffice error (non-fatal)", {
      error: lexErr instanceof Error ? lexErr.message : String(lexErr),
    });
  }

  // 6. Send notification emails (fire-and-forget)
  const notificationPayload = buildNotificationPayload(order);
  try {
    const notifResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(notificationPayload),
      }
    );

    if (notifResponse.ok) {
      logStep("Order notification sent");
    } else {
      const errText = await notifResponse.text();
      logStep("Order notification failed (non-fatal)", { error: errText });
    }
  } catch (notifErr) {
    logStep("Notification error (non-fatal)", {
      error: notifErr instanceof Error ? notifErr.message : String(notifErr),
    });
  }

  logStep("Catering payment processing complete", { orderNumber, orderId: order.id });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT OFFER PAYMENT (from payment links)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function handleEventOfferPayment(
  supabase: any,
  _stripe: Stripe,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
) {
  const optionId = metadata.option_id;
  const inquiryId = metadata.inquiry_id;
  logStep("Processing event offer payment", { optionId, inquiryId });

  // Delegate to existing handle-offer-payment logic via internal call
  // This preserves the booking creation + LexOffice logic already built there
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-offer-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ optionId, inquiryId }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      logStep("Event offer payment processed", result);
    } else {
      const errText = await response.text();
      logStep("Event offer payment failed", { error: errText });
    }
  } catch (err) {
    logStep("Event offer payment error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT BOOKING DIRECT PAYMENT (EVT-BUCHUNG prefix)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function handleEventBookingPayment(
  supabase: any,
  session: Stripe.Checkout.Session,
  orderNumber: string,
  _metadata: Record<string, string>
) {
  logStep("Processing event booking payment", { orderNumber });

  const { data: booking, error: bookingError } = await supabase
    .from("event_bookings")
    .select("*")
    .eq("booking_number", orderNumber)
    .single();

  if (bookingError || !booking) {
    logStep("ERROR: Event booking not found", { orderNumber, error: bookingError?.message });
    return;
  }

  if (booking.payment_status === "paid") {
    logStep("Event booking already paid, skipping", { orderNumber });
    return;
  }

  const { error: updateError } = await supabase
    .from("event_bookings")
    .update({
      payment_status: "paid",
      status: "confirmed",
      stripe_payment_intent_id: session.payment_intent as string || null,
    })
    .eq("id", booking.id);

  if (updateError) {
    logStep("ERROR: Failed to update event booking", { error: updateError.message });
    return;
  }

  logStep("Event booking payment confirmed", { bookingId: booking.id });

  await logActivity(supabase, {
    entity_type: "event_booking",
    entity_id: booking.id,
    action: "payment_confirmed",
    description: `Stripe-Zahlung bestätigt: ${formatEUR(booking.total_amount)}`,
    metadata: { stripe_session_id: session.id },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatEUR(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// deno-lint-ignore no-explicit-any
async function logActivity(supabase: any, entry: {
  entity_type: string;
  entity_id: string;
  action: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("activity_logs").insert({
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      actor_email: "stripe-webhook@system",
      metadata: {
        ...entry.metadata,
        description: entry.description,
      },
    });
  } catch (err) {
    logStep("Failed to log activity (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// deno-lint-ignore no-explicit-any
function buildLexofficePayload(order: any, _metadata: Record<string, string>) {
  const items = (order.items || []).map((item: { id: string; name: string; quantity: number; price: number }) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  }));

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone || "",
    companyName: order.company_name || undefined,
    billingAddress: {
      name: order.billing_name || order.company_name || order.customer_name,
      street: order.billing_street || "",
      zip: order.billing_zip || "",
      city: order.billing_city || "",
      country: order.billing_country || "Deutschland",
    },
    items,
    subtotal: (order.total_amount || 0) - (order.delivery_cost || 0) - (order.minimum_order_surcharge || 0),
    deliveryCost: order.delivery_cost || 0,
    minimumOrderSurcharge: order.minimum_order_surcharge || 0,
    distanceKm: order.calculated_distance_km || undefined,
    grandTotal: order.total_amount,
    isPickup: order.is_pickup || false,
    documentType: "invoice" as const,
    isPaid: true,
    desiredDate: order.desired_date || undefined,
    desiredTime: order.desired_time || undefined,
    deliveryAddress: !order.is_pickup
      ? [order.delivery_street, `${order.delivery_zip || ""} ${order.delivery_city || ""}`]
          .filter(Boolean)
          .join(", ")
          .trim() || undefined
      : undefined,
    deliveryFloor: order.delivery_floor || undefined,
    hasElevator: order.has_elevator || false,
    notes: order.notes || undefined,
    paymentMethod: "stripe" as const,
    isEventBooking: false,
  };
}

// deno-lint-ignore no-explicit-any
function buildNotificationPayload(order: any) {
  return {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone || "",
    companyName: order.company_name || undefined,
    deliveryStreet: order.delivery_street,
    deliveryZip: order.delivery_zip,
    deliveryCity: order.delivery_city,
    deliveryFloor: order.delivery_floor,
    hasElevator: order.has_elevator,
    isPickup: order.is_pickup || false,
    desiredDate: order.desired_date,
    desiredTime: order.desired_time,
    notes: order.notes,
    items: order.items || [],
    subtotal: (order.total_amount || 0) - (order.delivery_cost || 0) - (order.minimum_order_surcharge || 0),
    deliveryCost: order.delivery_cost || 0,
    minimumOrderSurcharge: order.minimum_order_surcharge || 0,
    distanceKm: order.calculated_distance_km || undefined,
    grandTotal: order.total_amount,
    billingAddress: {
      name: order.billing_name || order.company_name || order.customer_name,
      street: order.billing_street || "",
      zip: order.billing_zip || "",
      city: order.billing_city || "",
      country: order.billing_country || "Deutschland",
    },
    paymentMethod: "stripe" as const,
    paymentStatus: "paid" as const,
    isEventBooking: false,
  };
}
