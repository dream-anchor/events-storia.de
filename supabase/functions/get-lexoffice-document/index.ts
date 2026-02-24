import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    
    if (!orderId) {
      console.error('Missing orderId parameter');
      return new Response(
        JSON.stringify({ error: 'Missing orderId parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this order
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

    console.log(`Fetching document for order ${orderId}, user ${user.id}`);
    
    // Fetch order and verify ownership
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

    // Check ownership
    if (order.user_id !== user.id) {
      console.error(`User ${user.id} attempted to access order owned by ${order.user_id}`);
      return new Response(
        JSON.stringify({ error: 'Access denied' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!order.lexoffice_invoice_id) {
      console.log('No LexOffice document ID for this order');
      return new Response(
        JSON.stringify({ error: 'No document available yet' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch PDF from LexOffice
    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) {
      console.error('LEXOFFICE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine endpoint based on document type
    const endpoint = order.lexoffice_document_type === 'invoice' ? 'invoices' : 'quotations';
    const lexofficeUrl = `https://api.lexoffice.io/v1/${endpoint}/${order.lexoffice_invoice_id}/document`;
    
    console.log(`Fetching LexOffice document from: ${lexofficeUrl}`);
    
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
    
    // Generate filename based on order type
    // Shop orders are always Stripe-paid, so they're always invoices/confirmations
    let docTypeLabel: string;
    if (order.order_number.startsWith('EVT-BUCHUNG')) {
      docTypeLabel = 'Bestellbestaetigung';
    } else if (order.lexoffice_document_type === 'invoice' || 
               order.order_number.includes('-BESTELLUNG') ||
               order.order_number.includes('-RECHNUNG')) {
      docTypeLabel = 'Rechnung';
    } else {
      // Fallback for legacy orders
      docTypeLabel = 'Dokument';
    }
    const filename = `STORIA_${docTypeLabel}_${order.order_number}.pdf`;
    
    console.log(`Successfully fetched document, size: ${pdfBuffer.byteLength} bytes`);
    
    return new Response(
      JSON.stringify({ 
        pdf: base64,
        documentType: order.lexoffice_document_type,
        filename: filename
      }), 
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
