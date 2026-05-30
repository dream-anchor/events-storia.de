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
  /** 'online' (default — Kunde hat im Public Offer geklickt)
   *  oder Offline-Annahme durch Admin: 'phone' | 'email' | 'onsite' */
  via?: 'online' | 'phone' | 'email' | 'onsite';
  /** Nur bei Offline-Annahme: interne Notiz (z.B. "Christina rief um 14:30 an") */
  internal_note?: string | null;
  /** Nur bei Offline-Annahme: falls Kunde am Telefon andere Gästezahl genannt hat */
  guest_count_override?: number | null;
  /** Nur bei Offline-Annahme: falls sich der Gesamtbetrag durch Menü-/Konditionsänderung verschoben hat */
  amount_total_override?: number | null;
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

  const via: 'online' | 'phone' | 'email' | 'onsite' = body.via ?? 'online';
  const isOffline = via !== 'online';

  // AGB/Terms-Zustimmung wird nur im Online-Flow geprüft.
  // Bei Offline-Annahme bestätigt der Admin im Namen des Kunden (telefonisch/persönlich).
  if (!isOffline) {
    if (!body.agbs_accepted) return bad('AGB-Zustimmung erforderlich');
    if (!body.terms_accepted) return bad('Annahme erforderlich');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Bei Offline-Annahme: User aus JWT lesen (Admin/Staff)
  let adminId: string | null = null;
  let adminEmail: string | null = null;
  if (isOffline) {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const { data: userRes } = await supabase.auth.getUser(token);
      adminId = userRes?.user?.id ?? null;
      adminEmail = userRes?.user?.email ?? null;
    }
    if (!adminId) return bad('Authentifizierung erforderlich für Offline-Annahme', 401);
  }

  // Load inquiry from underlying table v2_events (event_inquiries is a view)
  const { data: ev, error: loadErr } = await supabase
    .from('v2_events')
    .select('id, status, offer_phase, current_offer_version, payment_method, payment_timing, order_confirmed_at, guest_count, amount_total')
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
          : pm === 'invoice_before' || pm === 'invoice_before_event'
            ? 'before_event'
            : pm === 'on_site' || pm === 'pay_on_site'
              ? 'on_site'
              : pm === 'bank_transfer_prepay'
                ? 'transfer_prepay'
                : 'after_event');

  // Optional Overrides bei Offline-Annahme (Gäste, Total)
  const guestOverride =
    isOffline &&
    typeof body.guest_count_override === 'number' &&
    body.guest_count_override > 0 &&
    body.guest_count_override !== ev.guest_count
      ? Math.round(body.guest_count_override)
      : null;
  const totalOverride =
    isOffline &&
    typeof body.amount_total_override === 'number' &&
    body.amount_total_override >= 0 &&
    Number(body.amount_total_override) !== Number(ev.amount_total)
      ? Number(body.amount_total_override)
      : null;

  const updatePayload: Record<string, unknown> = {
    order_confirmed_at: new Date().toISOString(),
    order_confirmed_by_name: body.customer_name.trim().slice(0, 200),
    order_confirmed_ip: ip,
    order_confirmed_user_agent: ua?.slice(0, 500) ?? null,
    order_confirmed_version: ev.current_offer_version ?? 1,
    order_confirmation_terms_version: TERMS_VERSION,
    order_confirmed_via: via,
    payment_timing: paymentTiming,
    offer_phase: 'order_confirmed',
  };
  if (isOffline) {
    updatePayload.order_confirmed_admin_id = adminId;
    updatePayload.order_confirmed_admin_email = adminEmail;
    updatePayload.order_confirmed_internal_note = body.internal_note?.trim().slice(0, 2000) || null;
  }
  if (guestOverride !== null) updatePayload.guest_count = guestOverride;
  if (totalOverride !== null) updatePayload.amount_total = totalOverride;

  const { error: updErr } = await supabase
    .from('v2_events')
    .update(updatePayload)
    .eq('id', body.inquiry_id);

  if (updErr) return bad(updErr.message, 500);

  // Bei Offline-Annahme: gewählte Option markieren (sofern angegeben),
  // damit dieselben Trigger laufen wie bei Online-Annahme (is_chosen).
  if (isOffline && body.selected_option_id) {
    await supabase
      .from('v2_offer_options')
      .update({
        is_chosen: true,
        chosen_at: new Date().toISOString(),
        chosen_by_email: adminEmail,
      })
      .eq('id', body.selected_option_id)
      .eq('event_id', body.inquiry_id);
    // Andere Optionen deaktivieren
    await supabase
      .from('v2_offer_options')
      .update({ is_active: false })
      .eq('event_id', body.inquiry_id)
      .neq('id', body.selected_option_id);
  }

  // Activity log
  await supabase.from('activity_logs').insert({
    entity_type: 'event_inquiry',
    entity_id: body.inquiry_id,
    action: 'order_confirmed',
    actor_id: adminId,
    actor_email: adminEmail,
    new_value: {
      customer_name: body.customer_name.trim(),
      via,
      payment_timing: paymentTiming,
      terms_version: TERMS_VERSION,
      offer_version: ev.current_offer_version ?? 1,
      selected_option_id: body.selected_option_id ?? null,
      guest_count_override: guestOverride,
      amount_total_override: totalOverride,
      internal_note: isOffline ? body.internal_note ?? null : null,
    },
    metadata: { ip, user_agent: ua },
  });

  // Notify operator (best effort)
  try {
    await supabase.functions.invoke('notify-customer-response', {
      body: { inquiryId: body.inquiry_id, kind: 'order_confirmed', via },
    });
  } catch {
    // ignore
  }

  return new Response(
    JSON.stringify({ ok: true, payment_timing: paymentTiming, terms_version: TERMS_VERSION, via }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
