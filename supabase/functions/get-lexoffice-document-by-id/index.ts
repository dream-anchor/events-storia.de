import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, options: RequestInit, label: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, options);
    const retryable = response.status === 500 || response.status === 429;
    if (!retryable || attempt === MAX_RETRIES) {
      if (retryable) console.error(`[${label}] All ${MAX_RETRIES} attempts failed (${response.status})`);
      return response;
    }
    const ra = response.headers.get('Retry-After');
    const delay = ra ? Math.min(parseInt(ra, 10) * 1000, 10_000) : RETRY_DELAY_MS * attempt;
    console.warn(`[${label}] Status ${response.status}, attempt ${attempt}/${MAX_RETRIES} — waiting ${delay}ms`);
    await sleep(delay);
  }
  throw new Error(`[${label}] retry loop exited unexpectedly`);
}

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

    // ── 2-Step-Flow: /document (JSON) → documentFileId → /files/{id} (PDF) ──
    const renderUrl = `https://api.lexoffice.io/v1/${endpoint}/${voucherId}/document`;
    console.log(`Step 1: Rendering document from: ${renderUrl}`);

    const docResponse = await fetchWithRetry(
      renderUrl,
      {
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Accept': 'application/json',
        },
      },
      `LexOffice /${endpoint}/document`
    );

    if (!docResponse.ok) {
      const errorText = await docResponse.text();
      console.error(`LexOffice /document error ${docResponse.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: 'Document not available from LexOffice' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const docData = await docResponse.json();
    const documentFileId = docData?.documentFileId;
    if (!documentFileId) {
      console.error('No documentFileId received:', JSON.stringify(docData));
      return new Response(
        JSON.stringify({ error: 'No documentFileId from LexOffice' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Step 2: Downloading PDF via /files/${documentFileId}`);
    const pdfResponse = await fetchWithRetry(
      `https://api.lexoffice.io/v1/files/${documentFileId}`,
      {
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Accept': 'application/pdf',
        },
      },
      'LexOffice /files'
    );

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error(`LexOffice /files error ${pdfResponse.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: 'PDF could not be downloaded from LexOffice' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
