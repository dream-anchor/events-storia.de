import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractEmail(from: unknown): string {
  if (!from) return "";
  if (typeof from === "object" && from !== null && "address" in (from as Record<string, unknown>)) {
    return String((from as { address?: string }).address || "").trim().toLowerCase();
  }
  const s = String(from);
  const m = s.match(/([^<\s]+@[^>\s]+)/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function extractName(from: unknown, email: string): string {
  if (typeof from === "object" && from !== null && "name" in (from as Record<string, unknown>)) {
    const n = String((from as { name?: string }).name || "").trim();
    if (n) return n;
  }
  const s = String(from ?? "");
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m && m[1].trim()) return m[1].trim();
  return email.split("@")[0] || email;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ received: true, error: "invalid body" }, 200);
    }

    const { from, subject, text, html } = body as Record<string, unknown>;

    const senderEmail = extractEmail(from);
    if (!senderEmail) {
      console.warn("inbound-maestro-email: keine Absenderadresse", { subject });
      return json({ received: true, matched: false, reason: "no sender" }, 200);
    }
    const senderName = extractName(from, senderEmail);
    const subjectStr = (typeof subject === "string" && subject.trim()) || "(ohne Betreff)";
    const bodyText = typeof text === "string" && text.trim()
      ? text
      : (typeof html === "string" ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

    let customerId: string;
    const { data: existing } = await supabase
      .from("v2_customers")
      .select("id")
      .ilike("email", senderEmail)
      .is("merged_into_id", null)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      customerId = existing.id as string;
    } else {
      const { data: newCust, error: cErr } = await supabase
        .from("v2_customers")
        .insert({ email: senderEmail, name: senderName })
        .select("id")
        .single();
      if (cErr || !newCust) {
        console.error("inbound-maestro-email: Kunde anlegen fehlgeschlagen", cErr);
        return json({ received: true, error: `customer: ${cErr?.message}` }, 200);
      }
      customerId = newCust.id as string;
    }

    const customerNotes = `Weitergeleitete Anfrage an maestro@paterbrown.com\n` +
      `Von: ${senderName} <${senderEmail}>\n` +
      `Betreff: ${subjectStr}\n\n` +
      `${bodyText}`;

    const { data: newEvent, error: evErr } = await supabase
      .from("v2_events")
      .insert({
        customer_id: customerId,
        status: "inquiry",
        source: "email_forward",
        occasion: subjectStr,
        customer_notes: customerNotes,
        created_by: "email_forward",
      })
      .select("id")
      .single();

    if (evErr || !newEvent) {
      console.error("inbound-maestro-email: Event anlegen fehlgeschlagen", evErr);
      return json({ received: true, error: `event: ${evErr?.message}` }, 200);
    }
    const eventId = newEvent.id as string;

    await supabase.from("activity_logs").insert({
      entity_type: "event_inquiry",
      entity_id: eventId,
      action: "email_forward_received",
      actor_email: senderEmail,
      metadata: {
        source: "email_forward",
        subject: subjectStr,
        preview: bodyText.slice(0, 200),
      },
    }).then(({ error }) => {
      if (error) console.error("inbound-maestro-email: activity_log fehlgeschlagen", error);
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const editUrl = `https://events-storia.de/admin/events/${eventId}/edit`;
      const safePreview = bodyText.slice(0, 800).replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "STORIA System <info@events-storia.de>",
          to: ["info@events-storia.de"],
          subject: `Neue weitergeleitete Anfrage: ${subjectStr}`,
          html:
            `<p>Eine an <strong>maestro@paterbrown.com</strong> weitergeleitete Anfrage wurde als neuer Event angelegt.</p>` +
            `<p><strong>Von:</strong> ${senderName} &lt;${senderEmail}&gt;</p>` +
            `<p><a href="${editUrl}">Im Maestro öffnen</a> und via Freitext-Import im OfferBuilder übernehmen.</p>` +
            `<hr/><pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;">${safePreview}</pre>`,
        }),
      }).catch((e) => console.error("inbound-maestro-email: Resend-Alarm fehlgeschlagen", e));
    } else {
      console.warn("inbound-maestro-email: RESEND_API_KEY fehlt — kein Alarm versendet");
    }

    console.log(`inbound-maestro-email: Event ${eventId} aus Forward von ${senderEmail} angelegt`);
    return json({ received: true, matched: true, event_id: eventId, customer_id: customerId }, 200);
  } catch (err) {
    console.error("inbound-maestro-email error:", err);
    return json({ received: true, error: String(err) }, 200);
  }
});