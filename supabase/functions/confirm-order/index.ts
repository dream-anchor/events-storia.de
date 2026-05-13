// Edge Function: confirm-order
// Records a customer's binding order confirmation (without online payment).
// Used when payment will happen on-site, after-event, or via separate transfer.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const TERMS_VERSION = 'AGB-EVENTS-2026-05';

interface Body {
  inquiry_id: string;
  selected_option_id?: string | null;
  customer_name: string;
  agbs_accepted: boolean;
  terms_accepted: boolean;
  payment_acknowledged?: boolean;
}

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad('Method not allowed', 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON');
  }

  if (!body.inquiry_id || typeof body.inquiry_id !== 'string') return bad('inquiry_id required');
  if (!body.customer_name || body.customer_name.trim().length < 2) return bad('Name erforderlich');
  if (!body.agbs_accepted) return bad('AGB-Zustimmung erforderlich');
  if (!body.terms_accepted) return bad('Annahme erforderlich');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Load inquiry from underlying table v2_events (event_inquiries is a view)
  const { data: ev, error: loadErr } = await supabase
    .from('v2_events')
    .select('id, status, offer_phase, current_offer_version, payment_method, payment_timing, order_confirmed_at')
    .eq('id', body.inquiry_id)
    .maybeSingle();

  if (loadErr || !ev) return bad('Angebot nicht gefunden', 404);

  if (ev.order_confirmed_at) {
    return new Response(JSON.stringify({ ok: true, already: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Capture client metadata for evidence
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    null;
  const ua = req.headers.get('user-agent') || null;

  // Derive payment_timing if not yet set, from payment_method
  const pm = ev.payment_method;
  const paymentTiming =
    ev.payment_timing ||
    (pm === 'deposit_online'
      ? 'online_deposit'
      : pm === 'prepayment_online' || pm === 'full_online'
        ? 'online_full'
        : pm === 'invoice_after' || pm === 'invoice_after_event'
          ? 'after_event'
          : pm === 'on_site' || pm === 'pay_on_site'
            ? 'on_site'
            : pm === 'bank_transfer_prepay'
              ? 'transfer_prepay'
              : 'after_event');

  const { error: updErr } = await supabase
    .from('v2_events')
    .update({
      order_confirmed_at: new Date().toISOString(),
      order_confirmed_by_name: body.customer_name.trim().slice(0, 200),
      order_confirmed_ip: ip,
      order_confirmed_user_agent: ua?.slice(0, 500) ?? null,
      order_confirmed_version: ev.current_offer_version ?? 1,
      order_confirmation_terms_version: TERMS_VERSION,
      payment_timing: paymentTiming,
      offer_phase: 'order_confirmed',
    })
    .eq('id', body.inquiry_id);

  if (updErr) return bad(updErr.message, 500);

  // Activity log
  await supabase.from('activity_logs').insert({
    entity_type: 'event_inquiry',
    entity_id: body.inquiry_id,
    action: 'order_confirmed',
    actor_email: null,
    new_value: {
      customer_name: body.customer_name.trim(),
      payment_timing: paymentTiming,
      terms_version: TERMS_VERSION,
      offer_version: ev.current_offer_version ?? 1,
    },
    metadata: { ip, user_agent: ua },
  });

  // Notify operator (best effort)
  try {
    await supabase.functions.invoke('notify-customer-response', {
      body: { inquiryId: body.inquiry_id, kind: 'order_confirmed' },
    });
  } catch {
    // ignore
  }

  return new Response(
    JSON.stringify({ ok: true, payment_timing: paymentTiming, terms_version: TERMS_VERSION }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
