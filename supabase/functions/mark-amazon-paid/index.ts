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
    const paymentDate = '2026-03-09T00:00:00.000+01:00';
    const paidAmount = 1017.30;

    console.log(`[MARK-PAID] POST /v1/invoices/${invoiceId}/mark-as-paid`);
    console.log(`[MARK-PAID] Body:`, JSON.stringify({ paymentDate, paidAmount }));

    const res = await fetch(
      `https://api.lexoffice.io/v1/invoices/${invoiceId}/mark-as-paid`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ paymentDate, paidAmount })
      }
    );

    const status = res.status;
    const body = await res.text();
    console.log(`[MARK-PAID] Status: ${status}`);
    console.log(`[MARK-PAID] Body: ${body}`);

    return new Response(
      JSON.stringify({ status, body: body ? JSON.parse(body) : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
