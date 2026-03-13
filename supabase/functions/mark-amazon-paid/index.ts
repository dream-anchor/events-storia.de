import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  
  if (!lexofficeApiKey) {
    return new Response(
      JSON.stringify({ error: 'LEXOFFICE_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const invoiceId = '6d192839-c077-4514-8645-c25d5f2248b9';
    const paymentDate = '2026-03-09T00:00:00.000+01:00';
    const paidAmount = 1017.30;

    console.log(`[MARK-PAID] Marking invoice ${invoiceId} as paid`);
    console.log(`[MARK-PAID] Amount: ${paidAmount}, Date: ${paymentDate}`);

    const response = await fetch(
      `https://api.lexoffice.io/v1/invoices/${invoiceId}/mark-as-paid`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          paymentDate,
          paidAmount
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('[MARK-PAID] Success:', data);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Invoice marked as paid',
          invoiceId,
          data 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorText = await response.text();
      console.error('[MARK-PAID] Failed:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: response.status,
          error: errorText 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[MARK-PAID] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
