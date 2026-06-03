import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { syncLexOfficeInvoice } from '../_shared/lexoffice-sync.ts';

// LexOffice Event-Subscription webhook receiver.
// Public endpoint (verify_jwt = false). Validates the LexOffice shared secret
// passed in the `x-lxo-signature` header or `?secret=` query param.
//
// LexOffice payload shape (Event-Subscription v1):
// { "organizationId": "...", "eventType": "invoice.changed",
//   "resourceId": "<invoice uuid>", "eventDate": "ISO-timestamp" }

interface LexOfficeEvent {
  organizationId?: string;
  eventType?: string;
  resourceId?: string;
  eventDate?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expectedSecret = Deno.env.get('LEXOFFICE_WEBHOOK_SECRET');
  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  if (!expectedSecret || !lexofficeApiKey) {
    console.error('[lexoffice-webhook] missing LEXOFFICE_WEBHOOK_SECRET or LEXOFFICE_API_KEY');
    return new Response(JSON.stringify({ error: 'not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Signature validation: accept either header or query param
  const url = new URL(req.url);
  const signature =
    req.headers.get('x-lxo-signature') ||
    req.headers.get('x-webhook-secret') ||
    url.searchParams.get('secret') ||
    '';
  if (signature !== expectedSecret) {
    console.warn('[lexoffice-webhook] invalid signature');
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: LexOfficeEvent;
  try {
    event = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventType = event.eventType ?? 'unknown';
  const invoiceId = event.resourceId;

  console.log('[lexoffice-webhook] received', { eventType, invoiceId });

  if (!invoiceId) {
    return new Response(JSON.stringify({ ok: true, ignored: 'missing resourceId' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only react to invoice-related events
  const isInvoiceEvent = eventType.startsWith('invoice.') || eventType.startsWith('payment.');
  if (!isInvoiceEvent) {
    return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const outcome = await syncLexOfficeInvoice(supabaseAdmin, lexofficeApiKey, invoiceId, eventType);

  return new Response(JSON.stringify({ ok: true, outcome }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});