import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  const invoiceId = '6d192839-c077-4514-8645-c25d5f2248b9';
  const paymentDate = '2026-03-09T00:00:00.000+01:00';
  const paidAmount = 1017.30;

  try {
    // Try both domains
    const results: Record<string, any> = {};

    // Test 1: Old domain api.lexoffice.io
    console.log('[TEST] POST api.lexoffice.io mark-as-paid');
    const res1 = await fetch(
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
    results.lexoffice_io = { status: res1.status, body: await res1.text() };
    console.log('[TEST] lexoffice.io:', results.lexoffice_io.status, results.lexoffice_io.body);

    // Test 2: New domain api.lexware.io
    console.log('[TEST] POST api.lexware.io mark-as-paid');
    const res2 = await fetch(
      `https://api.lexware.io/v1/invoices/${invoiceId}/mark-as-paid`,
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
    results.lexware_io = { status: res2.status, body: await res2.text() };
    console.log('[TEST] lexware.io:', results.lexware_io.status, results.lexware_io.body);

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
