import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

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
        .single();

      if (orderError || !order) {
        console.error('Order fetch error:', orderError);
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check ownership (only for non-admin customer access)
      if (order.user_id !== user.id) {
        // Allow admin/staff to bypass ownership check via RLS
        // RLS already restricts the query, so if we got the order the user has access
        console.log(`Access granted via RLS for user ${user.id} on order ${order.id}`);
      }

      if (!order.lexoffice_invoice_id) {
        console.log('No LexOffice document ID for this order');
        return new Response(
          JSON.stringify({ error: 'No document available yet' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      lexofficeDocId = order.lexoffice_invoice_id;
      docType = order.lexoffice_document_type || 'invoice';
      orderNumber = order.order_number;
    }

    // Determine LexOffice API endpoint
    const endpointMap: Record<string, string> = {
      invoice: 'invoices',
      quotation: 'quotations',
      creditnote: 'credit-notes',
    };
    const endpoint = endpointMap[docType] || 'invoices';
    const lexofficeUrl = `https://api.lexoffice.io/v1/${endpoint}/${lexofficeDocId}/document`;

    console.log(`Fetching LexOffice document from: ${lexofficeUrl}`);

    const pdfResponse = await fetch(lexofficeUrl, {
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Accept': 'application/pdf',
      },
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error(`LexOffice API error ${pdfResponse.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: 'Document not available from LexOffice' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      // Order-based filename
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
      // Voucher-based filename
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
