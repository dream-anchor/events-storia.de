import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch mit Retry bei Status 500 oder 429 (Rate-Limit, mit Retry-After) */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, options);

    const isRetryable = response.status === 500 || response.status === 429;
    if (!isRetryable || attempt === MAX_RETRIES) {
      if (isRetryable) {
        console.error(`[${label}] Alle ${MAX_RETRIES} Versuche fehlgeschlagen (${response.status})`);
      }
      return response;
    }

    const retryAfterHeader = response.headers.get('Retry-After');
    const delay = retryAfterHeader
      ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 10_000)
      : RETRY_DELAY_MS * attempt;
    console.warn(`[${label}] Status ${response.status}, Versuch ${attempt}/${MAX_RETRIES} — warte ${delay}ms...`);
    await sleep(delay);
  }

  throw new Error(`[${label}] Retry-Logik unerwartet beendet`);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { orderId, voucherId, voucherType } = body;

    if (!orderId && !voucherId) {
      console.error('Missing orderId or voucherId parameter');
      return new Response(
        JSON.stringify({ error: 'Missing orderId or voucherId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
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
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) {
      console.error('LEXOFFICE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve the LexOffice document ID and type
    let lexofficeDocId: string;
    let docType: string;
    let orderNumber: string | null = null;

    if (voucherId) {
      // --- Mode 1: Direct voucher ID ---
      lexofficeDocId = voucherId;
      docType = voucherType || 'invoice';
      console.log(`Direct voucher mode: ${docType} ${voucherId}, user ${user.id}`);
    } else {
      // --- Mode 2: Order ID → look up from DB ---
      console.log(`Order mode: fetching order ${orderId}, user ${user.id}`);

      const { data: order, error: orderError } = await supabase
        .from('catering_orders')
        .select('id, order_number, lexoffice_invoice_id, lexoffice_document_type, user_id')
        .eq('id', orderId)
        .maybeSingle();

      let resolvedDocId: string | null = order?.lexoffice_invoice_id ?? null;
      let resolvedDocType: string | null = order?.lexoffice_document_type ?? null;
      let resolvedOrderNumber: string | null = order?.order_number ?? null;

      // Fallback: v2_events ist die Maestro-Source-of-Truth.
      // Priorität: final_lexoffice_invoice_id (Schlussrechnung)
      //          > invoice_lexoffice_id (Anzahlungs-/Standardrechnung)
      //          > lexoffice_quotation_id (Angebot)
      if (!resolvedDocId) {
        const { data: ev, error: evError } = await supabase
          .from('v2_events')
          .select('booking_number, final_lexoffice_invoice_id, invoice_lexoffice_id, lexoffice_quotation_id, lexoffice_document_type')
          .eq('id', orderId)
          .maybeSingle();

        if (evError) {
          console.error('v2_events fetch error:', evError);
        }

        // Wenn der Caller explizit eine Rechnung angefragt hat, NIEMALS
        // auf das Angebot zurückfallen — sonst zeigt der Rechnungs-Dialog
        // nach Storno weiterhin das alte Angebot als "Rechnung" an.
        const wantsInvoice = (voucherType ?? '').toLowerCase() === 'invoice';
        if (ev?.final_lexoffice_invoice_id) {
          resolvedDocId = ev.final_lexoffice_invoice_id;
          resolvedDocType = 'invoice';
        } else if (ev?.invoice_lexoffice_id) {
          resolvedDocId = ev.invoice_lexoffice_id;
          resolvedDocType = ev.lexoffice_document_type ?? 'invoice';
        } else if (!wantsInvoice && ev?.lexoffice_quotation_id) {
          resolvedDocId = ev.lexoffice_quotation_id;
          resolvedDocType = 'quotation';
        }
        resolvedOrderNumber = resolvedOrderNumber ?? ev?.booking_number ?? null;
      }

      if (!resolvedDocId) {
        console.log('No LexOffice document ID for order/inquiry', orderId);
        return new Response(
          JSON.stringify({ error: 'No document available yet' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      lexofficeDocId = resolvedDocId;
      docType = resolvedDocType || voucherType || 'invoice';
      orderNumber = resolvedOrderNumber;
    }

    // Determine LexOffice API endpoint
    const endpointMap: Record<string, string> = {
      invoice: 'invoices',
      quotation: 'quotations',
      creditnote: 'credit-notes',
    };
    const endpoint = endpointMap[docType] || 'invoices';

    // ── 2-Step-Flow: document → documentFileId → files/{id} ──

    const renderUrl = `https://api.lexoffice.io/v1/${endpoint}/${lexofficeDocId}/document`;
    console.log(`Step 1: Rendering document from: ${renderUrl}`);

    // Step 1: Trigger document rendering → get documentFileId
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

    // Step 2: Download PDF binary via /files/{documentFileId}
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

    // Convert PDF to base64
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    // Generate filename
    let filename: string;
    if (orderNumber) {
      let docTypeLabel: string;
      if (orderNumber.startsWith('EVT-BUCHUNG')) {
        docTypeLabel = 'Bestellbestaetigung';
      } else if (docType === 'invoice' || orderNumber.includes('-BESTELLUNG') || orderNumber.includes('-RECHNUNG')) {
        docTypeLabel = 'Rechnung';
      } else {
        docTypeLabel = 'Dokument';
      }
      filename = `STORIA_${docTypeLabel}_${orderNumber}.pdf`;
    } else {
      const typeLabel = docType === 'invoice' ? 'Rechnung'
        : docType === 'quotation' ? 'Angebot'
        : docType === 'creditnote' ? 'Gutschrift'
        : 'Dokument';
      filename = `STORIA_${typeLabel}_${lexofficeDocId.slice(0, 8)}.pdf`;
    }

    console.log(`Successfully fetched document, size: ${pdfBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ pdf: base64, documentType: docType, filename }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-lexoffice-document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
