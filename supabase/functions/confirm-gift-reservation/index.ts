// Double-Opt-in "Zahlung vor Ort": löst den Bestätigungslink aus der Mail ein (POST {token}, ausgelöst durch einen
// Klick auf der Bestätigungsseite, nicht durch bloßes Öffnen des Links: Mail-Scanner/Link-Previews bestätigen so nichts).
// Token einmalig: gift_confirm_reservation (RPC) setzt awaiting_confirmation -> reserved und verlängert den Hold bis Ladenschluss.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { hashConfirmToken, isConfirmToken } from "../_shared/giftConfirm.ts";
import { clientIp, rateLimited } from "../_shared/giftRateLimit.ts";
import { sendGiftMails } from "../_shared/giftMail.ts";
import { reportEdgeError } from "../_shared/reportError.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (rateLimited(`confirm:${clientIp(req)}`, 20, 60_000)) return json({ error: "rate_limited" }, 429);
    const body = await req.json().catch(() => ({}));
    if (!isConfirmToken(body?.token)) return json({ status: "invalid" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("gift_confirm_reservation", { p_token_hash: await hashConfirmToken(body.token) });
    if (error) throw new Error(`gift_confirm_reservation: ${error.message}`);
    const status = String(data?.status ?? "invalid");

    if (status === "confirmed" && data?.order_id) {
      // Reservierungsbestätigung an Kunde + Betrieb; Fehler blockiert nicht (Reservierung steht, der Sweep wiederholt die Mail)
      try {
        await sendGiftMails(supabase, data.order_id, "reserved");
      } catch (e) {
        reportEdgeError({ source: "edge:confirm-gift-reservation:mail", severity: "warning", message: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CONFIRM-GIFT-RESERVATION]", msg);
    reportEdgeError({ source: "edge:confirm-gift-reservation", severity: "error", message: msg });
    return json({ error: "internal_error" }, 500);
  }
});
