import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Body {
  eventId: string; // v2_events.id (entspricht catering_orders.id / event_bookings.id)
  context: "catering_order" | "event_booking" | "inquiry";
  amountEur: number; // offener Betrag in Euro (brutto)
  description?: string;
  customerEmail: string;
  customerName?: string;
  sendEmail?: boolean; // default true
}

const log = (s: string, d?: unknown) => console.log(`[BALANCE-LINK] ${s}`, d ? JSON.stringify(d) : "");

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const { data: userData, error: ue } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !userData.user) throw new Error("Auth failed");
    const { data: role } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").single();
    if (!role) throw new Error("Admin role required");

    const body: Body = await req.json();
    if (!body.eventId || !body.amountEur || body.amountEur <= 0 || !body.customerEmail) {
      throw new Error("eventId, amountEur, customerEmail required");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const origin = req.headers.get("origin") || "https://events-storia.de";

    const product = await stripe.products.create({
      name: body.description || `Storia – Restzahlung`,
      metadata: { event_id: body.eventId, context: body.context, kind: "balance" },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(body.amountEur * 100),
      currency: "eur",
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: { type: "redirect", redirect: { url: `${origin}/zahlung-erfolgreich?event=${body.eventId}` } },
      metadata: {
        event_id: body.eventId,
        context: body.context,
        kind: "balance",
        amount_eur: body.amountEur.toString(),
        customer_email: body.customerEmail,
      },
      customer_creation: "always",
    });
    log("payment link created", { id: paymentLink.id, url: paymentLink.url });

    // Payment-Record (pending) anlegen, damit die Timeline ihn sofort sieht
    await supabaseAdmin.from("v2_payments").insert({
      event_id: body.eventId,
      amount_cents: Math.round(body.amountEur * 100),
      payment_type: "balance",
      status: "sent",
      stripe_payment_link_url: paymentLink.url,
      notes: body.description || "Restzahlung via Maestro",
      created_by: userData.user.email ?? null,
    });

    // Optional: E-Mail mit dem Link via send-payment-email
    if (body.sendEmail !== false) {
      try {
        await supabaseAdmin.functions.invoke("send-payment-email", {
          body: {
            eventId: body.eventId,
            context: body.context,
            amountEur: body.amountEur,
            paymentLinkUrl: paymentLink.url,
            customerEmail: body.customerEmail,
            customerName: body.customerName,
            kind: "balance",
            description: body.description,
          },
        });
      } catch (e) {
        log("send-payment-email failed (non-fatal)", e instanceof Error ? e.message : e);
      }
    }

    // Activity Log
    await supabaseAdmin.from("activity_logs").insert({
      entity_type: body.context,
      entity_id: body.eventId,
      action: "balance_payment_link_created",
      actor_email: userData.user.email,
      metadata: {
        amount_eur: body.amountEur,
        payment_link_id: paymentLink.id,
        payment_link_url: paymentLink.url,
      },
    });

    return new Response(JSON.stringify({ success: true, paymentLinkUrl: paymentLink.url, paymentLinkId: paymentLink.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});