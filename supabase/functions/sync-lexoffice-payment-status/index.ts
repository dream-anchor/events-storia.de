import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface SyncRequest {
  orderId?: string; // Optional: sync only this order
}

interface SyncResult {
  processed: number;
  updated: number;
  errors: string[];
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LEXOFFICE-SYNC] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');

  if (!lexofficeApiKey) {
    console.warn('LEXOFFICE_API_KEY not configured');
    return new Response(
      JSON.stringify({
        error: 'LexOffice API key not configured',
        processed: 0,
        updated: 0,
        errors: ['API key not configured']
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
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

    // Parse request
    const body: SyncRequest = await req.json().catch(() => ({}));
    const { orderId } = body;

    logStep('Starting payment status sync', { orderId: orderId || 'all' });

    // Use service role for database updates
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Query orders that need syncing
    let query = supabaseAdmin
      .from('catering_orders')
      .select('id, order_number, lexoffice_invoice_id, lexoffice_document_type, payment_status')
      .not('lexoffice_invoice_id', 'is', null)
      .neq('payment_status', 'paid');

    if (orderId) {
      query = query.eq('id', orderId);
    }

    const { data: orders, error: queryError } = await query;

    if (queryError) {
      logStep('Error querying orders', { error: queryError.message });
      return new Response(
        JSON.stringify({
          error: queryError.message,
          processed: 0,
          updated: 0,
          errors: [queryError.message]
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: SyncResult = {
      processed: 0,
      updated: 0,
      errors: []
    };

    if (!orders || orders.length === 0) {
      logStep('No orders to sync');
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep(`Processing ${orders.length} orders`);

    // Process each order
    for (const order of orders) {
      result.processed++;

      try {
        // Determine endpoint based on document type
        const endpoint = order.lexoffice_document_type === 'quotation' ? 'quotations' : 'invoices';
        const lexofficeUrl = `https://api.lexoffice.io/v1/${endpoint}/${order.lexoffice_invoice_id}`;

        // Fetch invoice/quotation status from LexOffice
        const response = await fetch(lexofficeUrl, {
          headers: {
            'Authorization': `Bearer ${lexofficeApiKey}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          logStep(`LexOffice API error for ${order.order_number}`, {
            status: response.status,
            error: errorText.slice(0, 200)
          });
          result.errors.push(`${order.order_number}: LexOffice API error ${response.status}`);
          continue;
        }

        const lexofficeData = await response.json();
        const lexofficeStatus = lexofficeData.voucherStatus;

        logStep(`Order ${order.order_number}: LexOffice status = ${lexofficeStatus}`);

        // Check if status changed to 'paid'
        if (lexofficeStatus === 'paid' && order.payment_status !== 'paid') {
          // Update local payment status
          const { error: updateError } = await supabaseAdmin
            .from('catering_orders')
            .update({ payment_status: 'paid' })
            .eq('id', order.id);

          if (updateError) {
            logStep(`Error updating ${order.order_number}`, { error: updateError.message });
            result.errors.push(`${order.order_number}: Update failed - ${updateError.message}`);
          } else {
            result.updated++;
            logStep(`Updated ${order.order_number} to paid`);

            // Log activity (fire and forget)
            void supabaseAdmin.from('activity_logs').insert({
              entity_type: 'catering_order',
              entity_id: order.id,
              action: 'payment_status_synced',
              metadata: {
                from_status: order.payment_status,
                to_status: 'paid',
                source: 'lexoffice_sync'
              },
              actor_email: user.email
            }); // Ignore activity log errors
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logStep(`Error processing ${order.order_number}`, { error: errorMsg });
        result.errors.push(`${order.order_number}: ${errorMsg}`);
      }
    }

    logStep('Sync completed', result as unknown as Record<string, unknown>);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error in sync-lexoffice-payment-status', { error: errorMessage });
    return new Response(
      JSON.stringify({
        error: errorMessage,
        processed: 0,
        updated: 0,
        errors: [errorMessage]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
