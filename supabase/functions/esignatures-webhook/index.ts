/**
 * eSignatures.com Webhook — empfängt contract-signed Events,
 * prüft HMAC-SHA256, lädt das signierte PDF, archiviert es im Storage
 * und setzt den Status der Kostenübernahme + des Angebots.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

async function verifyHmac(secret: string, raw: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(raw),
  );
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  // accept hex or base64
  return hex === signature.toLowerCase() ||
    btoa(String.fromCharCode(...new Uint8Array(mac))) === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    const secret = Deno.env.get("ESIGNATURES_WEBHOOK_SECRET");
    const sig = req.headers.get("x-esignatures-signature") ??
      req.headers.get("x-webhook-signature") ?? "";
    if (secret && sig) {
      const ok = await verifyHmac(secret, raw, sig);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Bad signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(raw) as {
      status?: string;
      data?: {
        contract?: {
          id?: string;
          metadata?: string;
          status?: string;
          contract_pdf_url?: string;
        };
      };
      event?: string;
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const contract = payload?.data?.contract ?? {};
    const acceptanceId = contract.metadata;
    if (!acceptanceId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // append event
    const { data: existing } = await supabase
      .from("cost_acceptances")
      .select("id, inquiry_id, webhook_events, status")
      .eq("id", acceptanceId)
      .maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ ok: true, unknown: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const events = Array.isArray(existing.webhook_events)
      ? existing.webhook_events
      : [];
    events.push({
      at: new Date().toISOString(),
      event: payload.event ?? payload.status,
      payload,
    });

    const isSigned = payload.status === "contract-signed" ||
      payload.event === "contract-signed" ||
      contract.status === "signed";

    let updates: Record<string, unknown> = { webhook_events: events };

    if (isSigned && contract.contract_pdf_url) {
      // Download and store PDF
      const pdfRes = await fetch(contract.contract_pdf_url);
      const pdfBuf = new Uint8Array(await pdfRes.arrayBuffer());
      const storagePath = `${acceptanceId}/signed.pdf`;
      const { error: upErr } = await supabase.storage
        .from("cost-acceptances")
        .upload(storagePath, pdfBuf, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw upErr;

      const hash = await crypto.subtle.digest("SHA-256", pdfBuf);
      const sha256 = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      updates = {
        ...updates,
        status: "signed",
        signed_at: new Date().toISOString(),
        signed_pdf_storage_path: storagePath,
        signed_pdf_sha256: sha256,
      };

      // Lock the offer + set phase
      await supabase
        .from("v2_events")
        .update({
          locked_after_signature: true,
          cost_acceptance_id: acceptanceId,
          offer_phase: "confirmed",
        })
        .eq("id", existing.inquiry_id);

      // Activity log
      await supabase.from("activity_logs").insert({
        entity_type: "event_inquiry",
        entity_id: existing.inquiry_id,
        action: "cost_acceptance_signed",
        metadata: {
          cost_acceptance_id: acceptanceId,
          contract_id: contract.id,
        },
      });
    }

    await supabase.from("cost_acceptances").update(updates).eq(
      "id",
      acceptanceId,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[esignatures-webhook]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});