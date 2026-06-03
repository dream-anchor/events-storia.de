import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { syncLexOfficeInvoice } from '../_shared/lexoffice-sync.ts';

// Manual sync trigger. Authenticated admin/staff endpoint.
// Body: { lexoffice_invoice_id: string } OR { v2_payment_id: string }
// Optional: { force_overwrite?: boolean } — apply remote state even if conflict.

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  if (!lexofficeApiKey) {
    return new Response(JSON.stringify({ error: 'LexOffice not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  let invoiceId: string | undefined = body.lexoffice_invoice_id;
  const v2PaymentId: string | undefined = body.v2_payment_id;
  const forceOverwrite: boolean = !!body.force_overwrite;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (!invoiceId && v2PaymentId) {
    const { data: row } = await supabaseAdmin
      .from('v2_payments')
      .select('lexoffice_invoice_id')
      .eq('id', v2PaymentId)
      .maybeSingle();
    invoiceId = row?.lexoffice_invoice_id ?? undefined;
  }

  if (!invoiceId) {
    return new Response(
      JSON.stringify({ error: 'lexoffice_invoice_id or v2_payment_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const outcome = await syncLexOfficeInvoice(
    supabaseAdmin,
    lexofficeApiKey,
    invoiceId,
    'manual.refresh',
  );

  // Force-overwrite path: clear conflict and apply remote totals/status now
  if (forceOverwrite && outcome.conflict && outcome.v2_payment_id) {
    const update: Record<string, unknown> = {
      lexoffice_sync_conflict: false,
      lexoffice_conflict_details: null,
    };
    if (outcome.remote_status === 'paid') {
      update.status = 'paid';
      update.paid_at = new Date().toISOString();
      update.paid_via = 'lexoffice';
    } else if (outcome.remote_status === 'cancelled') {
      update.status = 'cancelled';
    }
    if (outcome.remote_total_cents && outcome.remote_total_cents > 0) {
      update.amount_cents = outcome.remote_total_cents;
    }
    await supabaseAdmin.from('v2_payments').update(update).eq('id', outcome.v2_payment_id);
    outcome.applied = true;
    outcome.conflict = false;
  }

  return new Response(JSON.stringify({ ok: true, outcome }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});