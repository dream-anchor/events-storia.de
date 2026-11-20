// Gibt abgelaufene Geschenkkorb-Reservierungen frei (Hold -> released, Bestellung -> expired) und
// schickt bei "vor Ort zahlen" die kurze Mail "Reservierung abgelaufen" an den Kunden.
// Aufruf: pg_cron (vorbereitet, auskommentiert in der RPC-Migration) mit dem Service-Role-Key als Bearer.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendGiftMails } from "../_shared/giftMail.ts";
import { reportEdgeError } from "../_shared/reportError.ts";

serve(async (req) => {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // verify_jwt = false (Cron hat keinen Nutzer-JWT) -> nur der Service-Role-Key darf aufrufen
  if (!serviceKey || req.headers.get("Authorization") !== `Bearer ${serviceKey}`) return json({ error: "unauthorized" }, 401);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("gift_sweep_expired_holds");
    if (error) throw new Error(error.message);

    const expired = (data ?? []) as { order_id: string; payment_method: string }[];
    let mailed = 0;
    for (const o of expired) {
      if (o.payment_method !== "on_site") continue; // online: Kunde hat die Stripe-Seite verlassen, keine Mail
      try {
        await sendGiftMails(supabase, o.order_id, "expired");
        mailed++;
      } catch (e) {
        reportEdgeError({ source: "edge:gift-expire-reservations", severity: "warning", message: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ expired: expired.length, mailed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    reportEdgeError({ source: "edge:gift-expire-reservations", severity: "error", message: msg });
    return json({ error: msg }, 500);
  }
});
