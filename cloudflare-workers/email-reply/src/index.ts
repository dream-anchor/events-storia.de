/**
 * Cloudflare Email Worker: STORIA Inbound Reply
 *
 * Empfängt E-Mails an *@reply.monot.com und leitet sie an die
 * Supabase Edge Function `receive-inbound-email` weiter.
 *
 * Bei Replies auf Angebotsmails (reply+INQUIRY_ID@reply.monot.com)
 * wird die Nachricht dem richtigen Angebot in StoriaMaestro zugeordnet.
 *
 * Deployment:
 *   cd cloudflare-workers/email-reply
 *   npx wrangler deploy
 *
 * DNS-Setup: siehe README.md
 */

import PostalMime from "postal-mime";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WEBHOOK_SECRET?: string;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      // 1. Mail parsen (Raw RFC822 → strukturiertes Objekt)
      const raw = new Response(message.raw);
      const rawBuffer = await raw.arrayBuffer();
      const parsed = await PostalMime.parse(rawBuffer);

      // 2. Payload für Supabase Edge Function bauen (Resend-kompatibles Format)
      const headers: Record<string, string> = {};
      for (const h of parsed.headers || []) {
        if (h.key && h.value) headers[h.key.toLowerCase()] = h.value;
      }

      const payload = {
        from: parsed.from?.address
          ? (parsed.from.name
              ? `${parsed.from.name} <${parsed.from.address}>`
              : parsed.from.address)
          : message.from,
        to: message.to,
        subject: parsed.subject || "(ohne Betreff)",
        text: parsed.text || "",
        html: parsed.html || "",
        headers,
        attachments: (parsed.attachments || []).map(a => ({
          filename: a.filename,
          contentType: a.mimeType,
          size: a.content?.byteLength || 0,
          // Anhänge selbst werden hier NICHT mitgesendet (Worker Size-Limit),
          // nur Metadaten. Bei Bedarf: R2 upload + URL übergeben.
        })),
      };

      // 3. Routing: maestro@... → Auto-Import, alles andere → Reply-Handler
      const toAddress = String(message.to || "").toLowerCase();
      const isMaestroForward =
        toAddress.startsWith("maestro@") || toAddress.includes("<maestro@");
      const targetFunction = isMaestroForward
        ? "inbound-maestro-email"
        : "receive-inbound-email";
      const endpoint = `${env.SUPABASE_URL}/functions/v1/${targetFunction}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          ...(env.WEBHOOK_SECRET ? { "X-Webhook-Secret": env.WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Supabase Edge (${targetFunction}) returned ${res.status}: ${errText}`);
        // Email NICHT rejecten — besser als Dropping, Nachricht bleibt im CF-Log
        return;
      }

      console.log(`Forwarded mail from ${payload.from} → ${targetFunction} (${res.status})`);
    } catch (err) {
      console.error("Email handler error:", err);
      // Kein throw — Cloudflare würde sonst die Mail bouncen,
      // was beim Absender einen Delivery-Fehler auslöst.
    }
  },
};
