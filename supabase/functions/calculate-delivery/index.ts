import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Restaurant location: Karlstr. 47a, Munich
const RESTAURANT_COORDS = {
  lat: 48.1431,
  lng: 11.5606
};

interface DeliveryCalculation {
  distanceKm: number;
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, isPizzaOnly } = await req.json();
    
    if (!address || address.trim().length < 5) {
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

    // Step 1: Geocode the delivery address
    console.log('Geocoding address:', address);
    console.log('isPizzaOnly:', isPizzaOnly);
    const geocodeUrl = `https://api.openrouteservice.org/geocode/search?api_key=${OPENROUTE_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=DE`;
    
    const geocodeResponse = await fetch(geocodeUrl);
    if (!geocodeResponse.ok) {
      console.error('Geocode error:', await geocodeResponse.text());
      return new Response(
        JSON.stringify({ error: 'Could not find address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geocodeData = await geocodeResponse.json();
    console.log('Geocode result:', JSON.stringify(geocodeData.features?.[0]));
    
    if (!geocodeData.features || geocodeData.features.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Address not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [destLng, destLat] = geocodeData.features[0].geometry.coordinates;
    console.log('Destination coords:', destLat, destLng);

    // Step 2: Calculate driving distance using Directions API
    const directionsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const directionsResponse = await fetch(directionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': OPENROUTE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [
          [RESTAURANT_COORDS.lng, RESTAURANT_COORDS.lat],
          [destLng, destLat]
        ]
      })
    });

    if (!directionsResponse.ok) {
      console.error('Directions error:', await directionsResponse.text());
      return new Response(
        JSON.stringify({ error: 'Could not calculate route' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const directionsData = await directionsResponse.json();
    const distanceMeters = directionsData.routes?.[0]?.summary?.distance;
    
    if (!distanceMeters) {
      return new Response(
        JSON.stringify({ error: 'Could not calculate distance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const oneWayDistanceKm = distanceMeters / 1000;
    console.log('One-way distance:', oneWayDistanceKm, 'km');

    // Step 3: Calculate delivery cost based on distance
    let result: DeliveryCalculation;

    // VAT rate for delivery is 19%
    const VAT_RATE = 0.19;
    const NET_COST_PER_KM = 1.20;
    
    if (oneWayDistanceKm <= 1) {
      // Free delivery within 1km, minimum order €50
      result = {
        distanceKm: Math.round(oneWayDistanceKm * 10) / 10,
        deliveryCostNet: 0,
        deliveryCostGross: 0,
        deliveryVat: 0,
        deliveryVatRate: VAT_RATE,
        isFreeDelivery: true,
        minimumOrder: 50,
        message: 'Kostenlose Lieferung',
        messageEn: 'Free delivery',
        isRoundTrip: false,
        oneWayDistanceKm: Math.round(oneWayDistanceKm * 10) / 10
      };
    } else if (oneWayDistanceKm <= 25) {
      // Flat €25 NET fee for 1-25km in Munich area, minimum order €150
      const netCost = 25;
      const grossCost = Math.round(netCost * (1 + VAT_RATE) * 100) / 100;
      const vatAmount = Math.round((grossCost - netCost) * 100) / 100;
      
      result = {
        distanceKm: Math.round(oneWayDistanceKm * 10) / 10,
        deliveryCostNet: netCost,
        deliveryCostGross: grossCost,
        deliveryVat: vatAmount,
        deliveryVatRate: VAT_RATE,
        isFreeDelivery: false,
        minimumOrder: 150,
        message: 'Lieferung im Münchner Raum',
        messageEn: 'Delivery in Munich area',
        isRoundTrip: !isPizzaOnly,
        oneWayDistanceKm: Math.round(oneWayDistanceKm * 10) / 10
      };
    } else {
      // Outside Munich: €1.20 per km NET (+ 19% VAT)
      // Pizza: single trip (one-way), Equipment: round trip (×2)
      const tripMultiplier = isPizzaOnly ? 1 : 2;
      const totalDistanceKm = oneWayDistanceKm * tripMultiplier;
      const netCost = Math.round(totalDistanceKm * NET_COST_PER_KM * 100) / 100;
      const grossCost = Math.round(netCost * (1 + VAT_RATE) * 100) / 100;
      const vatAmount = Math.round((grossCost - netCost) * 100) / 100;
      
      result = {
        distanceKm: Math.round(totalDistanceKm * 10) / 10,
        deliveryCostNet: netCost,
        deliveryCostGross: grossCost,
        deliveryVat: vatAmount,
        deliveryVatRate: VAT_RATE,
        isFreeDelivery: false,
        minimumOrder: 200,
        message: isPizzaOnly 
          ? `Lieferung außerhalb München (${Math.round(oneWayDistanceKm)} km)`
          : `Lieferung außerhalb München (${Math.round(oneWayDistanceKm)} km × 2 Fahrten)`,
        messageEn: isPizzaOnly
          ? `Delivery outside Munich (${Math.round(oneWayDistanceKm)} km)`
          : `Delivery outside Munich (${Math.round(oneWayDistanceKm)} km × 2 trips)`,
        isRoundTrip: !isPizzaOnly,
        oneWayDistanceKm: Math.round(oneWayDistanceKm * 10) / 10
      };
    }

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
