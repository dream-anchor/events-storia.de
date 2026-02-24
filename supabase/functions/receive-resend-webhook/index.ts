import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Resend Event-Typ → email_delivery_logs Status
const RESEND_STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
};

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

  const { type, data } = payload;
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

  const { error } = await supabase
    .from("email_delivery_logs")
    .update({ status: newStatus })
    .eq("provider_message_id", emailId)
    .eq("provider", "resend");

  if (error) {
    console.error("DB-Update fehlgeschlagen:", error, { emailId, type });
  } else {
    console.log("Email-Status aktualisiert:", { emailId, type, newStatus });
  }

  // Immer 200 zurückgeben um Resend-Retries zu vermeiden
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
