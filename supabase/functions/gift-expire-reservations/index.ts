// Ablauf-Sweep des Geschenkkorb-Shops (pg_cron alle 10 Min, siehe RPC-Migration):
//  1. gift_sweep_expired_holds: abgelaufene Holds freigeben, Bestellungen verfallen lassen (unbestätigte "vor Ort"-Reservierungen
//     nach 30 Min, nicht abgeholte nach Ladenschluss, nicht bezahlte Checkouts). Läuft zusätzlich als reines SQL-Cron alle 5 Min.
//  2. Mail "Reservierung abgelaufen" NUR für bestätigte "vor Ort"-Reservierungen (zustandsgesteuert: expiry_mail_sent_at).
//  3. Wiederholung fehlgeschlagener Mails und Rechnungen, je Bestellung max. 3 Versuche (mail_attempts / invoice_attempts),
//     danach Betreiber-Alarm: Bestätigungslink-Mail (neuer Token), Bestell-/Reservierungsbestätigung, LexOffice-Rechnung
//     (verwaiste `pending:<ms>`-Ansprüche älter 10 Min werden übernommen, siehe ensureGiftInvoice).
// Aufruf: pg_cron ohne Secret (Lovable darf keine Migrationen mit Vault-Zugriff einspielen). Ohne Service-Role-Key bzw.
// optionales GIFT_CRON_SECRET läuft der Sweep höchstens alle 4 Minuten (gift_claim_cron_run); er ist idempotent und
// Wiederholungen sind je Bestellung auf 3 begrenzt, ein fremder Aufruf kann also nichts Zusätzliches auslösen.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendGiftMails } from "../_shared/giftMail.ts";
import { confirmUrl, generateConfirmToken, hashConfirmToken } from "../_shared/giftConfirm.ts";
import { ensureGiftInvoice, isStaleInvoiceClaim } from "../_shared/giftInvoice.ts";
import { stockConflictAlert } from "../_shared/giftHoldWindow.ts";
import { sendGiftOperatorAlert } from "../_shared/giftAlert.ts";
import { reportEdgeError } from "../_shared/reportError.ts";

