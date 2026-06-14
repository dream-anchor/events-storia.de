import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Resend Event-Typ → email_delivery_logs Status
//
// WICHTIG: `email.delivered` wird NICHT auf "delivered" gemappt, sondern auf
// "sent". Grund: Resend feuert `email.delivered` auch, wenn nur einer der
// Empfänger (z. B. unser BCC info@events-storia.de) tatsächlich zugestellt
// wurde — der eigentliche Kunde kann gleichzeitig auf der Suppression-List
// stehen und die Mail NIE bekommen. Dieselbe email_id deckt alle Empfänger
// ab. Daher zeigt Maestro nur dann grün "Zugestellt", wenn wir es wirklich
// wissen — ansonsten blau "Versendet".
const RESEND_STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "sent",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
  "email.opened": "sent",
  "email.failed": "failed",
};

// Statuswerte, die niemals durch ein "weicheres" Success-Event überschrieben
// werden dürfen. Wenn Resend erst bounced/complained/failed liefert und danach
// noch ein verspätetes delivered/opened, bleibt der Fehlerzustand erhalten.
const TERMINAL_FAILURE_STATUSES = new Set([
  "bounced",
  "complained",
  "failed",
  "suppressed",
]);

// Events, die einen automatischen SMTP-Fallback auslösen sollen
const SMTP_FALLBACK_EVENTS = new Set([
  "email.bounced",
  "email.complained",
  "email.failed",
]);

/**
 * Verifiziert die svix-Signatur von Resend Webhooks.
 * Resend nutzt svix (HMAC-SHA256) zur Signierung.
 */
async function verifySignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Uint8Array.from(atob(cleanSecret), (c) => c.charCodeAt(0));

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const computedBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // svix-signature kann mehrere Signaturen enthalten (Key-Rotation): "v1,<base64> v1,<base64>"
  return svixSignature.split(" ").some((sig) => {
    const parts = sig.split(",");
    return parts.length === 2 && parts[0] === "v1" && parts[1] === computedBase64;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("RESEND_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Raw Body lesen (vor JSON-Parse für Signatur-Verifikation)
  const body = await req.text();

  // svix-Header auslesen
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("Fehlende svix-Header");
    return new Response("Missing signature headers", { status: 401 });
  }

  // Replay-Schutz: Timestamp darf max. 5 Minuten alt sein
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(svixTimestamp, 10));
  if (timestampAge > 300) {
    console.error("Webhook-Timestamp zu alt:", timestampAge);
    return new Response("Timestamp too old", { status: 401 });
  }

  // Signatur verifizieren
  const isValid = await verifySignature(body, svixId, svixTimestamp, svixSignature, webhookSecret);
  if (!isValid) {
    console.error("Ungültige Webhook-Signatur");
    return new Response("Invalid signature", { status: 401 });
  }

  // Payload parsen
  let payload: { type: string; data: { email_id: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { type, data } = payload as { type: string; data: Record<string, unknown> & { email_id: string } };
  const newStatus = RESEND_STATUS_MAP[type];

  if (!newStatus) {
    // Unbekannter Event-Typ — quittieren aber nichts tun
    console.log("Unbehandelter Resend-Event:", type);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailId = data?.email_id;
  if (!emailId) {
    return new Response("Missing email_id in payload", { status: 400 });
  }

  // Status in email_delivery_logs updaten
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const reason =
    (data as Record<string, unknown>)?.reason as string | undefined ||
    ((data as Record<string, unknown>)?.bounce as Record<string, unknown> | undefined)?.message as string | undefined ||
    null;

  // Aktuellen Status lesen, damit wir Failure-Zustände nicht überschreiben.
  const { data: existingLog } = await supabase
    .from("email_delivery_logs")
    .select("id, status, entity_id, entity_type, recipient_email, subject")
    .eq("provider_message_id", emailId)
    .eq("provider", "resend")
    .maybeSingle();

  const isFailureEvent = SMTP_FALLBACK_EVENTS.has(type);
  const wouldDowngrade =
    !isFailureEvent &&
    existingLog?.status &&
    TERMINAL_FAILURE_STATUSES.has(existingLog.status);

  let logRow = existingLog;
  let error: unknown = null;

  if (existingLog && !wouldDowngrade) {
    const upd = await supabase
      .from("email_delivery_logs")
      .update({
        status: newStatus,
        error_message: isFailureEvent ? (reason || `Resend ${type}`) : null,
      })
      .eq("id", existingLog.id)
      .select("entity_id, entity_type, recipient_email, subject")
      .maybeSingle();
    logRow = upd.data ?? existingLog;
    error = upd.error;
  } else if (wouldDowngrade) {
    console.log("Skipping status downgrade", {
      emailId,
      type,
      currentStatus: existingLog?.status,
      newStatus,
    });
  }

  if (error) {
    console.error("DB-Update fehlgeschlagen:", error, { emailId, type });
  } else {
    console.log("Email-Status aktualisiert:", { emailId, type, newStatus });
  }

  // Bei Zustellfehlern: Activity-Log + automatischer SMTP-Retry
  if (isFailureEvent && logRow?.entity_id && logRow?.entity_type === "v2_event") {
    // Activity-Log-Eintrag, damit Maestro den Fehler statt "Zugestellt" anzeigt
    await supabase.from("activity_logs").insert({
      entity_type: "v2_event",
      entity_id: logRow.entity_id,
      action: "offer_email_failed",
      actor_email: "system",
      metadata: {
        recipient: logRow.recipient_email,
        subject: logRow.subject,
        resend_event: type,
        resend_message_id: emailId,
        reason: reason || `Resend ${type}`,
      },
    });

    // Originale outbound-Mail finden und über SMTP nachsenden
    const { data: emailRow } = await supabase
      .from("v2_event_emails")
      .select("id")
      .eq("resend_message_id", emailId)
      .maybeSingle();

    if (emailRow?.id) {
      try {
        const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/resend-via-smtp`;
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            event_email_id: emailRow.id,
            reason: reason || `Resend ${type}`,
            resend_log_id: existingLog?.id ?? null,
          }),
        });
        console.log("SMTP-Fallback ausgelöst:", res.status);
      } catch (e) {
        console.error("SMTP-Fallback invocation failed:", e);
      }
    } else {
      console.warn("Kein v2_event_emails-Eintrag zu resend_message_id gefunden:", emailId);
    }
  }

  // Immer 200 zurückgeben um Resend-Retries zu vermeiden
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
