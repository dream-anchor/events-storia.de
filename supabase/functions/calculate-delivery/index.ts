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
  deliveryCost: number;
  isFreeDelivery: boolean;
  minimumOrder: number;
  message: string;
  messageEn: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
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

    const distanceKm = distanceMeters / 1000;
    console.log('Distance:', distanceKm, 'km');

    // Step 3: Calculate delivery cost based on distance
    let result: DeliveryCalculation;

    if (distanceKm <= 1) {
      // Free delivery within 1km, minimum order €50
      result = {
        distanceKm: Math.round(distanceKm * 10) / 10,
        deliveryCost: 0,
        isFreeDelivery: true,
        minimumOrder: 50,
        message: 'Kostenlose Lieferung',
        messageEn: 'Free delivery'
      };
    } else if (distanceKm <= 25) {
      // Flat €25 fee for 1-25km in Munich area, minimum order €150
      result = {
        distanceKm: Math.round(distanceKm * 10) / 10,
        deliveryCost: 25,
        isFreeDelivery: false,
        minimumOrder: 150,
        message: 'Lieferung im Münchner Raum',
        messageEn: 'Delivery in Munich area'
      };
    } else {
      // €1.20 per km outside Munich
      const cost = Math.round(distanceKm * 1.20 * 100) / 100;
      result = {
        distanceKm: Math.round(distanceKm * 10) / 10,
        deliveryCost: cost,
        isFreeDelivery: false,
        minimumOrder: 200,
        message: 'Lieferung außerhalb München',
        messageEn: 'Delivery outside Munich'
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
