// Voraussichtlicher Lieferpreis für Geschenkkörbe (Taxitarif, einfache Strecke ab Karlstraße 47a).
// Nur Anzeige: die verbindliche Gebühr rechnet create-gift-order bei der Bestellung NEU.
// calculate-delivery (Catering) bleibt unverändert.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { computeDeliveryFeeCents } from "../_shared/giftPricing.ts";
import { resolveDistanceKm, RoutingError } from "../_shared/giftRouting.ts";
import { clientIp, rateLimited } from "../_shared/giftRateLimit.ts";
import { loadGiftSettings } from "../_shared/giftSettings.ts";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // Kostenschutz ORS: 20 Anfragen je Minute und IP
    if (rateLimited(`quote:${clientIp(req)}`, 20, 60_000)) return json({ error: "rate_limited" }, 429);

    const body = await req.json().catch(() => ({}));
    const street = clean(body?.street, 120);
    const zip = clean(body?.zip, 10);
    const city = clean(body?.city, 80);
    if (street.length < 3 || !/\d/.test(street) || !/^\d{5}$/.test(zip) || city.length < 2) {
      return json({ error: "invalid_address" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const settings = await loadGiftSettings(supabase);

    const km = await resolveDistanceKm({ street, zip, city }, settings.origin, Deno.env.get("OPENROUTE_API_KEY"));
    const feeCents = computeDeliveryFeeCents(km, settings.tariff);

    return json({
      estimated: true, // voraussichtlich; endgültig bei der Bestellung
      distance_km: Math.round(km * 10) / 10,
      estimated_fee_cents: feeCents,
      vat_rate: settings.delivery_vat_rate,
    });
  } catch (e) {
    if (e instanceof RoutingError) {
      // address_not_found/too_far = Eingabe unbrauchbar (400); sonst Dienst nicht verfügbar: NIE einen geschätzten Preis liefern
      const status = e.code === "address_not_found" || e.code === "too_far" ? 400 : 503;
      return json({ error: e.code }, status);
    }
    console.error("[GIFT-DELIVERY-QUOTE]", e instanceof Error ? e.message : e);
    return json({ error: "internal_error" }, 500);
  }
});
