/**
 * Geschenkkorb-Shop: Mails (Kunde + Betrieb). Gemeinsam genutzt von create-gift-order (Bestätigungslink "vor Ort"),
 * confirm-gift-reservation (Reservierung bestätigt), handle-stripe-webhook (Zahlung) und gift-expire-reservations
 * (Reservierung abgelaufen, Wiederholungen).
 * Idempotent über gift_orders.optin_mail_sent_at / confirmation_sent_at / expiry_mail_sent_at.
 * Testbestellungen (is_test) gehen nur an die sichere Testadresse (test-safety.ts).
 */
import { sendEmailWithFallback } from "./email-sender.ts";
import { getSafeRecipientEmail, getSafeSubject } from "./test-safety.ts";
import { formatEuro, type DeliveryWindow } from "./giftPricing.ts";
import { GIFT_TEXTS, type Lang } from "./giftLegal.ts";
import { CONFIRM_HOLD_MINUTES, safeShortName } from "./giftConfirm.ts";

// deno-lint-ignore no-explicit-any
type Supa = any;
export type GiftMailKind = "paid" | "reserved" | "expired" | "confirm";

const FROM = "STORIA <info@events-storia.de>";
const SITE = "https://www.events-storia.de";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function fmtDate(d: string, lang: Lang): string {
  const [y, m, day] = d.split("-");
  return lang === "de" ? `${day}.${m}.${y}` : `${day}/${m}/${y}`;
}

interface OrderRow {
  id: string; order_number: string; status: string; payment_method: string; customer_name: string; customer_email: string;
  customer_phone: string | null; handover: "pickup" | "delivery"; handover_date: string; handover_time: string | null;
  delivery_street: string | null; delivery_zip: string | null; delivery_city: string | null; delivery_note: string | null;
  distance_km: number | null; delivery_fee_cents: number; items_total_cents: number; total_cents: number;
  vat_breakdown: { rate: number; gross_cents: number; net_cents: number; vat_cents: number }[] | null;
  gift_message: string | null; age_confirmed_at: string | null; language: Lang; is_test: boolean;
  confirmation_sent_at: string | null; expiry_mail_sent_at: string | null; internal_note: string | null;
}
interface ItemRow { basket_name: string; variant_label: string; qty: number; unit_price_cents: number }

function handoverText(o: OrderRow, lang: Lang, windows: DeliveryWindow[]): string {
  const when = fmtDate(o.handover_date, lang);
  if (o.handover === "pickup") {
    // Zeiten vor 06:00 sind Slots nach Mitternacht (Öffnung bis 01:00): sie gehören zur Nacht NACH dem gewählten Tag
    const night = (o.handover_time ?? "99") < "06:00";
    if (night) {
      return lang === "de"
        ? `Abholung am ${when} um ${esc(o.handover_time)} Uhr (nach Mitternacht, also in der Nacht auf den Folgetag), STORIA, Karlstraße 47a, 80333 München`
        : `Pickup on ${when} at ${esc(o.handover_time)} (after midnight, i.e. during the night into the next day), STORIA, Karlstraße 47a, 80333 Munich`;
    }
    return lang === "de"
      ? `Abholung am ${when} um ${esc(o.handover_time)} Uhr, STORIA, Karlstraße 47a, 80333 München`
      : `Pickup on ${when} at ${esc(o.handover_time)}, STORIA, Karlstraße 47a, 80333 Munich`;
  }
  const w = windows.find((x) => x.key === o.handover_time);
  const win = w ? (lang === "de" ? w.label_de : w.label_en) : o.handover_time ?? "";
  const addr = `${o.delivery_street}, ${o.delivery_zip} ${o.delivery_city}`;
  return lang === "de" ? `Lieferung am ${when}, ${esc(win)}, an ${esc(addr)}` : `Delivery on ${when}, ${esc(win)}, to ${esc(addr)}`;
}

