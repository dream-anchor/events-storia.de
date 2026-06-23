import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { reportEdgeError } from '../_shared/reportError.ts';

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
      } else if (metadata.option_quantities && metadata.inquiry_id) {
        // ━━━ MULTI-OPTION EVENT PAYMENT (create-payment-session) ━━━
        await handleMultiOptionPayment(supabase, stripe, session, metadata);
      } else if (orderType === "event" && orderNumber) {
        // ━━━ EVENT BOOKING DIRECT PAYMENT ━━━
        await handleEventBookingPayment(supabase, session, orderNumber, metadata);
      } else if (metadata.payment_id && metadata.source === 'maestro') {
        // ━━━ MAESTRO PAYMENT (Anzahlung / Vorauszahlung via Admin) ━━━
        await handleMaestroPayment(supabase, stripe, session, metadata);
      } else if (metadata.kind === 'prepayment_per_person' && metadata.event_id) {
        // ━━━ PREPAYMENT mit anpassbarer Personenzahl ━━━
        await handlePrepaymentPerPerson(supabase, stripe, session, metadata);
      } else if (metadata.order_type === 'voucher' && metadata.voucher_id) {
        // ━━━ GUTSCHEIN-KAUF ━━━
        await handleVoucherPayment(supabase, session, metadata);
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
    reportEdgeError({ source: 'edge:handle-stripe-webhook', severity: 'critical', message: msg });
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
  const paymentType = metadata.payment_type as 'full' | 'deposit' | undefined;
  const totalAmount = metadata.total_amount ? parseFloat(metadata.total_amount) : null;
  const amountPaid = session.amount_total ? session.amount_total / 100 : null;

  logStep("Processing event offer payment", { optionId, inquiryId, paymentType, amountPaid });

  // paid_amount + remaining_amount aktualisieren (für Anzahlungs-Flow)
  if (inquiryId && amountPaid !== null) {
    const updatePayment: Record<string, unknown> = {
      paid_amount: amountPaid,
      payment_type: paymentType || 'full',
    };
    if (paymentType === 'deposit' && totalAmount !== null) {
      updatePayment.remaining_amount = totalAmount - amountPaid;
    } else {
      updatePayment.remaining_amount = 0;
    }
    await supabase
      .from('event_inquiries')
      .update(updatePayment)
      .eq('id', inquiryId);
    logStep("Paid amount updated", updatePayment);
  }

  // Inline payment processing (no more Edge→Edge HTTP call)
  await processEventOfferPaymentInline(supabase, session, optionId, inquiryId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INLINE OFFER PAYMENT PROCESSING (replaces handle-offer-payment HTTP call)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function processEventOfferPaymentInline(
  supabase: any,
  session: Stripe.Checkout.Session,
  optionId: string,
  inquiryId: string | undefined,
) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!optionId || !UUID_RE.test(optionId)) {
    logStep("Invalid optionId, skipping inline payment", { optionId });
    return;
  }

  // Lookup option (supports both v2 UUID and legacy source_option_id)
  const { data: option, error: optErr } = await supabase
    .from("v2_offer_options")
    .select("id, event_id, package_id, label, guest_count, menu_selection, amount_total, stripe_payment_link_id, source_option_id")
    .or(`id.eq.${optionId},source_option_id.eq.${optionId}`)
    .maybeSingle();

  if (optErr || !option) {
    logStep("v2_offer_option not found for inline processing", { optionId, error: optErr?.message });
    return;
  }

  // Idempotency: already processed?
  const { data: existingPayment } = await supabase
    .from("v2_payments")
    .select("id, event_id")
    .eq("source_offer_option_id", option.id)
    .maybeSingle();

  if (existingPayment) {
    logStep("v2_payment already exists (idempotent)", { paymentId: existingPayment.id });
    return;
  }

  // Load v2_event
  const { data: ev, error: evErr } = await supabase
    .from("v2_events")
    .select("id, customer_id, date, time_from, event_time, booking_number, status")
    .eq("id", option.event_id)
    .single();

  if (evErr || !ev) {
    logStep("v2_event not found", { eventId: option.event_id });
    return;
  }

  // Load customer
  const { data: customer, error: custErr } = await supabase
    .from("v2_customers")
    .select("id, name, email, company, phone")
    .eq("id", ev.customer_id)
    .single();

  if (custErr || !customer) {
    logStep("v2_customer not found", { customerId: ev.customer_id });
    return;
  }

  // Insert v2_payments
  const sessionAmountCents = typeof session.amount_total === "number" ? session.amount_total : null;
  const fullAmountCents = Math.round(option.amount_total * 100);
  const amountCents = sessionAmountCents && sessionAmountCents > 0 ? sessionAmountCents : fullAmountCents;
  const metaPaymentType = (session.metadata?.payment_type as string | undefined)?.toLowerCase();
  const paymentType: "full" | "deposit" =
    metaPaymentType === "deposit" || metaPaymentType === "full"
      ? (metaPaymentType as "full" | "deposit")
      : amountCents < fullAmountCents - 1
        ? "deposit"
        : "full";
  const { data: paymentData, error: payErr } = await supabase
    .from("v2_payments")
    .insert({
      event_id: ev.id,
      amount_cents: amountCents,
      payment_type: paymentType,
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString(),
      paid_via: "stripe_checkout",
      source_offer_option_id: option.id,
    })
    .select()
    .single();

  if (payErr) {
    if (payErr.code === "23505") {
      logStep("v2_payment unique violation (race), already exists");
      return;
    }
    logStep("Failed to create v2_payment", { error: payErr.message });
    return;
  }

  // Generate booking number if missing
  let bookingNumber = ev.booking_number;
  if (!bookingNumber) {
    const currentYear = new Date().getFullYear();
    const { data: seqNum, error: seqErr } = await supabase.rpc('get_next_order_number', {
      p_prefix: 'EVT', p_year: currentYear,
    });
    bookingNumber = seqErr
      ? `EVT-${currentYear}-${Date.now().toString().slice(-4)}`
      : `EVT-${currentYear}-${String(seqNum).padStart(4, '0')}`;
  }

  // Promote event. v2_event_status has no 'confirmed' value, so we keep
  // 'paid' for both full and deposit payments. The open balance is derived
  // from v2_events.amount_total minus the sum of v2_payments. We track the
  // deposit case in offer_phase so the UI can distinguish "Anzahlung" from
  // "voll bezahlt".
  await supabase
    .from("v2_events")
    .update({
      status: "paid",
      offer_phase: paymentType === "deposit" ? "deposit_paid" : "paid",
      booking_number: bookingNumber,
      package_id: option.package_id,
      menu_selection: option.menu_selection,
      guest_count: option.guest_count,
      amount_total: option.amount_total,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", ev.id);

  logStep("v2_event promoted", { eventId: ev.id, bookingNumber, paymentType });

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

  // Create LexOffice invoice (non-fatal)
  try {
    const lexofficePayload = {
      orderId: ev.id,
      orderNumber: bookingNumber,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || '',
      companyName: customer.company || undefined,
      billingAddress: {
        name: customer.company || customer.name,
        street: '', zip: '', city: '', country: 'DE',
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
      documentType: 'invoice',
      isPaid: true,
      desiredDate: ev.date || undefined,
      desiredTime: ev.event_time || ev.time_from || undefined,
      paymentMethod: 'stripe',
      isEventBooking: true,
    };

    const lexRes = await fetch(
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

    if (lexRes.ok) {
      const lexResult = await lexRes.json();
      if (lexResult.invoiceId || lexResult.quotationId) {
        const invoiceId = lexResult.invoiceId || lexResult.quotationId;
        const documentType = lexResult.invoiceId ? 'invoice' : 'quotation';

        await supabase.from("v2_events").update({
          invoice_lexoffice_id: invoiceId,
          invoice_lexoffice_number: lexResult.invoiceNumber || null,
          lexoffice_document_type: documentType,
        }).eq("id", ev.id);

        await supabase.from("v2_payments").update({
          lexoffice_invoice_id: invoiceId,
          lexoffice_invoice_number: lexResult.invoiceNumber || null,
        }).eq("id", paymentData.id);

        logStep("LexOffice invoice created and linked", { invoiceId, documentType });
      }
    } else {
      logStep("LexOffice invoice creation failed (non-fatal)", { status: lexRes.status });
    }
  } catch (lexErr) {
    logStep("LexOffice error (non-fatal)", { error: lexErr instanceof Error ? lexErr.message : String(lexErr) });
  }

  logStep("Event offer payment processed inline", { eventId: ev.id, bookingNumber });
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
// MAESTRO PAYMENT (Anzahlung / Vorauszahlung)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function handleMaestroPayment(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
) {
  const paymentId = metadata.payment_id;
  const inquiryId = metadata.inquiry_id;
  const paymentType = metadata.payment_type;

  logStep("Processing maestro payment", { paymentId, inquiryId, paymentType });

  // Idempotenz-Check
  const { data: existing } = await supabase
    .from('event_payments')
    .select('id, status')
    .eq('id', paymentId)
    .single();

  if (existing?.status === 'paid') {
    logStep("Maestro payment already marked as paid, skipping", { paymentId });
    return;
  }

  // Zahlungsmethode ermitteln (card, sepa_debit, billie, ...)
  let paidVia = 'unknown';
  try {
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      if (pi.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
        paidVia = pm.type;
      }
    }
  } catch (err) {
    logStep("Could not retrieve payment method (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // event_payments aktualisieren
  const { error: updateError } = await supabase
    .from('event_payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
      stripe_payment_intent_id: session.payment_intent as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    logStep("ERROR: Failed to update maestro payment", { error: updateError.message });
    return;
  }

  logStep("Maestro payment marked as paid", { paymentId, paidVia });

  // Activity Log
  await logActivity(supabase, {
    entity_type: 'event_inquiry',
    entity_id: inquiryId,
    action: `maestro_${paymentType}_paid`,
    description: `Zahlung eingegangen: ${formatEUR((session.amount_total || 0) / 100)} via ${paidVia}`,
    metadata: {
      payment_id: paymentId,
      payment_type: paymentType,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent,
      paid_via: paidVia,
      amount_cents: session.amount_total,
    },
  });

  // ── UStG-konforme Anzahlungs- / Schlussrechnung erzeugen ────────────────
  await triggerInvoiceForPayment(paymentId, inquiryId, paymentType);

  logStep("Maestro payment processing complete", { paymentId, inquiryId });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MULTI-OPTION EVENT PAYMENT (from create-payment-session)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function handleMultiOptionPayment(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
) {
  const inquiryId = metadata.inquiry_id;
  const paymentType = (metadata.payment_type || 'full') as 'full' | 'deposit';
  const totalAmount = metadata.total_amount ? parseFloat(metadata.total_amount) : null;
  const depositPercent = metadata.deposit_percent ? parseFloat(metadata.deposit_percent) : 20;
  const amountPaid = session.amount_total ? session.amount_total / 100 : null;

  let optionQuantities: Array<{ optionId: string; quantity: number }> = [];
  try {
    optionQuantities = JSON.parse(metadata.option_quantities);
  } catch {
    logStep("ERROR: Could not parse option_quantities", { raw: metadata.option_quantities });
    return;
  }

  logStep("Processing multi-option payment", {
    inquiryId, paymentType, amountPaid, totalAmount, options: optionQuantities.length,
  });

  // Idempotenz: Prüfe ob bereits ein v2_payment für diese Inquiry+Session existiert
  const { data: existingPayment } = await supabase
    .from("v2_payments")
    .select("id")
    .eq("event_id", inquiryId)
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existingPayment) {
    logStep("Multi-option payment already processed (idempotent skip)", { paymentId: existingPayment.id });
    return;
  }

  // paid_amount + remaining_amount auf event_inquiries aktualisieren
  if (amountPaid !== null) {
    const updatePayment: Record<string, unknown> = {
      paid_amount: amountPaid,
      payment_type: paymentType,
    };
    if (paymentType === 'deposit' && totalAmount !== null) {
      updatePayment.remaining_amount = totalAmount - amountPaid;
    } else {
      updatePayment.remaining_amount = 0;
    }
    await supabase
      .from('event_inquiries')
      .update(updatePayment)
      .eq('id', inquiryId);
    logStep("Paid amount updated on inquiry", updatePayment);
  }

  // offer_phase → confirmed, status → confirmed
  await supabase
    .from('event_inquiries')
    .update({
      offer_phase: 'confirmed',
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('id', inquiryId);

  // Mark chosen options with selected_quantity + deactivate non-chosen
  const chosenIds: string[] = [];
  for (const { optionId: oid, quantity } of optionQuantities) {
    if (quantity > 0) {
      chosenIds.push(oid);
      await supabase
        .from('v2_offer_options')
        .update({
          is_chosen: true,
          chosen_at: new Date().toISOString(),
          selected_quantity: quantity,
        })
        .eq('id', oid)
        .eq('event_id', inquiryId);
    }
  }

  // Deactivate non-chosen options
  if (chosenIds.length > 0) {
    const { data: allOpts } = await supabase
      .from('v2_offer_options')
      .select('id')
      .eq('event_id', inquiryId);
    if (allOpts) {
      const deactivateIds = (allOpts as Array<{ id: string }>)
        .map(o => o.id)
        .filter(id => !chosenIds.includes(id));
      for (const did of deactivateIds) {
        await supabase
          .from('v2_offer_options')
          .update({ is_active: false })
          .eq('id', did);
      }
    }
  }

  logStep("Multi-option: marked chosen options", { chosenIds, optionQuantities });

  // v2_payments-Eintrag anlegen
  const amountCents = amountPaid ? Math.round(amountPaid * 100) : (session.amount_total || 0);

  // Zahlungsmethode ermitteln
  let paidVia = 'stripe_checkout';
  try {
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      if (pi.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
        paidVia = pm.type || 'stripe_checkout';
      }
    }
  } catch { /* non-fatal */ }

  const { error: paymentInsertError } = await supabase
    .from('v2_payments')
    .insert({
      event_id: inquiryId,
      amount_cents: amountCents,
      payment_type: paymentType,
      status: 'paid',
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: (session.payment_intent as string) || null,
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
    });

  if (paymentInsertError) {
    logStep("v2_payments insert error", { error: paymentInsertError.message });
  }

  // Booking-Nummer generieren falls nötig
  const { data: ev } = await supabase
    .from('v2_events')
    .select('id, booking_number')
    .eq('id', inquiryId)
    .maybeSingle();

  if (ev && !ev.booking_number) {
    const currentYear = new Date().getFullYear();
    const { data: nextNum } = await supabase.rpc('get_next_order_number', {
      p_prefix: 'EVT', p_year: currentYear,
    });
    const bookingNumber = `EVT-${currentYear}-${String(nextNum || 9999).padStart(4, '0')}`;
    await supabase.from('v2_events').update({
      booking_number: bookingNumber,
      status: 'paid',
      offer_phase: 'confirmed',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>).eq('id', inquiryId);
    logStep("Booking number generated", { bookingNumber });
  }

  // LexOffice-Rechnung triggern (non-blocking)
  try {
    const lexResp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-manual-invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ inquiryId, useSelectedQuantity: true }),
      }
    );
    if (lexResp.ok) {
      logStep("LexOffice invoice triggered for multi-option", { inquiryId });
    } else {
      logStep("LexOffice invoice failed (non-fatal)", { status: lexResp.status });
    }
  } catch (err) {
    logStep("LexOffice invoice error (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Activity Log
  await logActivity(supabase, {
    entity_type: 'event_inquiry',
    entity_id: inquiryId,
    action: `multi_option_${paymentType}_paid`,
    description: `Multi-Option Zahlung eingegangen: ${formatEUR(amountPaid || 0)} (${optionQuantities.length} Optionen)`,
    metadata: {
      payment_type: paymentType,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent,
      paid_via: paidVia,
      amount_cents: session.amount_total,
      option_quantities: optionQuantities,
    },
  });

  logStep("Multi-option payment processing complete", { inquiryId });
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
          info@events-storia.de · +49 89 51519696
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UStG-Helper: Anzahlungsrechnung bzw. Schlussrechnung triggern
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function triggerInvoiceForPayment(
  paymentId: string,
  inquiryId: string,
  paymentType: string,
) {
  try {
    if (paymentType === "deposit" || paymentType === "prepayment") {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lexoffice-downpayment-invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ payment_id: paymentId }),
        },
      );
      logStep("Anzahlungsrechnung getriggert", { paymentId });
    } else if (paymentType === "final") {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lexoffice-final-invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ inquiryId }),
        },
      );
      logStep("Schlussrechnung getriggert", { inquiryId });
    }
  } catch (err) {
    logStep("Invoice trigger error (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PREPAYMENT mit anpassbarer Personenzahl (create-prepayment-link)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// deno-lint-ignore no-explicit-any
async function handlePrepaymentPerPerson(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const eventId = metadata.event_id;
  const minGuests = parseInt(metadata.min_guests || "0", 10);
  const pricePerPersonCents = parseInt(metadata.price_per_person_cents || "0", 10);

  logStep("Processing prepayment_per_person", { eventId, sessionId: session.id });

  // Idempotenz
  const { data: existing } = await supabase
    .from("v2_payments")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (existing?.status === "paid") {
    logStep("prepayment already paid, skipping", { paymentId: existing.id });
    return;
  }

  // Final-Quantity aus Line Items lesen
  let finalGuests = minGuests;
  try {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    if (items.data[0]?.quantity) finalGuests = items.data[0].quantity;
  } catch (e) {
    logStep("listLineItems failed", { error: e instanceof Error ? e.message : String(e) });
  }

  const amountCents = session.amount_total ?? (pricePerPersonCents * finalGuests);

  // Existing sent record finden (anhand stripe_payment_link_url)
  const linkUrl = (session as any).url || null;
  const { data: sentRow } = await supabase
    .from("v2_payments")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "sent")
    .ilike("notes", "%prepayment%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let paymentId = sentRow?.id;

  // Payment-Methode ermitteln
  let paidVia = "card";
  try {
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      if (pi.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
        paidVia = pm.type;
      }
    }
  } catch {/* nfat */}

  if (paymentId) {
    await supabase.from("v2_payments").update({
      status: "paid",
      amount_cents: amountCents,
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: (session.payment_intent as string) || null,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
  } else {
    const { data: ins } = await supabase.from("v2_payments").insert({
      event_id: eventId,
      amount_cents: amountCents,
      payment_type: "balance",
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: paidVia,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: (session.payment_intent as string) || null,
      notes: `Prepayment per Person (${finalGuests} Gäste)`,
    }).select("id").single();
    paymentId = ins?.id;
  }

  // guest_count am Event aktualisieren (nur wenn ≥ min)
  if (finalGuests >= minGuests) {
    await supabase.from("v2_events").update({
      guest_count: finalGuests,
      updated_at: new Date().toISOString(),
    }).eq("id", eventId);
  }

  // Activity log
  await logActivity(supabase, {
    entity_type: "event_inquiry",
    entity_id: eventId,
    action: "prepayment_per_person_paid",
    description: `Kunde hat ${finalGuests} Gäste bestätigt und ${formatEUR(amountCents / 100)} gezahlt (${paidVia})`,
    metadata: {
      payment_id: paymentId,
      final_guests: finalGuests,
      min_guests: minGuests,
      amount_cents: amountCents,
      price_per_person_cents: pricePerPersonCents,
      stripe_session_id: session.id,
      paid_via: paidVia,
    },
  });

  // Kunden-Bestätigung
  if (paymentId) {
    try {
      await supabase.functions.invoke("send-payment-confirmation-v2", {
        body: { payment_id: paymentId },
      });
    } catch (e) {
      logStep("confirmation email failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Operator-Info via Resend
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "STORIA Events <info@events-storia.de>",
          to: ["info@events-storia.de"],
          subject: `Prepayment eingegangen: ${finalGuests} Gäste · ${formatEUR(amountCents / 100)}`,
          html: `<p>Ein Kunde hat per Stripe-Prepayment-Link gezahlt.</p>
                 <ul>
                   <li><strong>Event-ID:</strong> ${eventId}</li>
                   <li><strong>Finale Personenzahl:</strong> ${finalGuests} (Minimum war ${minGuests})</li>
                   <li><strong>Betrag:</strong> ${formatEUR(amountCents / 100)}</li>
                   <li><strong>Zahlungsart:</strong> ${paidVia}</li>
                   <li><strong>Stripe-Session:</strong> ${session.id}</li>
                 </ul>`,
        }),
      });
    }
  } catch (e) {
    logStep("operator email failed", { error: e instanceof Error ? e.message : String(e) });
  }

  logStep("prepayment_per_person processing complete", { paymentId, finalGuests, amountCents });
}
