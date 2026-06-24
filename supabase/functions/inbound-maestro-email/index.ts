/**
 * inbound-maestro-email
 *
 * Empfängt Mails, die an `maestro@events-storia.com` gehen (über IONOS-
 * Weiterleitung → Cloudflare Email Worker → diese Edge Function).
 *
 * Zweck: Auto-Import von Anfragen, die per Mail reinkommen, als Draft-
 * Anfrage in Maestro. Staff vervollständigt sie dann über den Freitext-Import
 * im OfferBuilder.
 *
 * Public Endpoint — verify_jwt = false. Sicherheit über optionalen
 * X-Webhook-Secret Header (MAESTRO_INBOUND_SECRET).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function parseFromAddress(from: unknown): { email: string; name: string } {
  if (!from) return { email: "", name: "" };
  if (typeof from === "object" && from !== null) {
    const f = from as { address?: string; email?: string; name?: string };
    return {
      email: String(f.address || f.email || "").toLowerCase().trim(),
      name: String(f.name || "").trim(),
    };
  }
  const s = String(from);
  // "Name <mail@x.de>" oder reine Adresse
  const m = s.match(/^\s*(?:"?([^"<]*?)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?\s*$/);
  if (m) {
    return { email: m[2].toLowerCase().trim(), name: (m[1] || "").trim() };
  }
  return { email: s.toLowerCase().trim(), name: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  // Optionaler Shared-Secret Check
  const expectedSecret = Deno.env.get("MAESTRO_INBOUND_SECRET");
  if (expectedSecret) {
    const got = req.headers.get("x-webhook-secret");
    if (got !== expectedSecret) {
      console.warn("inbound-maestro-email: invalid shared secret");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { from, subject, text, html } = body as {
      from: unknown;
      to?: unknown;
      subject?: string;
      text?: string;
      html?: string;
    };

    const { email: fromEmail, name: fromName } = parseFromAddress(from);
    if (!fromEmail) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_from" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const displayName = fromName || fromEmail.split("@")[0];
    const subj = (subject || "").trim() || "Anfrage per E-Mail";
    const rawText = (text || "").trim();

    // 1) Customer auflösen oder anlegen
    let customerId: string | null = null;
    const { data: existing } = await admin
      .from("v2_customers")
      .select("id")
      .ilike("email", fromEmail)
      .is("merged_into_id", null)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      customerId = existing.id;
    } else {
      const { data: created, error: cErr } = await admin
        .from("v2_customers")
        .insert({ email: fromEmail, name: displayName })
        .select("id")
        .single();
      if (cErr || !created) {
        console.error("customer insert failed", cErr);
        return new Response(
          JSON.stringify({ ok: false, error: `customer_create: ${cErr?.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      customerId = created.id;
    }

    // 2) v2_event als Draft anlegen
    //    Komplette Originalmail in customer_notes — Staff sieht sie im
    //    Inquiry Editor sofort und kann sie via Freitext-Import in den
    //    OfferBuilder übernehmen.
    const notesBlock = [
      `[Auto-Import via maestro@ am ${new Date().toLocaleString("de-DE")}]`,
      `Absender: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}`,
      `Betreff: ${subj}`,
      "",
      rawText || "(kein Textinhalt)",
    ].join("\n");

    const { data: newEvent, error: evErr } = await admin
      .from("v2_events")
      .insert({
        customer_id: customerId,
        status: "inquiry",
        source: "email_forward",
        occasion: subj.slice(0, 200),
        customer_notes: notesBlock,
        created_by: "maestro@events-storia.com",
        metadata: {
          auto_import: true,
          auto_import_source: "maestro_inbound",
          auto_import_at: new Date().toISOString(),
          original_subject: subj,
          original_from: fromEmail,
          original_from_name: fromName || null,
        },
      })
      .select("id, number, booking_number, offer_slug")
      .single();

    if (evErr || !newEvent) {
      console.error("event insert failed", evErr);
      return new Response(
        JSON.stringify({ ok: false, error: `event_create: ${evErr?.message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Activity-Log mit voller Mail (für CRM-Timeline)
    await admin.from("activity_logs").insert({
      entity_type: "v2_event",
      entity_id: newEvent.id,
      action: "auto_import_from_email",
      actor_email: "maestro@events-storia.com",
      metadata: {
        from: fromEmail,
        from_name: fromName || null,
        subject: subj,
        text_preview: rawText.slice(0, 2000),
        has_html: Boolean(html),
      },
    });

    // 4) Betreiber-Alarm an info@events-storia.de
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const editUrl = `https://events-storia.de/admin/events/${newEvent.id}/edit`;
      const safePreview = rawText
        .slice(0, 1500)
        .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "STORIA Maestro <info@events-storia.de>",
          to: ["info@events-storia.de"],
          subject: `📥 Auto-Import: ${subj}`,
          html: `<p>Neue Anfrage über <strong>maestro@events-storia.com</strong> automatisch importiert.</p>
                 <p><strong>Von:</strong> ${fromName ? `${fromName} ` : ""}&lt;${fromEmail}&gt;<br/>
                 <strong>Betreff:</strong> ${subj}</p>
                 <p><a href="${editUrl}">Im Maestro öffnen &rarr;</a></p>
                 <hr/>
                 <p style="white-space:pre-wrap;font-family:monospace;font-size:12px;">${safePreview}</p>`,
        }),
      }).catch((e) => console.error("alarm mail failed:", e));
    }

    return new Response(
      JSON.stringify({ ok: true, event_id: newEvent.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("inbound-maestro-email error:", err);
    // Immer 200 zurück, damit Cloudflare/Resend nicht endlos retry'en
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});