import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const webhookSecret = Deno.env.get("MAESTRO_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!webhookSecret || providedSecret !== webhookSecret) {
    return new Response(JSON.stringify({ error: "Invalid or missing x-webhook-secret" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();

    // Resend Inbound liefert: { from, to, subject, text, html, headers, attachments }
    const { from, to, subject, text, html, headers } = body;

    let inquiryId: string | null = null;

    // Methode 1: reply+{uuid}@... Adresse parsen
    const toAddr = Array.isArray(to) ? to[0] : to;
    const replyMatch = (typeof toAddr === 'string' ? toAddr : (toAddr?.address || '')).match(/reply\+([a-f0-9-]+)@/);
    if (replyMatch) {
      inquiryId = replyMatch[1];
    }

    // Methode 2: In-Reply-To Header → vorherige Nachricht in email_messages suchen
    if (!inquiryId && headers) {
      const inReplyTo = headers['in-reply-to'] || headers['In-Reply-To'];
      if (inReplyTo) {
        const cleanId = inReplyTo.replace(/[<>]/g, '');
        const { data: prevMsg } = await supabase
          .from('email_messages')
          .select('inquiry_id')
          .eq('resend_message_id', cleanId)
          .limit(1)
          .maybeSingle();
        if (prevMsg) inquiryId = (prevMsg as { inquiry_id: string }).inquiry_id;
      }
    }

    // Methode 3: Absender-E-Mail in event_inquiries matchen
    if (!inquiryId) {
      const fromEmail = typeof from === 'string' ? from : (from?.address || from);
      if (fromEmail) {
        const emailMatch = fromEmail.match(/([^<\s]+@[^>\s]+)/);
        const cleanFromEmail = emailMatch ? emailMatch[1] : fromEmail;
        const { data: inq } = await supabase
          .from('event_inquiries')
          .select('id')
          .eq('email', cleanFromEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (inq) inquiryId = (inq as { id: string }).id;
      }
    }

    if (!inquiryId) {
      console.warn('Could not match inbound email to inquiry:', { from, to, subject });
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fromEmail = typeof from === 'string' ? from : (from?.address || String(from));

    // In email_messages speichern
    await supabase.from('email_messages').insert({
      inquiry_id: inquiryId,
      direction: 'inbound',
      from_email: fromEmail,
      to_email: 'info@events-storia.de',
      subject: subject || '(Kein Betreff)',
      body_text: text || '',
      body_html: html || '',
      attachments: body.attachments || [],
      resend_status: 'delivered',
    } as Record<string, unknown>);

    // Activity Log
    await supabase.from('activity_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiryId,
      action: 'customer_replied',
      actor_email: fromEmail,
      metadata: {
        subject: subject || '',
        preview: (text || '').slice(0, 200),
      },
    });

    // Betreiber per E-Mail benachrichtigen
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY) {
      const { data: inquiry } = await supabase
        .from('event_inquiries')
        .select('contact_name')
        .eq('id', inquiryId)
        .single();

      const contactName = (inquiry as { contact_name?: string } | null)?.contact_name || fromEmail;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'STORIA System <info@events-storia.de>',
          to: ['info@events-storia.de'],
          subject: `Neue Antwort von ${contactName}`,
          html: `<p>Neue Antwort auf Anfrage von <strong>${contactName}</strong>:</p>
                 <p><a href="https://events-storia.de/admin/events/${inquiryId}/edit">Im Maestro öffnen</a></p>
                 <hr/>
                 <p style="white-space:pre-wrap;">${(text || '').slice(0, 500)}</p>`,
        }),
      }).catch(e => console.error('Owner notification error:', e));
    }

    return new Response(JSON.stringify({ received: true, matched: true, inquiryId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Inbound email error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
