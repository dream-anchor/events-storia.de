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
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
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
  let lexofficeDocumentId: string | null = null;
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
      lexofficeDocumentId = lexResult.documentId || null;
      if (lexofficeDocumentId) {
        logStep("LexOffice invoice created", {
          invoiceId: lexofficeDocumentId,
          documentType: lexResult.documentType,
        });
      } else {
        logStep("LexOffice response OK but no documentId (non-fatal)", { result: lexResult });
      }
    } else {
      const errText = await lexResponse.text();
      logStep("LexOffice invoice failed (non-fatal)", { status: lexResponse.status, error: errText });
    }
  } catch (lexErr) {
    logStep("LexOffice error (non-fatal)", {
      error: lexErr instanceof Error ? lexErr.message : String(lexErr),
    });
  }

  // 6. Fetch invoice PDF from LexOffice and email it (non-blocking)
  if (lexofficeDocumentId) {
    await sendInvoicePdfByEmail(lexofficeDocumentId, order);
  } else {
    logStep("Skipping invoice PDF email – no LexOffice document ID");
  }

  // 7. Send notification emails (fire-and-forget)
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
// INVOICE PDF EMAIL (via LexOffice + Resend)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function sendInvoicePdfByEmail(documentId: string, order: any) {
  try {
    logStep("Fetching invoice PDF from LexOffice", { documentId });

    // Step c: Fetch PDF via get-lexoffice-document-by-id
    const pdfResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/get-lexoffice-document-by-id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          voucherId: documentId,
          voucherType: "invoice",
        }),
      }
    );

    if (!pdfResponse.ok) {
      const errText = await pdfResponse.text();
      logStep("Failed to fetch invoice PDF (non-fatal)", { status: pdfResponse.status, error: errText });
      return;
    }

    const pdfResult = await pdfResponse.json();
    const pdfBase64 = pdfResult.pdf;
    const filename = pdfResult.filename || `STORIA_Rechnung_${order.order_number}.pdf`;

    if (!pdfBase64) {
      logStep("No PDF content in response (non-fatal)", { documentId });
      return;
    }

    logStep("Invoice PDF fetched, sending email", { filename, pdfSize: pdfBase64.length });

    // Step d: Send PDF via Resend to customer + STORIA
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logStep("RESEND_API_KEY not configured, skipping invoice email (non-fatal)");
      return;
    }

    const recipients = [order.customer_email, "info@events-storia.de"].filter(Boolean);
    const subject = `Ihre Rechnung – ${order.order_number} | STORIA Events`;
    const htmlBody = buildInvoiceEmailHtml(order);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "STORIA Events <info@events-storia.de>",
        to: recipients,
        subject,
        html: htmlBody,
        attachments: [
          {
            filename,
            content: pdfBase64,
            content_type: "application/pdf",
          },
        ],
      }),
    });

    if (resendResponse.ok) {
      const resendResult = await resendResponse.json();
      logStep("Invoice PDF email sent successfully", {
        messageId: resendResult.id,
        recipients,
      });
    } else {
      const errText = await resendResponse.text();
      logStep("Invoice PDF email failed (non-fatal)", { status: resendResponse.status, error: errText });
    }
  } catch (err) {
    logStep("Invoice PDF email error (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// deno-lint-ignore no-explicit-any
function buildInvoiceEmailHtml(order: any): string {
  const customerName = order.customer_name || "Kunde";
  const orderNumber = order.order_number || "";
  const totalFormatted = formatEUR(order.total_amount || 0);

  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1a1a1a;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">STORIA Events</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#1a1a1a;margin:0 0 16px;">Ihre Rechnung</h2>
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Guten Tag ${customerName},
          </p>
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 16px;">
            vielen Dank für Ihre Bestellung <strong>${orderNumber}</strong>.
            Anbei finden Sie Ihre Rechnung über <strong>${totalFormatted}</strong> als PDF-Dokument.
          </p>
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.
          </p>
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0;">
            Herzliche Grüße,<br/>
            <strong>Ihr STORIA Events Team</strong>
          </p>
        </td></tr>
        <tr><td style="background-color:#f0f0f0;padding:16px 32px;font-size:12px;color:#888;text-align:center;">
          STORIA Events · Karlstr. 47a · 80333 München<br/>
          info@events-storia.de · +49 89 954 574 750
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
