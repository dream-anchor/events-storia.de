import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Erstellt einen Stripe Payment Link mit anpassbarer Menge:
 * - unit_amount = Preis pro Person (brutto)
 * - default quantity = minGuests (= guest_count am Event)
 * - adjustable_quantity { minimum: minGuests, maximum: maxGuests ?? 999 }
 * - metadata.kind = "prepayment_per_person" (für Webhook)
 *
 * Optional: sendet eine Prepayment-Einladungs-Mail über send-payment-confirmation-v2.
 */

interface Body {
  eventId: string;
  pricePerPersonCents: number;
  minGuests: number;
  maxGuests?: number | null;
  description?: string;
  sendEmail?: boolean;
}

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-PREPAYMENT-LINK] ${s}`, d ? JSON.stringify(d) : "");

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Auth (admin only)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Kein Auth-Header");
    const { data: userData, error: ue } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (ue || !userData.user) throw new Error("Auth fehlgeschlagen");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();
    if (!role) throw new Error("Adminrolle erforderlich");

    const body: Body = await req.json();
    if (
      !body.eventId ||
      !Number.isFinite(body.pricePerPersonCents) ||
      body.pricePerPersonCents <= 0 ||
      !Number.isFinite(body.minGuests) ||
      body.minGuests < 1
    ) {
      throw new Error("eventId, pricePerPersonCents > 0 und minGuests >= 1 erforderlich");
    }
    const minGuests = Math.floor(body.minGuests);
    const maxGuests = body.maxGuests && body.maxGuests >= minGuests
      ? Math.min(Math.floor(body.maxGuests), 999)
      : 999;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY fehlt");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const origin = req.headers.get("origin") || "https://events-storia.de";

    const productName = body.description?.trim() || "Storia – Restzahlung pro Gast";

    const product = await stripe.products.create({
      name: productName,
      metadata: { event_id: body.eventId, kind: "prepayment_per_person" },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(body.pricePerPersonCents),
      currency: "eur",
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price: price.id,
        quantity: minGuests,
        adjustable_quantity: {
          enabled: true,
          minimum: minGuests,
          maximum: maxGuests,
        },
      }],
      after_completion: {
        type: "redirect",
        redirect: { url: `${origin}/zahlung-erfolgreich?event=${body.eventId}` },
      },
      metadata: {
        event_id: body.eventId,
        kind: "prepayment_per_person",
        min_guests: String(minGuests),
        max_guests: String(maxGuests),
        price_per_person_cents: String(body.pricePerPersonCents),
      },
      customer_creation: "always",
    });
    log("payment link created", { id: paymentLink.id, url: paymentLink.url });

    // v2_payments-Record anlegen (status='sent', erwartete Summe = minGuests * preis)
    const expectedCents = body.pricePerPersonCents * minGuests;
    const { data: paymentRow } = await supabaseAdmin.from("v2_payments").insert({
      event_id: body.eventId,
      amount_cents: expectedCents,
      payment_type: "balance",
      status: "sent",
      stripe_payment_link_url: paymentLink.url,
      notes: `${productName} – ab ${minGuests} Gästen, ${(body.pricePerPersonCents / 100).toFixed(2)} €/Person`,
      created_by: userData.user.email ?? null,
    }).select("id").single();

    // Optional: Einladungs-Mail
    if (body.sendEmail !== false && paymentRow?.id) {
      try {
        await supabaseAdmin.functions.invoke("send-payment-confirmation-v2", {
          body: {
            payment_id: paymentRow.id,
            mode: "prepayment_invite",
            prepayment: {
              paymentLinkUrl: paymentLink.url,
              pricePerPersonCents: body.pricePerPersonCents,
              minGuests,
              maxGuests,
            },
          },
        });
      } catch (e) {
        log("send-payment-confirmation-v2 invite failed (non-fatal)", e instanceof Error ? e.message : e);
      }
    }

    // Activity Log
    await supabaseAdmin.from("activity_logs").insert({
      entity_type: "event_inquiry",
      entity_id: body.eventId,
      action: "prepayment_link_created",
      actor_email: userData.user.email,
      metadata: {
        payment_link_id: paymentLink.id,
        payment_link_url: paymentLink.url,
        price_per_person_cents: body.pricePerPersonCents,
        min_guests: minGuests,
        max_guests: maxGuests,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentLinkUrl: paymentLink.url,
        paymentLinkId: paymentLink.id,
        paymentId: paymentRow?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    log("ERROR", { error: e instanceof Error ? e.message : String(e) });
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});