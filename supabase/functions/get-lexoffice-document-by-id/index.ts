import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface DocumentRequest {
  voucherId: string;
  voucherType: 'invoice' | 'quotation' | 'creditnote';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voucherId, voucherType } = await req.json() as DocumentRequest;

    if (!voucherId || !voucherType) {
      return new Response(
        JSON.stringify({ error: 'Missing voucherId or voucherType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) {
      return new Response(
        JSON.stringify({ error: 'LexOffice API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine endpoint based on document type
    const endpointMap: Record<string, string> = {
      invoice: 'invoices',
      quotation: 'quotations',
      creditnote: 'credit-notes'
    };
    const endpoint = endpointMap[voucherType] || 'invoices';

    // Fetch PDF from LexOffice
    const lexofficeUrl = `https://api.lexoffice.io/v1/${endpoint}/${voucherId}/document`;

    console.log(`Fetching document from: ${lexofficeUrl}`);

    const pdfResponse = await fetch(lexofficeUrl, {
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Accept': 'application/pdf'
      }
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error(`LexOffice API error ${pdfResponse.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: 'Document not available from LexOffice' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PDF as ArrayBuffer and convert to base64
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    // Generate filename
    const typeLabel = voucherType === 'invoice' ? 'Rechnung' :
                      voucherType === 'quotation' ? 'Angebot' : 'Gutschrift';
    const filename = `STORIA_${typeLabel}_${voucherId.slice(0, 8)}.pdf`;

    console.log(`Successfully fetched document, size: ${pdfBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({
        pdf: base64,
        documentType: voucherType,
        filename
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-lexoffice-document-by-id:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
