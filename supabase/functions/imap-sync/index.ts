// IMAP Sync für info@events-storia.de
// Phase A: Inkrementeller Pull aus INBOX
// Phase B: Reconciliation (alle 10 Minuten) — erkennt verschobene/gelöschte Mails

import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.7.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMAP_HOST = Deno.env.get("IMAP_HOST")!;
const IMAP_PORT = parseInt(Deno.env.get("IMAP_PORT") ?? "993");
const IMAP_USER = Deno.env.get("IMAP_USER")!;
const IMAP_PASSWORD = Deno.env.get("IMAP_PASSWORD")!;

const MAX_PER_RUN = 5;
const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;
const LARGE_MAIL_BYTES = 200 * 1024;
const BUCKET = "email-attachments";

// Eigene Outbound-Adressen — Mails von diesen Absendern sind Kopien
// unserer eigenen Outbound-Mails und gehören nicht in den Posteingang.
const OWN_OUTBOUND_EMAILS = new Set<string>([
  "info@events-storia.de",
]);
const OWN_OUTBOUND_DOMAIN_SUFFIXES = [
  "@reply.events-storia.de",
];

function isOwnOutbound(fromEmail: string | null | undefined): boolean {
  if (!fromEmail) return false;
  const lower = fromEmail.toLowerCase();
  if (OWN_OUTBOUND_EMAILS.has(lower)) return true;
  return OWN_OUTBOUND_DOMAIN_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Prüft, ob eine Message-ID bereits als Maestro-Outbound in v2_event_emails archiviert ist.
 * Wird genutzt, um Sent-Mails (Apple Mail) und INBOX-Kopien eigener Mails zu deduplizieren.
 */
async function existsInOutboundArchive(messageId: string | null | undefined): Promise<boolean> {
  if (!messageId) return false;
  const cleaned = messageId.replace(/^<|>$/g, "").trim();
  if (!cleaned) return false;
  // resend_message_id (Maestro hat via Resend gesendet)
  const { data: r1 } = await supabase
    .from("v2_event_emails")
    .select("id")
    .eq("resend_message_id", cleaned)
    .limit(1)
    .maybeSingle();
  if (r1) return true;
  // source_message_id (UUID-Form, falls so verlinkt)
  return false;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function sanitizeFilename(name: string): string {
  return (name || "attachment")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function stripBrackets(s: string | undefined | null): string | null {
  if (!s) return null;
  return s.replace(/^<|>$/g, "").trim() || null;
}

function addrList(arr: any): { name: string | null; email: string }[] {
  if (!arr) return [];
  const items = Array.isArray(arr) ? arr : arr.value ?? [];
  return items
    .map((a: any) => ({ name: a.name || null, email: (a.address || "").toLowerCase() }))
    .filter((a: any) => a.email);
}

async function getSyncState(folder: string) {
  const { data, error } = await supabase
    .from("imap_sync_state")
    .select("*")
    .eq("folder_name", folder)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: inserted, error: insErr } = await supabase
      .from("imap_sync_state")
      .insert({ folder_name: folder, last_uid: 0 })
      .select()
      .single();
    if (insErr) throw insErr;
    return inserted;
  }
  return data;
}

async function setSyncError(folder: string, err: string) {
  await supabase
    .from("imap_sync_state")
    .update({ last_error: err.slice(0, 2000), last_error_at: new Date().toISOString() })
    .eq("folder_name", folder);
}

async function uploadAttachments(emailId: string, attachments: any[]) {
  for (const att of attachments) {
    try {
      const filename = sanitizeFilename(att.filename || "attachment.bin");
      const attId = crypto.randomUUID();
      const path = `emails/${emailId}/${attId}-${filename}`;
      const buf: Uint8Array =
        att.content instanceof Uint8Array
          ? att.content
          : new Uint8Array(att.content ?? []);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, {
          contentType: att.contentType || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { error: rowErr } = await supabase.from("email_attachments").insert({
        id: attId,
        email_id: emailId,
        filename: att.filename || "attachment.bin",
        mime_type: att.contentType || "application/octet-stream",
        size_bytes: att.size ?? buf.length,
        is_inline: !!att.related,
        content_id: stripBrackets(att.contentId),
        storage_path: path,
      });
      if (rowErr) throw rowErr;
    } catch (e) {
      console.error("Attachment failed:", e);
    }
  }
}

async function tryFolders(client: ImapFlow, candidates: string[]): Promise<string | null> {
  for (const f of candidates) {
    try {
      const lock = await client.getMailboxLock(f);
      lock.release();
      return f;
    } catch {
      // continue
    }
  }
  return null;
}

async function findByMessageId(
  client: ImapFlow,
  folder: string,
  messageId: string,
): Promise<boolean> {
  let lock;
  try {
    lock = await client.getMailboxLock(folder);
    const uids = await client.search({ header: { "message-id": messageId } }, { uid: true });
    return Array.isArray(uids) && uids.length > 0;
  } catch {
    return false;
  } finally {
    try { lock?.release(); } catch { /* ignore */ }
  }
}

async function phaseA(
  client: ImapFlow,
  folder: string,
): Promise<{ folder: string; processed: number; skippedOwn: number; maxUid: number }> {
  const state = await getSyncState(folder);
  const lastUid = Number(state.last_uid || 0);
  let processed = 0;
  let skippedOwn = 0;
  let maxUid = lastUid;

  const lock = await client.getMailboxLock(folder);
  try {
    const range = `${lastUid + 1}:*`;
    const uids: number[] = [];
    for await (const msg of client.fetch(range, { uid: true }, { uid: true })) {
      if (msg.uid && msg.uid > lastUid) uids.push(msg.uid);
    }
    uids.sort((a, b) => a - b);
    const slice = uids.slice(0, MAX_PER_RUN);

    for (const uid of slice) {
      try {
        // Erst envelope + size, um große Mails schlank zu speichern
        const meta = await client.fetchOne(
          String(uid),
          { uid: true, flags: true, internalDate: true, envelope: true, size: true },
          { uid: true },
        );
        if (!meta) { maxUid = Math.max(maxUid, uid); continue; }
        const rawSize = Number(meta.size ?? 0);
        const isLarge = rawSize > LARGE_MAIL_BYTES;

        let parsed: any = {};
        let sourceBuf: Uint8Array | null = null;
        if (!isLarge) {
          const full = await client.fetchOne(
            String(uid),
            { source: true },
            { uid: true },
          );
          sourceBuf = (full?.source as Uint8Array) ?? null;
          if (sourceBuf) {
            parsed = await simpleParser(sourceBuf, {
              skipImageLinks: true,
              skipHtmlToText: true,
              skipTextToHtml: true,
            });
          }
        }
        // Fallback: envelope-basierte Felder, falls kein Body geparsed wurde
        const env = meta.envelope ?? {};
        if (!parsed.from && env.from) parsed.from = env.from;
        if (!parsed.to && env.to) parsed.to = env.to;
        if (!parsed.cc && env.cc) parsed.cc = env.cc;
        if (!parsed.subject && env.subject) parsed.subject = env.subject;
        if (!parsed.messageId && env.messageId) parsed.messageId = env.messageId;
        if (!parsed.date && env.date) parsed.date = env.date;
        if (!parsed.inReplyTo && env.inReplyTo) parsed.inReplyTo = env.inReplyTo;

        const messageId =
          stripBrackets(parsed.messageId) ||
          stripBrackets(env?.messageId) ||
          `imap-${IMAP_USER}-${folder}-${uid}`;
        const fromArr = addrList(parsed.from);
        // Eigene Outbound-Kopien überspringen (nicht in inbox_emails inserten),
        // aber UID-Pointer hochsetzen, damit wir sie nicht erneut anfassen.
        if (isOwnOutbound(fromArr[0]?.email)) {
          skippedOwn += 1;
          maxUid = Math.max(maxUid, uid);
          await supabase
            .from("imap_sync_state")
            .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() })
            .eq("folder_name", folder);
          continue;
        }
        const toArr = addrList(parsed.to);
        const ccArr = addrList(parsed.cc);
        const replyToArr = addrList(parsed.replyTo);
        const refs = parsed.references
          ? Array.isArray(parsed.references)
            ? parsed.references
            : [parsed.references]
          : [];

        const rawMime = !sourceBuf
          ? `[skipped: ${rawSize} bytes — too large for inline parsing]`
          : new TextDecoder("utf-8", { fatal: false }).decode(sourceBuf);

        const attachments = isLarge ? [] : parsed.attachments ?? [];

        const { data: inserted, error: insErr } = await supabase
          .from("inbox_emails")
          .upsert(
            {
              message_id: messageId,
              raw_mime: rawMime,
              raw_size_bytes: rawSize,
              imap_uid: uid,
              imap_folder: folder,
              imap_status: "present",
              from_email: fromArr[0]?.email ?? null,
              from_name: fromArr[0]?.name ?? null,
              to_emails: toArr.map((a) => a.email),
              cc_emails: ccArr.map((a) => a.email),
              reply_to_email: replyToArr[0]?.email ?? null,
              subject: parsed.subject ?? null,
              in_reply_to: stripBrackets(parsed.inReplyTo),
              references_headers: refs.map((r: string) => stripBrackets(r)).filter(Boolean),
              body_text: parsed.text ?? null,
              body_html: typeof parsed.html === "string" ? parsed.html : null,
              has_attachments: (parsed.attachments?.length ?? 0) > 0,
              attachment_count: parsed.attachments?.length ?? 0,
              date_sent: parsed.date ? new Date(parsed.date).toISOString() : null,
              date_received: meta.internalDate
                ? new Date(meta.internalDate as any).toISOString()
                : new Date().toISOString(),
              status_history: [
                { status: "present", folder, at: new Date().toISOString() },
              ],
            },
            { onConflict: "message_id", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();

        if (insErr) {
          console.error(`Insert failed UID ${uid}:`, insErr.message);
        } else if (inserted?.id && attachments.length > 0) {
          await uploadAttachments(inserted.id, attachments);
        }

        // Sender-Blocklist Check: Wenn Absender geblockt, sofort verstecken
        if (inserted?.id && fromArr[0]?.email) {
          try {
            const fromLower = fromArr[0].email.toLowerCase();
            const { data: blocked } = await supabase
              .from("email_sender_blocklist")
              .select("from_email")
              .eq("from_email", fromLower)
              .maybeSingle();
            if (blocked) {
              await supabase
                .from("inbox_emails")
                .update({
                  is_hidden: true,
                  hidden_reason: "sender_blocklisted",
                  hidden_at: new Date().toISOString(),
                })
                .eq("id", inserted.id);
            }
          } catch (e) {
            console.error("blocklist check failed:", (e as Error).message);
          }
        }

        // Match gegen Event-Filter (fire-and-forget, Fehler dürfen Sync nicht blocken)
        if (inserted?.id) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/match-email-to-events`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({ email_id: inserted.id }),
            });
          } catch (e) {
            console.error("match invoke failed:", (e as Error).message);
          }

          // KI-Mapping-Vorschlag (fire-and-forget, blockiert Sync nicht)
          try {
            void fetch(`${SUPABASE_URL}/functions/v1/suggest-email-mapping`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({ email_id: inserted.id }),
            });
          } catch (e) {
            console.error("suggest invoke failed:", (e as Error).message);
          }
        }

        processed += 1;
        maxUid = Math.max(maxUid, uid);
        // inkrementell persistieren, damit ein CPU-Timeout nicht den Fortschritt verliert
        await supabase
          .from("imap_sync_state")
          .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() })
          .eq("folder_name", folder);
      } catch (e) {
        console.error(`Mail UID ${uid} failed:`, e);
        maxUid = Math.max(maxUid, uid);
      }
    }
  } finally {
    lock.release();
  }

  if (maxUid > lastUid) {
    await supabase
      .from("imap_sync_state")
      .update({ last_uid: maxUid, last_sync_at: new Date().toISOString(), last_error: null })
      .eq("folder_name", folder);
  } else {
    await supabase
      .from("imap_sync_state")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("folder_name", folder);
  }

  return { folder, processed, skippedOwn, maxUid };
}

async function phaseB(client: ImapFlow): Promise<{ moved: number; deleted: number } | null> {
  const state = await getSyncState("INBOX");
  const last = state.last_full_reconcile_at
    ? new Date(state.last_full_reconcile_at).getTime()
    : 0;
  if (Date.now() - last < RECONCILE_INTERVAL_MS) return null;

  // 1. UIDs im Postfach
  const inboxLock = await client.getMailboxLock("INBOX");
  let presentUids: number[] = [];
  try {
    const result = await client.search({ all: true }, { uid: true });
    presentUids = (result as number[]) ?? [];
  } finally {
    inboxLock.release();
  }
  const presentSet = new Set(presentUids);

  // 2. DB-Reihen mit Folder=INBOX, status=present
  const { data: dbRows } = await supabase
    .from("inbox_emails")
    .select("id, message_id, imap_uid")
    .eq("imap_folder", "INBOX")
    .eq("imap_status", "present");

  const archivFolder = await tryFolders(client, ["Archiv", "INBOX.Archiv", "Archive"]);
  const trashFolder = await tryFolders(client, ["Trash", "INBOX.Trash", "Papierkorb", "INBOX.Papierkorb"]);

  let moved = 0;
  let deleted = 0;

  for (const row of dbRows ?? []) {
    if (row.imap_uid && presentSet.has(Number(row.imap_uid))) continue;
    if (!row.message_id) continue;

    let foundFolder: string | null = null;
    if (archivFolder && (await findByMessageId(client, archivFolder, row.message_id))) {
      foundFolder = archivFolder;
    } else if (trashFolder && (await findByMessageId(client, trashFolder, row.message_id))) {
      foundFolder = trashFolder;
    }

    if (foundFolder) {
      await supabase.rpc("append_email_status_history", {
        p_email_id: row.id,
        p_new_status: "moved",
        p_folder: foundFolder,
      });
      moved += 1;
    } else {
      await supabase.rpc("append_email_status_history", {
        p_email_id: row.id,
        p_new_status: "deleted_on_server",
        p_folder: null,
      });
      deleted += 1;
    }
  }

  await supabase
    .from("imap_sync_state")
    .update({ last_full_reconcile_at: new Date().toISOString() })
    .eq("folder_name", "INBOX");

  return { moved, deleted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const diagnose = url.searchParams.get("diagnose") === "1";

  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
      logger: false,
    });
    await client.connect();

    if (diagnose) {
      const list = await client.list();
      const folders: any[] = [];
      for (const mb of list) {
        try {
          const lock = await client.getMailboxLock(mb.path);
          try {
            const status = await client.status(mb.path, { messages: true, uidNext: true, uidValidity: true });
            // Latest 3 messages by date
            const latest: any[] = [];
            try {
              const total = (status as any).messages || 0;
              if (total > 0) {
                const start = Math.max(1, total - 2);
                for await (const msg of client.fetch(`${start}:*`, { envelope: true, uid: true, internalDate: true })) {
                  latest.push({
                    uid: msg.uid,
                    date: msg.internalDate,
                    subject: msg.envelope?.subject,
                    from: msg.envelope?.from?.[0]?.address,
                  });
                }
              }
            } catch (_) { /* ignore */ }
            folders.push({
              path: mb.path,
              flags: Array.from(mb.flags || []),
              specialUse: mb.specialUse,
              messages: Number((status as any).messages ?? 0),
              uidNext: Number((status as any).uidNext ?? 0),
              uidValidity: String((status as any).uidValidity ?? ""),
              latest: latest.map((l) => ({ ...l, uid: Number(l.uid) })),
            });
          } finally {
            lock.release();
          }
        } catch (e) {
          folders.push({ path: mb.path, error: (e as Error).message });
        }
      }
      return new Response(
        JSON.stringify({ ok: true, diagnose: true, folders }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Alle INBOX-Folder erkennen — KI-Mail-Assistent (IONOS) sortiert in Subfolder.
    const list = await client.list();
    const inboxFolders = new Set<string>(["INBOX"]);
    for (const mb of list) {
      const p = mb.path;
      if (!p) continue;
      if (p === "INBOX" || p.startsWith("INBOX/") || p.startsWith("INBOX.")) {
        const lower = p.toLowerCase();
        if (
          lower.includes("trash") ||
          lower.includes("papierkorb") ||
          lower.includes("archiv") ||
          lower.includes("archive") ||
          lower.includes("sent") ||
          lower.includes("gesendet") ||
          lower.includes("drafts") ||
          lower.includes("entwürfe") ||
          lower.includes("entwurf") ||
          lower.includes("spam") ||
          lower.includes("junk")
        ) continue;
        inboxFolders.add(p);
      }
    }

    const phaseAResults: any[] = [];
    for (const f of inboxFolders) {
      try {
        const r = await phaseA(client, f);
        phaseAResults.push(r);
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        console.error(`phaseA(${f}) failed:`, msg);
        try { await setSyncError(f, msg); } catch (_) { /* ignore */ }
        phaseAResults.push({ folder: f, error: msg });
      }
    }
    const b = await phaseB(client);

    return new Response(
      JSON.stringify({
        ok: true,
        phaseA: phaseAResults,
        phaseB: b,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("imap-sync error:", msg);
    try {
      await setSyncError("INBOX", msg);
    } catch (_) { /* ignore */ }
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } finally {
    try {
      await client?.logout();
    } catch (_) {
      try { client?.close(); } catch (_) { /* ignore */ }
    }
  }
});