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

async function phaseA(client: ImapFlow): Promise<{ processed: number; maxUid: number }> {
  const state = await getSyncState("INBOX");
  const lastUid = Number(state.last_uid || 0);
  let processed = 0;
  let maxUid = lastUid;

  const lock = await client.getMailboxLock("INBOX");
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
          `imap-${IMAP_USER}-INBOX-${uid}`;
        const fromArr = addrList(parsed.from);
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
              imap_folder: "INBOX",
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
                { status: "present", folder: "INBOX", at: new Date().toISOString() },
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
        }

        processed += 1;
        maxUid = Math.max(maxUid, uid);
        // inkrementell persistieren, damit ein CPU-Timeout nicht den Fortschritt verliert
        await supabase
          .from("imap_sync_state")
          .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() })
          .eq("folder_name", "INBOX");
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
      .eq("folder_name", "INBOX");
  } else {
    await supabase
      .from("imap_sync_state")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("folder_name", "INBOX");
  }

  return { processed, maxUid };
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

    const a = await phaseA(client);
    const b = await phaseB(client);

    return new Response(
      JSON.stringify({
        ok: true,
        phaseA: a,
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