import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { eventId, event, items, notes } = await req.json();
    
    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) {
      throw new Error('LEXOFFICE_API_KEY not configured');
    }

    // Build LexOffice quotation payload
    const quotationPayload = {
      voucherDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      address: {
        name: event.company_name || event.contact_name,
        supplement: event.company_name ? event.contact_name : undefined,
        street: '',
        zip: '',
        city: '',
        countryCode: 'DE',
      },
      lineItems: items.map((item: any) => ({
        type: 'custom',
        name: item.name,
        description: item.description || '',
        quantity: item.quantity,
        unitName: 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount: Math.round(item.unitPrice.netAmount * 100) / 100,
          taxRatePercentage: item.unitPrice.taxRatePercentage || 7,
        },
      })),
      totalPrice: {
        currency: 'EUR',
      },
      taxConditions: {
        taxType: 'net',
      },
      introduction: `Event-Angebot für ${event.preferred_date || 'nach Vereinbarung'}\nGäste: ${event.guest_count || '-'}\nArt: ${event.event_type || '-'}`,
      remark: notes || '',
    };

    console.log('Creating LexOffice quotation:', JSON.stringify(quotationPayload, null, 2));

    // Create quotation in LexOffice
    const response = await fetch('https://api.lexoffice.io/v1/quotations?finalize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(quotationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LexOffice error:', errorText);
      throw new Error(`LexOffice API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('LexOffice quotation created:', result);

    return new Response(
      JSON.stringify({ success: true, quotationId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