const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 10 * 60_000;
const SITE = "https://www.events-storia.de";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("GIFT_CRON_SECRET") ?? "";
  // verify_jwt = false (Cron hat keinen Nutzer-JWT). Mit Cron-Secret oder Service-Role-Key sofort, sonst gedrosselt.
  const okSecret = cronSecret !== "" && safeEqual(req.headers.get("x-gift-cron-secret") ?? "", cronSecret);
  const okBearer = safeEqual(req.headers.get("Authorization") ?? "", `Bearer ${serviceKey}`);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
  if (!okSecret && !okBearer) {
    const { data: claimed, error: claimErr } = await supabase.rpc("gift_claim_cron_run", { p_name: "gift-expire-reservations", p_min_seconds: 240 });
    if (claimErr) return json({ error: "claim_failed" }, 500);
    if (claimed !== true) return json({ skipped: "too_soon" }, 429);
  }
  const stats = { expired: 0, expiry_mails: 0, mail_retries: 0, optin_retries: 0, invoice_retries: 0, alerts: 0 };
  const errors: string[] = [];
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) {
      const msg = `${name}: ${e instanceof Error ? e.message : String(e)}`;
      errors.push(msg);
      reportEdgeError({ source: "edge:gift-expire-reservations", severity: "error", message: msg });
    }
  };
  const alert = async (subject: string, html: string) => { stats.alerts++; await sendGiftOperatorAlert(supabase, subject, html); };
  const cutoff = new Date(Date.now() - RETRY_AFTER_MS).toISOString();

  // 0) Zurückgestellte Vor-Ort-Holds ins 2-Tage-Fenster aktivieren (Z10). Eigener Schritt, damit Fehler über reportEdgeError
  //    laufen (der Sweep selbst verschluckt sie nur als WARNING). Überbuchungen setzen stock_conflict_at (Schritt 1b alarmiert).
  await step("activate", async () => {
    const { error } = await supabase.rpc("gift_activate_deferred_holds");
    if (error) throw new Error(error.message);
  });

  // 1) Sweep
  await step("sweep", async () => {
    const { data, error } = await supabase.rpc("gift_sweep_expired_holds");
    if (error) throw new Error(error.message);
    stats.expired = (data ?? []).length;
  });

  // 1b) Überbuchung beim Eintritt ins 2-Tage-Fenster bzw. bei "Bereit" (gift_activate_*): NICHT still lösen, Betreiber alarmieren.
  //     Der Hold steht trotzdem; die Bestellung trägt stock_conflict_at (Admin-Badge). Je Bestellung genau einmal, EINE Sammelmail
  //     je Lauf. Der Marker wird atomar gesetzt (nur bei genau einer geänderten Zeile zählt die Bestellung). Verschwindet der
  //     Konflikt (Nachpacken), setzt die DB beide Marker zurück und ein neuer Konflikt alarmiert wieder.
  await step("stock-conflict", async () => {
    const { data, error } = await supabase.from("gift_orders").select("id, order_number, handover_date")
      .not("stock_conflict_at", "is", null).is("stock_conflict_notified_at", null).in("status", ["reserved", "ready"]).limit(25);
    if (error) throw new Error(error.message);
    const claimed: { order_number: string; handover_date: string }[] = [];
    for (const o of data ?? []) {
      const { data: upd, error: markErr } = await supabase.from("gift_orders").update({ stock_conflict_notified_at: new Date().toISOString() })
        .eq("id", o.id).is("stock_conflict_notified_at", null).select("id");
      if (!markErr && upd?.length === 1) claimed.push(o);
    }
    if (claimed.length > 0) {
      const a = stockConflictAlert(claimed);
      await alert(a.subject, a.html);
    }
  });

  // 2) "Reservierung abgelaufen"-Mail: nur bestätigte vor-Ort-Reservierungen (unbestätigte haben nie eine Zusage bekommen)
  await step("expiry-mails", async () => {
    const { data, error } = await supabase.from("gift_orders").select("id")
      .eq("status", "expired").eq("payment_method", "on_site").not("confirmed_at", "is", null).is("expiry_mail_sent_at", null)
      .gte("updated_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(50);
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      try { await sendGiftMails(supabase, o.id, "expired"); stats.expiry_mails++; } catch (e) {
        reportEdgeError({ source: "edge:gift-expire-reservations", severity: "warning", message: e instanceof Error ? e.message : String(e) });
      }
    }
  });

  // 3a) Bestell-/Reservierungsbestätigung wiederholen
  await step("confirmation-mail-retry", async () => {
    const { data, error } = await supabase.from("gift_orders")
      .select("id, order_number, payment_method, paid_at, confirmed_at, mail_attempts")
      .in("status", ["reserved", "paid", "ready", "handed_over"]).is("confirmation_sent_at", null).lt("mail_attempts", MAX_ATTEMPTS)
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(50);
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      const since = o.payment_method === "online" ? o.paid_at : o.confirmed_at;
      if (!since || since > cutoff) continue; // erst nach 10 Min (laufende Erstzustellung nicht stören)
      const attempts = o.mail_attempts + 1;
      await supabase.from("gift_orders").update({ mail_attempts: attempts }).eq("id", o.id);
      try {
        await sendGiftMails(supabase, o.id, o.payment_method === "online" ? "paid" : "reserved");
        stats.mail_retries++;
      } catch (e) {
        if (attempts >= MAX_ATTEMPTS) {
          await supabase.from("gift_orders").update({ alert_sent_at: new Date().toISOString() }).eq("id", o.id);
          await alert(`Bestätigungsmail ${o.order_number} nach ${MAX_ATTEMPTS} Versuchen nicht zustellbar`,
            `<p>${esc(e instanceof Error ? e.message : String(e))}</p><p>Bitte den Kunden manuell informieren (Bestellung ${esc(o.order_number)}).</p>`);
        }
      }
    }
  });

  // 3b) Bestätigungslink-Mail (Double-Opt-in) wiederholen: neuer Token, weil der alte nur als Hash existiert
  await step("optin-mail-retry", async () => {
    const { data, error } = await supabase.from("gift_orders")
      .select("id, order_number, language, mail_attempts")
      .eq("status", "awaiting_confirmation").is("optin_mail_sent_at", null).lt("mail_attempts", MAX_ATTEMPTS)
      .lt("created_at", new Date(Date.now() - 2 * 60_000).toISOString()).limit(50);
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      const attempts = o.mail_attempts + 1;
      const token = generateConfirmToken();
      await supabase.from("gift_orders").update({ mail_attempts: attempts, confirm_token_hash: await hashConfirmToken(token) }).eq("id", o.id);
      try {
        await sendGiftMails(supabase, o.id, "confirm", { confirmUrl: confirmUrl(SITE, o.language, token) });
        stats.optin_retries++;
      } catch (e) {
        if (attempts >= MAX_ATTEMPTS) {
          await supabase.from("gift_orders").update({ alert_sent_at: new Date().toISOString() }).eq("id", o.id);
          await alert(`Bestätigungslink-Mail ${o.order_number} nach ${MAX_ATTEMPTS} Versuchen nicht zustellbar`,
            `<p>${esc(e instanceof Error ? e.message : String(e))}</p><p>Die Reservierung verfällt von selbst (30 Min); bitte ggf. beim Kunden nachfragen.</p>`);
        }
      }
    }
  });

  // 3c) Rechnung nachholen (bezahlt, echt, ohne Rechnung bzw. mit verwaistem Anspruch)
  await step("invoice-retry", async () => {
    const { data, error } = await supabase.from("gift_orders").select("*")
      .in("status", ["paid", "ready", "handed_over"]).eq("is_test", false).lt("paid_at", cutoff).lt("invoice_attempts", MAX_ATTEMPTS)
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(25);
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      if (o.lexoffice_invoice_id && !isStaleInvoiceClaim(o.lexoffice_invoice_id)) continue; // Rechnung existiert / wird gerade erzeugt
      const res = await ensureGiftInvoice(supabase, o);
      if (res.outcome === "created") { stats.invoice_retries++; continue; }
      if (res.outcome === "claimed_elsewhere") continue;
      if (res.outcome === "no_vat_split") {
        // Retry sinnlos; der Webhook hat bereits alarmiert ("Rechnung manuell erstellen")
        await supabase.from("gift_orders").update({ invoice_attempts: MAX_ATTEMPTS }).eq("id", o.id);
        continue;
      }
      const attempts = o.invoice_attempts + 1;
      await supabase.from("gift_orders").update({ invoice_attempts: attempts }).eq("id", o.id);
      if (attempts >= MAX_ATTEMPTS) {
        await supabase.from("gift_orders").update({ alert_sent_at: new Date().toISOString() }).eq("id", o.id);
        await alert(`Rechnung ${o.order_number} nach ${MAX_ATTEMPTS} Versuchen nicht erstellt`,
          `<p>${esc(res.error)}</p><p>Bitte die Rechnung für ${esc(o.order_number)} manuell in LexOffice erstellen.</p>`);
      }
    }
  });

  if (errors.length > 0) return json({ ...stats, errors }, 500);
  return json(stats);
});
