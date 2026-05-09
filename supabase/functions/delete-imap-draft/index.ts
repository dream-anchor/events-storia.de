// Löscht eine Draft auf dem IONOS-Mailserver (STORE +FLAGS \Deleted, dann EXPUNGE)
// und markiert den DB-Eintrag als deleted_on_server.

import { ImapFlow } from "npm:imapflow@1.0.164";
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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let client: ImapFlow | null = null;
  try {
    const { email_id } = await req.json();
    if (!email_id || typeof email_id !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "email_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: row, error } = await supabase
      .from("inbox_emails")
      .select("id, direction, imap_uid, imap_folder, imap_status")
      .eq("id", email_id)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.direction !== "draft") {
      return new Response(JSON.stringify({ ok: false, error: "not_a_draft" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!row.imap_uid || !row.imap_folder) {
      return new Response(JSON.stringify({ ok: false, error: "missing_imap_ref" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.imap_status === "present") {
      client = new ImapFlow({
        host: IMAP_HOST,
        port: IMAP_PORT,
        secure: true,
        auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock(row.imap_folder);
      try {
        // \Deleted-Flag setzen
        await client.messageFlagsAdd(
          { uid: String(row.imap_uid) },
          ["\\Deleted"],
          { uid: true },
        );
        // EXPUNGE
        try {
          await (client as any).messageDelete({ uid: String(row.imap_uid) }, { uid: true });
        } catch {
          // Fallback: full expunge
          await (client as any).expunge?.();
        }
      } finally {
        lock.release();
      }
    }

    await supabase
      .from("inbox_emails")
      .update({
        imap_status: "deleted_on_server",
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", email_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("delete-imap-draft:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    try { await client?.logout(); } catch { try { client?.close(); } catch { /* ignore */ } }
  }
});