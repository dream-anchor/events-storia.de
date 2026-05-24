import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slug, guests } = await req.json();
    if (!slug || typeof slug !== "string") throw new Error("slug required");
    const guestsNum = Number(guests);
    if (!Number.isFinite(guestsNum) || guestsNum < 1) throw new Error("guests invalid");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: link, error } = await supabase
      .from("balance_payment_links")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!link) throw new Error("Link nicht gefunden");

    if (guestsNum < link.min_guests || guestsNum > link.max_guests) {
      throw new Error(`Gästezahl muss zwischen ${link.min_guests} und ${link.max_guests} liegen`);
    }

    const amountCents = Math.round(guestsNum) * link.price_per_person_cents - link.deposit_paid_cents;
    if (amountCents <= 0) throw new Error("Betrag ungültig");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY fehlt");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const origin = req.headers.get("origin") || "https://events-storia.de";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: link.customer_email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: link.event_label,
            description: `${guestsNum} Gäste × ${(link.price_per_person_cents / 100).toFixed(2)} € − Anzahlung ${(link.deposit_paid_cents / 100).toFixed(2)} €`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/restzahlung/${slug}?status=success`,
      cancel_url: `${origin}/restzahlung/${slug}?status=cancelled`,
      metadata: {
        balance_link_slug: slug,
        balance_link_id: link.id,
        guests: String(Math.round(guestsNum)),
        price_per_person_cents: String(link.price_per_person_cents),
        deposit_paid_cents: String(link.deposit_paid_cents),
        event_id: link.event_id ?? "",
      },
    });

    if (link.event_id) {
      await supabase.from("v2_payments").insert({
        event_id: link.event_id,
        amount_cents: amountCents,
        payment_type: "balance",
        status: "sent",
        stripe_checkout_session_id: session.id,
        notes: `Restzahlung via /restzahlung/${slug} – ${guestsNum} Gäste`,
      });
    }

    await supabase.from("activity_logs").insert({
      entity_type: "balance_payment_link",
      entity_id: link.id,
      action: "checkout_session_created",
      metadata: {
        slug, guests: guestsNum, amount_cents: amountCents,
        stripe_session_id: session.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url, amount_cents: amountCents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});