function itemsTable(items: ItemRow[], o: OrderRow, lang: Lang): string {
  const rows = items
    .map((i) => `<tr><td style="padding:4px 8px">${i.qty} × ${esc(i.basket_name)} – ${esc(i.variant_label)}</td><td style="padding:4px 8px;text-align:right">${formatEuro(i.unit_price_cents * i.qty, lang)}</td></tr>`)
    .join("");
  const delivery = o.handover === "delivery"
    ? `<tr><td style="padding:4px 8px">${lang === "de" ? "Lieferung" : "Delivery"}${o.distance_km ? ` (${Number(o.distance_km).toFixed(1)} km)` : ""}</td><td style="padding:4px 8px;text-align:right">${formatEuro(o.delivery_fee_cents, lang)}</td></tr>`
    : "";
  const vat = (o.vat_breakdown ?? [])
    .map((v) => `<div style="font-size:12px;color:#666">${lang === "de" ? "darin enthaltene MwSt." : "VAT included"} ${v.rate} %: ${formatEuro(v.vat_cents, lang)}</div>`)
    .join("");
  return `<table style="border-collapse:collapse;width:100%;max-width:560px">${rows}${delivery}
    <tr><td style="padding:8px;border-top:1px solid #ccc"><b>${lang === "de" ? "Gesamtsumme inkl. MwSt." : "Total incl. VAT"}</b></td><td style="padding:8px;border-top:1px solid #ccc;text-align:right"><b>${formatEuro(o.total_cents, lang)}</b></td></tr></table>${vat}`;
}

