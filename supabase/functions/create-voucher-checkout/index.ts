// Erzeugt eine Stripe-Checkout-Session für den Kauf eines STORIA-Gutscheins.
// Schreibt einen Pending-Eintrag in `vouchers` und gibt die Session-URL zurück.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-VOUCHER-CHECKOUT] ${s}${d ? " " + JSON.stringify(d) : ""}`);

function computeValidUntil(): string {
  // 3 volle Kalenderjahre zum Jahresende (BGB-Standard).
  const now = new Date();
  const year = now.getUTCFullYear() + 3;
  return `${year}-12-31`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const amountCents = Number(body?.amount_cents);
    const purchaserEmail = String(body?.purchaser_email ?? "").trim().toLowerCase();
    const purchaserName = body?.purchaser_name ? String(body.purchaser_name).trim().slice(0, 120) : null;
    const recipientName = body?.recipient_name ? String(body.recipient_name).trim().slice(0, 120) : null;
    const recipientEmail = body?.recipient_email
      ? String(body.recipient_email).trim().toLowerCase().slice(0, 254)
      : null;
    const message = body?.message ? String(body.message).trim().slice(0, 300) : null;
    const language = body?.language === "en" ? "en" : "de";

    // Validierung
    if (!Number.isInteger(amountCents) || amountCents < 1000 || amountCents > 50000) {
      return new Response(JSON.stringify({ error: "Betrag muss zwischen 10 € und 500 € liegen." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail) || purchaserEmail.length > 254) {
      return new Response(JSON.stringify({ error: "Bitte eine gültige E-Mail angeben." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Empfänger-E-Mail ist ungültig." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Origin für Success-/Cancel-URLs
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://events-storia.de";
    const baseUrl = (() => { try { return new URL(origin).origin; } catch { return "https://events-storia.de"; } })();
    const successPath = language === "en" ? "/en/voucher/thanks" : "/gutschein/danke";
    const cancelPath = language === "en" ? "/en/voucher" : "/gutschein";

    // Pending-Record schreiben (ohne Code – Code wird erst beim Webhook erzeugt,
    // um Codes vor erfolgreicher Zahlung nicht zu reservieren).
    // Wir brauchen aber einen UNIQUE-Code-Wert -> nutzen `PENDING-<random>` als Platzhalter
    // bis der Webhook den finalen Code setzt.
    const placeholderCode = `PENDING-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const validUntil = computeValidUntil();

    const { data: pending, error: insertErr } = await supabase
      .from("vouchers")
      .insert({
        code: placeholderCode,
        amount_cents: amountCents,
        currency: "eur",
        purchaser_email: purchaserEmail,
        purchaser_name: purchaserName,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        message,
        status: "pending",
        valid_until: validUntil,
      })
      .select("id")
      .single();

    if (insertErr || !pending) {
      log("Pending insert failed", { insertErr });
      throw new Error("Konnte Gutschein nicht vormerken.");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: purchaserEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: language === "en"
                ? `STORIA Restaurant Voucher (${(amountCents / 100).toFixed(2)} €)`
                : `STORIA Restaurant-Gutschein (${(amountCents / 100).toFixed(2)} €)`,
              description: language === "en"
                ? "Gift voucher redeemable at STORIA Munich"
                : "Geschenkgutschein, einlösbar im STORIA München",
            },
          },
        },
      ],
      success_url: `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}?cancelled=1`,
      locale: language === "en" ? "en" : "de",
      metadata: {
        order_type: "voucher",
        voucher_id: pending.id,
        purchaser_email: purchaserEmail,
        language,
      },
    });

    // Stripe-Session-ID zurückschreiben (für Reconciliation)
    await supabase
      .from("vouchers")
      .update({ stripe_session_id: session.id })
      .eq("id", pending.id);

    return new Response(JSON.stringify({ url: session.url, voucher_id: pending.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});