import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { syncLexOfficeInvoice } from '../_shared/lexoffice-sync.ts';

// LexOffice Event-Subscription webhook receiver.
// Public endpoint (verify_jwt = false).
//
// Authenticity model:
//   Lexware does NOT issue a shared webhook secret. Instead each callback is
//   signed by Lexware with their RSA private key and the signature is sent in
//   the `X-Lxo-Signature` header (Base64, SHA-256 over the raw request body).
//   If the env var LEXOFFICE_WEBHOOK_PUBLIC_KEY is configured (PEM, SPKI),
//   we verify the signature and reject unsigned/invalid requests.
//   If it is not configured we accept any request — this is safe because the
//   payload only contains a `resourceId`. We then re-fetch that invoice from
//   LexOffice with OUR own LEXOFFICE_API_KEY. A forged webhook can at worst
//   trigger a re-sync of an invoice that already legitimately belongs to us.
//
// LexOffice payload shape (Event-Subscription v1):
// { "organizationId": "...", "eventType": "invoice.changed",
//   "resourceId": "<invoice uuid>", "eventDate": "ISO-timestamp" }

interface LexOfficeEvent {
  organizationId?: string;
  eventType?: string;
  resourceId?: string;
  eventDate?: string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyLexSignature(
  publicKeyPem: string,
  signatureB64: string,
  rawBody: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = b64ToBytes(signatureB64);
    const data = new TextEncoder().encode(rawBody);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  } catch (err) {
    console.error('[lexoffice-webhook] signature verify error', err);
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  if (!lexofficeApiKey) {
    console.error('[lexoffice-webhook] missing LEXOFFICE_API_KEY');
    return new Response(JSON.stringify({ error: 'not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Read raw body once so we can both verify the signature and parse JSON.
  const rawBody = await req.text();

  const publicKeyPem = Deno.env.get('LEXOFFICE_WEBHOOK_PUBLIC_KEY');
  const signatureHeader = req.headers.get('x-lxo-signature') || req.headers.get('X-Lxo-Signature');

  if (publicKeyPem) {
    if (!signatureHeader) {
      console.warn('[lexoffice-webhook] missing X-Lxo-Signature header');
      return new Response(JSON.stringify({ error: 'missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const ok = await verifyLexSignature(publicKeyPem, signatureHeader, rawBody);
    if (!ok) {
      console.warn('[lexoffice-webhook] invalid X-Lxo-Signature');
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.warn('[lexoffice-webhook] LEXOFFICE_WEBHOOK_PUBLIC_KEY not set — skipping signature verification');
  }

  let event: LexOfficeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventType = event.eventType ?? 'unknown';
  const invoiceId = event.resourceId;

  console.log('[lexoffice-webhook] received', { eventType, invoiceId });

  if (!invoiceId) {
    return new Response(JSON.stringify({ ok: true, ignored: 'missing resourceId' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only react to invoice-related events
  const isInvoiceEvent = eventType.startsWith('invoice.') || eventType.startsWith('payment.');
  if (!isInvoiceEvent) {
    return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const outcome = await syncLexOfficeInvoice(supabaseAdmin, lexofficeApiKey, invoiceId, eventType);

  return new Response(JSON.stringify({ ok: true, outcome }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});