/** Betreiber-Alarm für den Geschenkkorb-Shop (Ablauf-Sweep): Mail an gift_settings.order_notify_email + System-Health-Eintrag. */
import { sendEmailWithFallback } from "./email-sender.ts";
import { reportEdgeError } from "./reportError.ts";

// deno-lint-ignore no-explicit-any
type Supa = any;

export async function sendGiftOperatorAlert(supabase: Supa, subject: string, html: string): Promise<void> {
  reportEdgeError({ source: "edge:gift-expire-reservations", severity: "error", message: subject });
  try {
    const { data } = await supabase.from("gift_settings").select("order_notify_email").eq("id", 1).maybeSingle();
    await sendEmailWithFallback({
      from: "STORIA <info@events-storia.de>",
      to: data?.order_notify_email || "info@events-storia.de",
      subject: `ALARM Geschenkkorb: ${subject}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px">${html}</div>`,
    });
  } catch (e) {
    console.error("[GIFT-ALERT] mail failed", e instanceof Error ? e.message : e);
  }
}