function wrap(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px">${body}
  <p style="font-size:12px;color:#666;margin-top:24px">Speranza GmbH · STORIA · Karlstraße 47a · 80333 München · info@events-storia.de</p></div>`;
}

/**
 * Double-Opt-in-Mail: enthält bewusst KEINEN frei wählbaren Text des Absenders (kein Spam-Relais): nur gekürzter,
 * bereinigter Vorname-Anteil, unsere Produktnamen, validiertes Datum/Zeit und den Link. Keine Notiz, keine Adresse, keine Grußkarte.
 */
function optinMail(o: OrderRow, items: ItemRow[], confirmUrl: string): { subject: string; html: string } {
  const lang = o.language;
  const de = lang === "de";
  const name = safeShortName(o.customer_name);
  const list = items.map((i) => `<li>${i.qty} × ${esc(i.basket_name)} – ${esc(i.variant_label)}</li>`).join("");
  return {
    subject: de ? "Bitte bestätigen: Ihre Geschenkkorb-Reservierung bei STORIA" : "Please confirm: your gift basket reservation at STORIA",
    html: wrap(`<p>${de ? "Guten Tag" : "Hello"}${name ? ` ${esc(name)}` : ""},</p>
      <p>${GIFT_TEXTS.optinIntro[lang]}</p>
      <ul>${list}</ul>
      <p>${de ? "Abholung" : "Pickup"}: ${fmtDate(o.handover_date, lang)}, ${esc(o.handover_time)}${de ? " Uhr" : ""}</p>
      <p style="margin:24px 0"><a href="${esc(confirmUrl)}" style="background:#9a1b1f;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${de ? "Reservierung bestätigen" : "Confirm reservation"}</a></p>
      <p style="font-size:13px">${GIFT_TEXTS.optinHint[lang].replace("30", String(CONFIRM_HOLD_MINUTES))}</p>`),
  };
}

function customerMail(kind: GiftMailKind, o: OrderRow, items: ItemRow[], windows: DeliveryWindow[]): { subject: string; html: string } {
  const lang = o.language;
  const de = lang === "de";
  const links = `<p style="font-size:13px"><a href="${SITE}/agb/">${de ? "AGB" : "Terms"}</a> · <a href="${SITE}/widerrufsbelehrung/">${de ? "Widerrufsbelehrung" : "Withdrawal information"}</a></p>`;
  const common = `${itemsTable(items, o, lang)}
    <p><b>${de ? "Übergabe" : "Handover"}:</b> ${handoverText(o, lang, windows)}</p>
    ${o.gift_message ? `<p><b>${de ? "Grußkarte" : "Gift card message"}:</b><br>${esc(o.gift_message).replace(/\n/g, "<br>")}</p>` : ""}
    <p style="font-size:13px">${GIFT_TEXTS.age[lang]}</p><p style="font-size:13px">${GIFT_TEXTS.withdrawal[lang]}</p>${links}`;

  if (kind === "expired") {
    return {
      subject: de ? `Ihre Reservierung ${o.order_number} ist abgelaufen` : `Your reservation ${o.order_number} has expired`,
      html: wrap(`<p>${de ? "Guten Tag" : "Hello"} ${esc(o.customer_name)},</p>
        <p>${de
          ? `Ihre Reservierung des Geschenkkorbs ${esc(o.order_number)} (Abholung am ${fmtDate(o.handover_date, lang)}) wurde nicht abgeholt und ist abgelaufen. Der Korb ist wieder im Verkauf.`
          : `Your reservation of gift basket ${esc(o.order_number)} (pickup on ${fmtDate(o.handover_date, lang)}) was not collected and has expired. The basket is back on sale.`}</p>
        <p>${de ? "Gerne können Sie jederzeit neu bestellen:" : "You are welcome to order again at any time:"} <a href="${SITE}/geschenkkoerbe/bestellung">${SITE}/geschenkkoerbe/bestellung</a></p>`),
    };
  }
  if (kind === "reserved") {
    return {
      subject: de ? `Ihre Reservierung: STORIA Geschenkkorb ${o.order_number}` : `Your reservation: STORIA gift basket ${o.order_number}`,
      html: wrap(`<p>${de ? "Guten Tag" : "Hello"} ${esc(o.customer_name)},</p>
        <p>${de ? "vielen Dank für Ihre Bestellung. Wir haben Ihren Geschenkkorb reserviert. Die Bezahlung erfolgt bei der Abholung vor Ort." : "thank you for your order. We have reserved your gift basket. Payment is made on site at pickup."}</p>
        <p style="font-size:13px">${GIFT_TEXTS.onSiteHint[lang]}</p>
        <p>${de ? "Bestellnummer" : "Order number"}: <b>${esc(o.order_number)}</b></p>${common}`),
    };
  }
  return {
    subject: de ? `Bestellbestätigung: STORIA Geschenkkorb ${o.order_number}` : `Order confirmation: STORIA gift basket ${o.order_number}`,
    html: wrap(`<p>${de ? "Guten Tag" : "Hello"} ${esc(o.customer_name)},</p>
      <p>${de ? "vielen Dank für Ihre Bestellung und Zahlung. Hiermit bestätigen wir Ihre Bestellung." : "thank you for your order and payment. We hereby confirm your order."}</p>
      <p>${de ? "Bestellnummer" : "Order number"}: <b>${esc(o.order_number)}</b></p>${common}`),
  };
}

function operatorMail(kind: GiftMailKind, o: OrderRow, items: ItemRow[], windows: DeliveryWindow[]): { subject: string; html: string } {
  const when = fmtDate(o.handover_date, "de");
  const label = o.handover === "pickup" ? "Abholung" : "Lieferung";
  const subject =
    kind === "reserved" ? `RESERVIERT (Zahlung vor Ort): Neuer Geschenkkorb ${o.order_number} – ${label} ${when}`
    : kind === "expired" ? `ABGELAUFEN: Reservierung Geschenkkorb ${o.order_number} nicht abgeholt (${when})`
    : `BEZAHLT: Neuer Geschenkkorb ${o.order_number} – ${label} ${when}`;
  return {
    subject,
    html: wrap(`<p><b>${esc(subject)}</b></p>${itemsTable(items, o, "de")}
      <p><b>Kunde:</b> ${esc(o.customer_name)}, ${esc(o.customer_email)}${o.customer_phone ? `, ${esc(o.customer_phone)}` : ""}</p>
      <p><b>Übergabe:</b> ${handoverText(o, "de", windows)}${o.delivery_note ? `<br>Hinweis: ${esc(o.delivery_note)}` : ""}</p>
      ${o.gift_message ? `<p><b>Grußkarte:</b><br>${esc(o.gift_message).replace(/\n/g, "<br>")}</p>` : ""}
      <p><b>Altersbestätigung (ab 16):</b> ${o.age_confirmed_at ? "ja, " + esc(o.age_confirmed_at) : "NEIN"}</p>
      ${o.internal_note ? `<p style="color:#b00"><b>ACHTUNG:</b> ${esc(o.internal_note)}</p>` : ""}
      ${o.is_test ? "<p><b>TESTBESTELLUNG</b></p>" : ""}`),
  };
}

export interface SendGiftMailOptions {
  /** nur kind "confirm": vollständiger Bestätigungslink inkl. Klartext-Token (nirgends gespeichert) */
  confirmUrl?: string;
}

export async function sendGiftMails(supabase: Supa, orderId: string, kind: GiftMailKind, opts: SendGiftMailOptions = {}): Promise<void> {
  const { data: o } = await supabase.from("gift_orders").select("*").eq("id", orderId).maybeSingle();
  if (!o) { console.error("[GIFT-MAIL] order not found", orderId); return; }
  const sentCol = kind === "expired" ? "expiry_mail_sent_at" : kind === "confirm" ? "optin_mail_sent_at" : "confirmation_sent_at";
  if (kind === "confirm" && !opts.confirmUrl) throw new Error("confirmUrl missing");
  if (o[sentCol]) return; // idempotent

  const { data: items } = await supabase.from("gift_order_items").select("basket_name, variant_label, qty, unit_price_cents").eq("order_id", orderId).order("created_at");
  const { data: settings } = await supabase.from("gift_settings").select("order_notify_email, delivery_windows").eq("id", 1).maybeSingle();
  const windows: DeliveryWindow[] = Array.isArray(settings?.delivery_windows) ? settings.delivery_windows : [];
  const notify = settings?.order_notify_email || "info@events-storia.de";
  const order = o as OrderRow;

  // Zuerst als gesendet markieren (bedingt), damit parallele Webhook-Wiederholungen keine Doppelmails auslösen
  const { data: claimed } = await supabase.from("gift_orders").update({ [sentCol]: new Date().toISOString() }).eq("id", orderId).is(sentCol, null).select("id");
  if (!claimed || claimed.length === 0) return;

  const cust = kind === "confirm" ? optinMail(order, items ?? [], opts.confirmUrl!) : customerMail(kind, order, items ?? [], windows);
  try {
    const r = await sendEmailWithFallback({
      from: FROM, to: getSafeRecipientEmail(order.customer_email, order.is_test), replyTo: "info@events-storia.de",
      subject: getSafeSubject(cust.subject, order.is_test), html: cust.html,
    });
    if (!r.success) throw new Error(r.resendError || r.smtpError || "send failed");
  } catch (e) {
    console.error("[GIFT-MAIL] customer mail failed", e instanceof Error ? e.message : e);
    await supabase.from("gift_orders").update({ [sentCol]: null }).eq("id", orderId); // erneuter Versuch bei Retry möglich
    throw e;
  }

  if (kind === "confirm") return; // Bestätigungslink geht nur an den Kunden; der Betrieb erfährt erst von der bestätigten Reservierung
  const op = operatorMail(kind, order, items ?? [], windows);
  try {
    await sendEmailWithFallback({ from: FROM, to: getSafeRecipientEmail(notify, order.is_test), subject: getSafeSubject(op.subject, order.is_test), html: op.html });
  } catch (e) {
    console.error("[GIFT-MAIL] operator mail failed (non-fatal)", e instanceof Error ? e.message : e);
  }
}
