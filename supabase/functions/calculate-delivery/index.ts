import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { cachedOneWayDistanceKm } from '../_shared/cateringServer.ts';
import { clientIp, rateLimited } from '../_shared/giftRateLimit.ts';
import { readJsonObject } from '../_shared/requestBody.ts';
import { deliveryFeeGrossCents, deliveryFeeNetCents, minimumOrderCents, roundKm, tripCount } from '../_shared/cateringPricing.ts';



// Restaurant location: Karlstr. 47a, Munich
const RESTAURANT_COORDS = {
  lat: 48.1431,
  lng: 11.5606
};

interface DeliveryCalculation {
  /** einfache Strecke in km (Alias von oneWayDistanceKm) */
  distanceKm: number;
  /** Fahrtenzahl: 0 (bis 1 km), 1 (Pizza-only), 2 (Hin- und Rückfahrt) */
  trips: 0 | 1 | 2;
  /** Strecke × Fahrten, nur zur Anzeige ("24 km gesamt") */
  totalDistanceKm: number;
  deliveryCostNet: number;
  deliveryCostGross: number;
  deliveryVat: number;
  deliveryVatRate: number;
  isFreeDelivery: boolean;
  minimumOrder: number;
  message: string;
  messageEn: string;
  isRoundTrip: boolean;
  oneWayDistanceKm: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await readJsonObject(req);
    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // deno-lint-ignore no-explicit-any
    const { address, isPizzaOnly } = body as any;
    
    if (typeof address !== 'string' || address.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENROUTE_API_KEY = Deno.env.get('OPENROUTE_API_KEY');
    if (!OPENROUTE_API_KEY) {
      console.error('OPENROUTE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Entfernung (Cache -> OpenRouteService, Tagesbudget): gemeinsam mit quote-catering-order, siehe _shared/cateringServer.ts
    if (rateLimited(`calc-delivery:${clientIp(req)}`, 18, 60_000)) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const km = await cachedOneWayDistanceKm(supabase, address, OPENROUTE_API_KEY, fetch, { clientKey: clientIp(req) });
    if (km === null) {
      return new Response(
        JSON.stringify({ error: 'Could not calculate distance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const distanceMeters = km * 1000;

    // Entfernung = EINFACHE Strecke, auf 0,01 km gerundet. Gebühr, Mindestbestellwert und Fahrtenzahl kommen aus
    // _shared/cateringPricing.ts (dieselbe Rechnung wie quote-catering-order/create-catering-payment).
    const oneWayDistanceKm = roundKm(distanceMeters / 1000);
    console.log('One-way distance:', oneWayDistanceKm, 'km');

    const pizzaOnly = isPizzaOnly === true;
    const trips = tripCount(oneWayDistanceKm, pizzaOnly);
    const netCents = deliveryFeeNetCents(oneWayDistanceKm, pizzaOnly);
    const grossCents = deliveryFeeGrossCents(oneWayDistanceKm, pizzaOnly);
    const VAT_RATE = 0.19;
    const kmRounded = Math.round(oneWayDistanceKm);

    let message: string;
    let messageEn: string;
    if (trips === 0) {
      message = 'Kostenlose Lieferung';
      messageEn = 'Free delivery';
    } else if (oneWayDistanceKm <= 8) {
      message = pizzaOnly ? 'Lieferung im Münchner Raum (nur Hinfahrt)' : 'Lieferung im Münchner Raum (Hin- und Rückfahrt)';
      messageEn = pizzaOnly ? 'Delivery in Munich area (one-way)' : 'Delivery in Munich area (round trip)';
    } else {
      message = pizzaOnly
        ? `Lieferung (${kmRounded} km, inkl. Anfahrtspauschale)`
        : `Lieferung (${kmRounded} km × 2 Fahrten, inkl. Anfahrtspauschale)`;
      messageEn = pizzaOnly
        ? `Delivery (${kmRounded} km, incl. base fee)`
        : `Delivery (${kmRounded} km × 2 trips, incl. base fee)`;
    }

    const result: DeliveryCalculation = {
      // BREAKING (22.11.2026): distanceKm ist jetzt die einfache Strecke (früher bei > 8 km Strecke × Fahrten).
      // Gespeichert wird calculated_distance_km = einfache Strecke; die Fahrtenzahl steht getrennt in `trips`.
      distanceKm: oneWayDistanceKm,
      oneWayDistanceKm,
      trips,
      totalDistanceKm: roundKm(oneWayDistanceKm * trips),
      deliveryCostNet: netCents / 100,
      deliveryCostGross: grossCents / 100,
      deliveryVat: (grossCents - netCents) / 100,
      deliveryVatRate: VAT_RATE,
      isFreeDelivery: trips === 0,
      minimumOrder: minimumOrderCents(oneWayDistanceKm) / 100,
      message,
      messageEn,
      isRoundTrip: trips === 2,
    };

    console.log('Delivery calculation:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Calculate delivery error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
