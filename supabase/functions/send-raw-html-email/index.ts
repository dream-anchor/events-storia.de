import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { RIGSHOSPITALET_HTML } from './preset-rigshospitalet.ts';
import { CYIM_ANZAHLUNG_HTML } from './preset-cyim.ts';

const PRESETS: Record<string, { to: string; bcc?: string; subject: string; html: string; entityId?: string }> = {
  'rigshospitalet-restzahlung-v3': {
    to: 'christina.byrne.windfeld@regionh.dk',
    bcc: 'info@events-storia.de',
    subject: 'Restzahlung Ihrer Veranstaltung am 28.08.2026 — STORIA Events',
    html: RIGSHOSPITALET_HTML,
    entityId: '316a0f27-8911-464f-97ea-c5135328f3d5',
  },
  'cyim-anzahlung-bestaetigung': {
    to: 'j.lagourres@cyim.com',
    bcc: 'info@events-storia.de',
    subject: 'Anzahlung erhalten – Ihre Veranstaltung am 29.08.2026 / Payment received — STORIA Events',
    html: CYIM_ANZAHLUNG_HTML,
    entityId: '90321866-239d-4331-a85b-fddf5280ce97',
  },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated admin user
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );
    const { data: role } = await admin
      .from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let { to, bcc, subject, html } = body;
    const { preset, from = 'STORIA Events <info@events-storia.de>', replyTo = 'info@events-storia.de' } = body;
    let entityId: string | undefined = body.event_id || body.inquiry_id || body.entity_id;
    if (preset && PRESETS[preset]) {
      const p = PRESETS[preset];
      to = p.to; bcc = p.bcc; subject = p.subject; html = p.html;
      if (!entityId && p.entityId) entityId = p.entityId;
    }
    if (!to || !subject || !html) throw new Error('to, subject, html required');

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY missing');

    const payload: Record<string, unknown> = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: replyTo,
    };
    if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(data)}`);

    // Auto-resolve entityId via recipient email if not provided
    if (!entityId) {
      const recipient = Array.isArray(to) ? to[0] : to;
      const { data: cust } = await admin
        .from('v2_customers')
        .select('id')
        .eq('email', recipient)
        .maybeSingle();
      if (cust?.id) {
        const { data: ev } = await admin
          .from('v2_events')
          .select('id')
          .eq('customer_id', cust.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ev?.id) entityId = ev.id;
      }
    }

    // Log to email_delivery_logs so the email appears in Maestro's activity timeline
    if (entityId) {
      try {
        await admin.from('email_delivery_logs').insert({
          entity_type: 'event_inquiry',
          entity_id: entityId,
          recipient_email: Array.isArray(to) ? to[0] : to,
          subject,
          provider: 'resend',
          provider_message_id: data.id ?? null,
          status: 'sent',
          sent_by: userData.user.email ?? null,
          sent_at: new Date().toISOString(),
          metadata: {
            bcc: bcc ?? null,
            preset: preset ?? null,
            type: 'manual_raw_html',
          },
        });
      } catch (logErr) {
        console.error('Failed to log email_delivery_logs entry:', logErr);
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});