import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Öffentlich zugängliche Edge-Function zum Download des LexOffice-Angebots-PDF.
 * Kein Auth erforderlich — nur per Inquiry-ID (UUID) aufrufbar.
 *
 * Flow: quotations/{id}/document → documentFileId → files/{documentFileId}
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch mit Retry bei Status 500 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 500 || attempt === MAX_RETRIES) {
      if (response.status === 500) {
        console.error(`[${label}] Alle ${MAX_RETRIES} Versuche fehlgeschlagen (500)`);
      }
      return response;
    }

    console.warn(`[${label}] Status 500, Versuch ${attempt}/${MAX_RETRIES} — warte ${RETRY_DELAY_MS}ms...`);
    await sleep(RETRY_DELAY_MS);
  }

  // Unreachable, aber TypeScript braucht es
  throw new Error(`[${label}] Retry-Logik unerwartet beendet`);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inquiryId } = await req.json();

    if (!inquiryId) {
      return new Response(
        JSON.stringify({ error: 'inquiryId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Inquiry-Daten holen: lexoffice_invoice_id + contact_name
    const { data: inquiry, error: dbError } = await supabase
      .from('event_inquiries')
      .select('lexoffice_invoice_id, contact_name')
      .eq('id', inquiryId)
      .single();

    if (dbError || !inquiry) {
      return new Response(
        JSON.stringify({ error: 'Inquiry not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lexofficeId = (inquiry as Record<string, unknown>).lexoffice_invoice_id as string | null;
    if (!lexofficeId) {
      return new Response(
        JSON.stringify({ error: 'No LexOffice document linked to this inquiry' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) {
      return new Response(
        JSON.stringify({ error: 'LexOffice API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeaders = {
      'Authorization': `Bearer ${lexofficeApiKey}`,
      'Accept': 'application/json',
    };

    // Schritt 1: Document-Rendering anstoßen → documentFileId erhalten
    const docResponse = await fetchWithRetry(
      `https://api.lexoffice.io/v1/quotations/${lexofficeId}/document`,
      { headers: authHeaders },
      'LexOffice /document'
    );

    if (!docResponse.ok) {
      const errText = await docResponse.text();
      console.error(`LexOffice /document Fehler ${docResponse.status}:`, errText);
      return new Response(
        JSON.stringify({ error: 'Dokument konnte nicht gerendert werden', status: docResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const docData = await docResponse.json();
    const documentFileId = docData?.documentFileId;

    if (!documentFileId) {
      console.error('LexOffice /document: Keine documentFileId erhalten:', JSON.stringify(docData));
      return new Response(
        JSON.stringify({ error: 'Keine documentFileId von LexOffice erhalten' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`LexOffice documentFileId: ${documentFileId} für Quotation ${lexofficeId}`);

    // Schritt 2: PDF über /files/{documentFileId} herunterladen
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
      const errText = await pdfResponse.text();
      console.error(`LexOffice /files Fehler ${pdfResponse.status}:`, errText);
      return new Response(
        JSON.stringify({ error: 'PDF konnte nicht heruntergeladen werden', status: pdfResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PDF als Base64 zurückgeben
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    const contactName = (inquiry as Record<string, unknown>).contact_name as string || 'Angebot';
    const filename = `STORIA_Angebot_${contactName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_')}.pdf`;

    console.log(`Public PDF download: ${pdfBuffer.byteLength} bytes für Inquiry ${inquiryId}`);

    return new Response(
      JSON.stringify({ pdf: base64, filename }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in download-public-offer-pdf:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
