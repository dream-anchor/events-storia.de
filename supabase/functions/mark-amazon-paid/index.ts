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
  const body = JSON.stringify({
    paymentDate: '2026-03-09T00:00:00.000+01:00',
    paidAmount: 1017.30
  });
  const headers = {
    'Authorization': `Bearer ${lexofficeApiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const results: Record<string, any> = {};

  // Try various path patterns
  const paths = [
    `https://api.lexoffice.io/v1/invoices/${invoiceId}/mark-as-paid`,
    `https://api.lexoffice.io/v1/invoices/${invoiceId}/payments`,
    `https://api.lexoffice.io/v1/payments/${invoiceId}`,
  ];

  for (const url of paths) {
    console.log(`[TEST] POST ${url}`);
    const res = await fetch(url, { method: 'POST', headers, body });
    const txt = await res.text();
    results[url.split('/v1/')[1]] = { status: res.status, body: txt || '(empty)' };
    console.log(`[TEST] ${res.status}: ${txt}`);
  }

  // Also check: GET payments info for this invoice
  const payUrl = `https://api.lexoffice.io/v1/payments/${invoiceId}`;
  console.log(`[TEST] GET ${payUrl}`);
  const payRes = await fetch(payUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${lexofficeApiKey}`, 'Accept': 'application/json' } });
  const payTxt = await payRes.text();
  results['GET_payments'] = { status: payRes.status, body: payTxt };
  console.log(`[TEST] GET payments: ${payRes.status}: ${payTxt}`);

  return new Response(
    JSON.stringify(results, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
