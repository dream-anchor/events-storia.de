import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Öffentlich zugängliche Edge-Function zum Download des LexOffice-Angebots-PDF.
 * Kein Auth erforderlich — nur per Inquiry-ID (UUID) aufrufbar.
 */

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

    // PDF von LexOffice holen (Angebot = quotations)
    const pdfResponse = await fetch(
      `https://api.lexoffice.io/v1/quotations/${lexofficeId}/document`,
      {
        headers: {
          'Authorization': `Bearer ${lexofficeApiKey}`,
          'Accept': 'application/pdf',
        },
      }
    );

    if (!pdfResponse.ok) {
      console.error(`LexOffice PDF error ${pdfResponse.status}:`, await pdfResponse.text());
      return new Response(
        JSON.stringify({ error: 'PDF not available from LexOffice' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log(`Public PDF download: ${pdfBuffer.byteLength} bytes for inquiry ${inquiryId}`);

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
