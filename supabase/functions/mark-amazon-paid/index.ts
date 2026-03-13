import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  
  try {
    const invoiceId = '6d192839-c077-4514-8645-c25d5f2248b9';

    // Step 1: GET the invoice
    console.log(`[DEBUG] GET /v1/invoices/${invoiceId}`);
    const getRes = await fetch(
      `https://api.lexoffice.io/v1/invoices/${invoiceId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    const getStatus = getRes.status;
    const getBody = await getRes.text();
    console.log(`[DEBUG] GET status: ${getStatus}`);
    console.log(`[DEBUG] GET body: ${getBody}`);

    // Step 2: Also try quotations endpoint
    console.log(`[DEBUG] GET /v1/quotations/${invoiceId}`);
    const quotRes = await fetch(
      `https://api.lexoffice.io/v1/quotations/${invoiceId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    const quotStatus = quotRes.status;
    const quotBody = await quotRes.text();
    console.log(`[DEBUG] Quotation status: ${quotStatus}`);
    console.log(`[DEBUG] Quotation body: ${quotBody}`);

    return new Response(
      JSON.stringify({ 
        invoice: { status: getStatus, body: JSON.parse(getBody).id ? 'found' : getBody },
        quotation: { status: quotStatus, body: JSON.parse(quotBody).id ? 'found' : quotBody },
        rawInvoice: JSON.parse(getBody),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
