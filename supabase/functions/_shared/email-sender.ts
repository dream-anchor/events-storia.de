// Shared email sender: Resend primary, IONOS SMTP fallback on error.
// Used by send-invoice-email, send-payment-email, send-raw-html-email.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded content. */
  contentBase64: string;
  contentType?: string;
}

export interface SendEmailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  provider: 'resend' | 'ionos_smtp_fallback';
  messageId: string | null;
  resendError?: string;
  smtpError?: string;
}

const DEFAULT_FROM = 'STORIA Events <info@events-storia.de>';
const DEFAULT_REPLY_TO = 'info@events-storia.de';

function toArr(v?: string | string[]): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sendViaResend(opts: SendEmailOptions): Promise<{ ok: boolean; id: string | null; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { ok: false, id: null, error: 'RESEND_API_KEY missing' };
  const payload: Record<string, unknown> = {
    from: opts.from || DEFAULT_FROM,
    to: toArr(opts.to),
    subject: opts.subject,
    html: opts.html,
    reply_to: opts.replyTo || DEFAULT_REPLY_TO,
  };
  const cc = toArr(opts.cc); if (cc) payload.cc = cc;
  const bcc = toArr(opts.bcc); if (bcc) payload.bcc = bcc;
  if (opts.headers && Object.keys(opts.headers).length > 0) payload.headers = opts.headers;
  if (opts.attachments && opts.attachments.length > 0) {
    payload.attachments = opts.attachments.map((a) => ({
      filename: a.filename,
      content: a.contentBase64,
    }));
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, id: null, error: `Resend ${res.status}: ${JSON.stringify(data)}` };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, id: null, error: `Resend exception: ${(e as Error).message}` };
  }
}

async function sendViaSmtp(opts: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const host = Deno.env.get('SMTP_HOST') || 'smtp.ionos.de';
  const port = parseInt(Deno.env.get('SMTP_PORT') || '465', 10);
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASSWORD');
  if (!user || !pass) return { ok: false, error: 'SMTP_USER/SMTP_PASSWORD missing' };
  const client = new SMTPClient({
    connection: { hostname: host, port, tls: true, auth: { username: user, password: pass } },
  });
  try {
    await client.send({
      from: opts.from || DEFAULT_FROM,
      to: toArr(opts.to)!,
      cc: toArr(opts.cc),
      bcc: toArr(opts.bcc),
      replyTo: opts.replyTo || DEFAULT_REPLY_TO,
      subject: opts.subject,
      content: 'text/html charset=UTF-8',
      html: opts.html,
      headers: opts.headers,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: base64ToBytes(a.contentBase64),
        encoding: 'binary',
        contentType: a.contentType || 'application/pdf',
      })),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `SMTP exception: ${(e as Error).message}` };
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/**
 * Sends an email via Resend first. If Resend fails (HTTP error / exception),
 * automatically falls back to IONOS SMTP. Returns which provider succeeded.
 */
export async function sendEmailWithFallback(opts: SendEmailOptions): Promise<SendEmailResult> {
  const resend = await sendViaResend(opts);
  if (resend.ok) {
    return { success: true, provider: 'resend', messageId: resend.id };
  }
  console.warn('[email-sender] Resend failed, trying SMTP fallback:', resend.error);
  const smtp = await sendViaSmtp(opts);
  if (smtp.ok) {
    return {
      success: true,
      provider: 'ionos_smtp_fallback',
      messageId: null,
      resendError: resend.error,
    };
  }
  return {
    success: false,
    provider: 'ionos_smtp_fallback',
    messageId: null,
    resendError: resend.error,
    smtpError: smtp.error,
  };
}