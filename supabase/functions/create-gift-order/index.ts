// Geschenkkorb-Bestellung: EINZIGE autoritative Stelle für Preise, Liefergebühr, Termin und Bestand.
// Vertraut nie Client-Beträgen: Körbe/Preise/Bestand kommen aus der DB, die Liefergebühr wird hier NEU
// über OpenRouteService berechnet (nicht aus gift-delivery-quote übernommen).
// Zahlart online: Bestand-Hold + Stripe Checkout (30 Min). Zahlart "vor Ort" (nur Abholung): Double-Opt-in statt
// CAPTCHA (Inhaber 20.11.2026): Bestellung 'awaiting_confirmation' mit Hold nur 30 Min + Bestätigungsmail; erst der Klick
// auf den Link (confirm-gift-reservation) macht daraus 'reserved' mit Hold bis Ladenschluss des Abholtags.
// Missbrauchsschutz: Honeypot-Feld, Mindest-Ausfüllzeit, Limits je E-Mail/IP (DB-gestützt), Mengen- und Terminlimits.
// Ablauf Webhook/Verfall: handle-stripe-webhook (Zahlung, expired) und gift-expire-reservations (Sweep, Mails).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  addDays,
  berlinParts,
  checkSchedule,
  computeDeliveryFeeCents,
  computeVatBreakdown,
  isValidVatSplit,
  roundDistanceKm,
  MAX_QTY_PER_LINE,
  MAX_QTY_PER_ORDER,
  type VatShare,
} from "../_shared/giftPricing.ts";
import { resolveDistanceKm, RoutingError } from "../_shared/giftRouting.ts";
import { clientIp, hashIp, rateLimited } from "../_shared/giftRateLimit.ts";
import { CONFIRM_HOLD_MINUTES, checkFormTiming, confirmUrl, generateConfirmToken, hashConfirmToken } from "../_shared/giftConfirm.ts";
import { loadBlackoutDates, loadGiftSettings } from "../_shared/giftSettings.ts";
import { GIFT_AGB_VERSION } from "../_shared/giftLegal.ts";
import { sendGiftMails } from "../_shared/giftMail.ts";
import { reportEdgeError } from "../_shared/reportError.ts";

const log = (s: string, d?: unknown) => console.log(`[CREATE-GIFT-ORDER] ${s}${d ? " " + JSON.stringify(d) : ""}`);

class HttpError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?events-storia\.de$/, /^http:\/\/localhost:\d+$/, /^https:\/\/[a-z0-9-]+\.lovable(project)?\.(app|com)$/];
const DEFAULT_ORIGIN = "https://www.events-storia.de";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

interface OrderInput {
  items: { variant_id: string; qty: number }[];
  customer: { name: string; email: string; phone: string };
  handover: "pickup" | "delivery";
  date: string;
  time: string;
  address: { street: string; zip: string; city: string; note: string };
  payment_method: "online" | "on_site";
  gift_message: string;
  language: "de" | "en";
  /** Honeypot: unsichtbares Feld, echte Nutzer lassen es leer; gefüllt = Bot (stille Scheinbestätigung, nichts wird angelegt) */
  honeypot: string;
  /** Client-Zeitstempel (ms), wann das Formular geöffnet wurde; Mindest-Ausfüllzeit wird serverseitig geprüft */
  form_started_at: unknown;
}

/** Zahlung "vor Ort" (Reservierung ohne Anzahlung): Missbrauchsgrenzen (Mail-Spam-Relais, Bestandsblockade). */
const ON_SITE_MAX_DAYS_AHEAD = 14;
const ON_SITE_MAX_QTY = 5;
/** Offene (noch gültig gehaltene) Bestellungen je E-Mail bzw. je IP, getrennt für "vor Ort" und Online-Checkout (max. 2). */
const MAX_OPEN_PER_EMAIL = 2;
const MAX_OPEN_PER_IP = 2;
/** Stripe-Session = Erstellung + 31 Min (Minimum 30); der Hold muss sie überdauern. */
const STRIPE_SESSION_MINUTES = 31;
const MIN_HOLD_MINUTES = 36;

function parseInput(b: Record<string, unknown>): OrderInput {
  const bad = (field: string) => new HttpError(400, "invalid_input", { field });
  if (b.age_confirmed !== true) throw new HttpError(400, "age_not_confirmed");
  if (b.agb_accepted !== true) throw new HttpError(400, "agb_not_accepted");

  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (rawItems.length === 0 || rawItems.length > 6) throw bad("items");
  const items = rawItems.map((i) => {
    const it = i as Record<string, unknown>;
    const qty = Number(it.qty);
    if (typeof it.variant_id !== "string" || !UUID_RE.test(it.variant_id)) throw bad("items.variant_id");
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) throw bad("items.qty");
    return { variant_id: it.variant_id.toLowerCase(), qty };
  });
  // gleiche Variante zusammenfassen
  const merged = new Map<string, number>();
  for (const it of items) merged.set(it.variant_id, (merged.get(it.variant_id) ?? 0) + it.qty);
  const mergedItems = [...merged.entries()].map(([variant_id, qty]) => ({ variant_id, qty }));
  if (mergedItems.some((i) => i.qty > MAX_QTY_PER_LINE) || mergedItems.reduce((s, i) => s + i.qty, 0) > MAX_QTY_PER_ORDER) {
    throw new HttpError(400, "quantity_limit", { max_per_order: MAX_QTY_PER_ORDER });
  }

  const c = (b.customer ?? {}) as Record<string, unknown>;
  const customer = { name: clean(c.name, 120), email: clean(c.email, 254).toLowerCase(), phone: clean(c.phone, 40) };
  if (customer.name.length < 2) throw bad("customer.name");
  if (!EMAIL_RE.test(customer.email)) throw bad("customer.email");

  const handover = b.handover === "delivery" ? "delivery" : b.handover === "pickup" ? "pickup" : null;
  if (!handover) throw bad("handover");
  const a = (b.address ?? {}) as Record<string, unknown>;
  const address = { street: clean(a.street, 120), zip: clean(a.zip, 10), city: clean(a.city, 80), note: clean(a.note, 200) };
  if (handover === "delivery") {
    if (address.street.length < 3 || !/\d/.test(address.street)) throw bad("address.street");
    if (!/^\d{5}$/.test(address.zip)) throw bad("address.zip");
    if (address.city.length < 2) throw bad("address.city");
    if (customer.phone.length < 5) throw bad("customer.phone"); // Fahrer braucht eine Nummer
  }

  const payment_method = b.payment_method === "on_site" ? "on_site" : "online";
  if (payment_method === "on_site" && handover !== "pickup") throw new HttpError(400, "on_site_only_pickup");

  return {
    items: mergedItems,
    customer,
    handover,
    date: clean(b.date, 10),
    time: clean(b.time, 20),
    address,
    payment_method,
    gift_message: clean(b.gift_message, 500),
    language: b.language === "en" ? "en" : "de",
    honeypot: typeof b.website === "string" ? b.website.trim() : "",
    form_started_at: b.form_started_at,
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let orderId: string | null = null;
  let holdPlaced = false;

  try {
    if (rateLimited(`order:${clientIp(req)}`, 8, 60_000)) throw new HttpError(429, "rate_limited");

    const input = parseInput(await req.json().catch(() => ({})));
    const now = new Date();

    // Bot-Schutz ohne CAPTCHA: Honeypot gefüllt -> stille Scheinbestätigung (Bot lernt nichts), nichts wird angelegt
    if (input.honeypot) {
      log("honeypot hit");
      return json({ awaiting_confirmation: true, order_number: null, total_cents: 0 });
    }
    // Mindest-Ausfüllzeit (nur "vor Ort", dort kostet ein Bot-Treffer Bestand + eine Mail): zu schnell -> abgelehnt
    if (input.payment_method === "on_site") {
      const timing = checkFormTiming(input.form_started_at, now.getTime());
      if (timing !== "ok") throw new HttpError(400, timing === "too_fast" ? "form_too_fast" : "form_invalid");
    }

    // Lazy-Sweep: abgelaufene Holds/Reservierungen freigeben, auch wenn der Cron noch nicht lief (Fehler egal)
    await supabase.rpc("gift_sweep_expired_holds").then(() => undefined, () => undefined);
    // Testmodus NUR über den Stripe-Testschlüssel (sk_test_). Nie über Client-Angaben oder die eingetippte Adresse:
    // sonst könnte ein Kunde sich "testen" und Rechnung/Gate umgehen.
    const isTest = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_");

    // Livegang-Gate: solange die Rechtstexte nicht freigegeben sind, nimmt der Server keine echten Bestellungen an
    if (!isTest && Deno.env.get("GIFT_LEGAL_APPROVED") !== "true") throw new HttpError(403, "not_available");

    // ── 1) Katalog aus der DB (nie aus dem Client) ───────────────────────────
    const { data: variants, error: vErr } = await supabase
      .from("gift_basket_variants")
      .select("id, key, label_de, label_en, active, deleted_at, price_delta_cents, gift_baskets!inner(id, name_de, name_en, price_cents, vat_split, active, deleted_at)")
      .in("id", input.items.map((i) => i.variant_id));
    if (vErr) throw new Error(`catalog_load_failed: ${vErr.message}`);

    // deno-lint-ignore no-explicit-any
    const byId = new Map<string, any>((variants ?? []).map((v: any) => [v.id, v]));
    const lines = input.items.map((it) => {
      const v = byId.get(it.variant_id);
      const b = v?.gift_baskets;
      if (!v || !v.active || v.deleted_at || !b || !b.active || b.deleted_at) {
        throw new HttpError(409, "sold_out", { variant_id: it.variant_id });
      }
      return {
        basket_id: b.id as string,
        variant_id: v.id as string,
        qty: it.qty,
        unit_price_cents: (b.price_cents as number) + (v.price_delta_cents as number),
        vat_split: (isValidVatSplit(b.vat_split) ? b.vat_split : null) as VatShare[] | null,
        basket_name: `${b.name_de}`,
        variant_label: `${v.label_de}`,
        basket_name_en: `${b.name_en}`,
        variant_label_en: `${v.label_en}`,
      };
    });
    const itemsTotal = lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0);

    // ── 2) Termin gegen die Regeln ───────────────────────────────────────────
    const settings = await loadGiftSettings(supabase);
    const blackout = await loadBlackoutDates(supabase, input.date >= "2000-01-01" ? input.date : "2000-01-01");
    const sched = checkSchedule(input.handover, input.date, input.time, now, settings.schedule, blackout);
    if (!sched.ok) throw new HttpError(400, "invalid_schedule", { reason: sched.error });

    // ── 2b) Missbrauchsgrenzen (vor jeder Schreiboperation) ───────────────────
    // IP nur gehasht speichern; gilt für beide Zahlwege (Online-Holds blockieren ebenfalls Bestand, 40 Min)
    const ipHash = await hashIp(clientIp(req), Deno.env.get("GIFT_IP_PEPPER") ?? "");
    if (input.payment_method === "on_site") {
      const today = berlinParts(now).date;
      if (input.date > addDays(today, ON_SITE_MAX_DAYS_AHEAD)) throw new HttpError(400, "on_site_too_far_ahead", { max_days: ON_SITE_MAX_DAYS_AHEAD });
      if (input.items.reduce((s, i) => s + i.qty, 0) > ON_SITE_MAX_QTY) throw new HttpError(400, "on_site_quantity_limit", { max_qty: ON_SITE_MAX_QTY });
    }

    // ── 3) Liefergebühr NEU berechnen (zweiter ORS-Aufruf) ───────────────────
    let distanceKm: number | null = null;
    let deliveryFee = 0;
    if (input.handover === "delivery") {
      try {
        distanceKm = await resolveDistanceKm(input.address, settings.origin, Deno.env.get("OPENROUTE_API_KEY"));
      } catch (e) {
        if (e instanceof RoutingError) {
          // Nie einen geschätzten Preis berechnen: Lieferung nicht bestellbar
          throw new HttpError(e.code === "routing_unavailable" || e.code === "not_configured" ? 503 : 400, e.code);
        }
        throw e;
      }
      distanceKm = roundDistanceKm(distanceKm); // Gebühr = f(gerundete, gespeicherte Strecke): reproduzierbar auf den Cent
      deliveryFee = computeDeliveryFeeCents(distanceKm, settings.tariff);
    }
    const total = itemsTotal + deliveryFee;
    const vatBreakdown = computeVatBreakdown(
      lines.map((l) => ({ unit_price_cents: l.unit_price_cents, qty: l.qty, vat_split: l.vat_split })),
      input.handover === "delivery" ? { fee_cents: deliveryFee, vat_rate: settings.delivery_vat_rate } : null,
    );

    // ── 4) Bestellung anlegen (pending bzw. awaiting_confirmation) ───────────
    const onSite = input.payment_method === "on_site";
    const confirmToken = onSite ? generateConfirmToken() : null;
    const { data: order, error: oErr } = await supabase
      .from("gift_orders")
      .insert({
        status: onSite ? "awaiting_confirmation" : "pending",
        confirm_token_hash: confirmToken ? await hashConfirmToken(confirmToken) : null,
        reservation_until: onSite ? sched.closing_at!.toISOString() : null,
        payment_method: input.payment_method,
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone || null,
        handover: input.handover,
        handover_date: input.date,
        handover_time: input.time,
        delivery_street: input.handover === "delivery" ? input.address.street : null,
        delivery_zip: input.handover === "delivery" ? input.address.zip : null,
        delivery_city: input.handover === "delivery" ? input.address.city : null,
        delivery_note: input.handover === "delivery" ? input.address.note || null : null,
        distance_km: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
        delivery_fee_cents: deliveryFee,
        delivery_vat_rate: input.handover === "delivery" ? settings.delivery_vat_rate : null,
        items_total_cents: itemsTotal,
        total_cents: total,
        vat_breakdown: vatBreakdown,
        gift_message: input.gift_message || null,
        age_confirmed_at: now.toISOString(),
        agb_accepted_at: now.toISOString(),
        agb_version: GIFT_AGB_VERSION,
        language: input.language,
        is_test: isTest,
        client_ip_hash: ipHash,
      })
      .select("id, order_number")
      .single();
    if (oErr || !order) throw new Error(`order_insert_failed: ${oErr?.message}`);
    orderId = order.id;

    const { error: iErr } = await supabase.from("gift_order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        basket_id: l.basket_id,
        variant_id: l.variant_id,
        qty: l.qty,
        unit_price_cents: l.unit_price_cents,
        vat_split: l.vat_split,
        basket_name: input.language === "en" ? l.basket_name_en : l.basket_name,
        variant_label: input.language === "en" ? l.variant_label_en : l.variant_label,
      })),
    );
    if (iErr) throw new Error(`items_insert_failed: ${iErr.message}`);

    // ── 5) Bestand reservieren (Hold) ────────────────────────────────────────
    // "vor Ort": nur 30 Min bis zur Bestätigung (danach verlängert gift_confirm_reservation bis Ladenschluss)
    const holdUntil = onSite
      ? new Date(Date.now() + CONFIRM_HOLD_MINUTES * 60_000)
      : new Date(Date.now() + Math.max(settings.hold_minutes, MIN_HOLD_MINUTES) * 60_000);
    const { error: rErr } = await supabase.rpc("gift_reserve_stock", {
      p_order_id: order.id,
      p_items: lines.map((l) => ({ variant_id: l.variant_id, qty: l.qty })),
      p_expires_at: holdUntil.toISOString(),
    });
    if (rErr) {
      if (/sold_out/.test(rErr.message)) throw new HttpError(409, "sold_out", { variant_id: rErr.details ?? null });
      throw new Error(`reserve_failed: ${rErr.message}`);
    }
    holdPlaced = true;

    // ── 5b) Grenze offener Bestellungen je E-Mail / IP (nach dem Anlegen geprüft: gleichzeitige Anfragen sehen sich gegenseitig) ──
    // DB-gestützt (gift_open_counts): zählt nur Bestellungen mit noch gültigem Hold, abgelaufene/unbestätigt verfallene nie.
    {
      const { data: counts, error: cErr } = await supabase.rpc("gift_open_counts", {
        p_payment_method: input.payment_method, p_email: input.customer.email, p_ip_hash: ipHash,
      });
      if (cErr) throw new Error(`open_count_failed: ${cErr.message}`);
      if (Number(counts?.by_email ?? 0) > MAX_OPEN_PER_EMAIL || Number(counts?.by_ip ?? 0) > MAX_OPEN_PER_IP) {
        throw new HttpError(429, "too_many_open_reservations");  // catch räumt Hold + Bestellung auf, bevor eine Mail rausgeht
      }
    }

    // ── 6a) Zahlung vor Ort: Bestätigungslink (Double-Opt-in) ────────────────
    if (onSite) {
      const reqOriginMail = req.headers.get("origin") ?? "";
      const mailOrigin = ALLOWED_ORIGINS.some((re) => re.test(reqOriginMail)) ? reqOriginMail : DEFAULT_ORIGIN;
      try {
        await sendGiftMails(supabase, order.id, "confirm", { confirmUrl: confirmUrl(mailOrigin, input.language, confirmToken!) });
      } catch (e) {
        // Ohne Mail kann der Kunde nicht bestätigen: Bestellung zurückrollen (catch räumt auf), Kunde bekommt einen klaren Fehler
        reportEdgeError({ source: "edge:create-gift-order:mail", severity: "error", message: e instanceof Error ? e.message : String(e) });
        throw new HttpError(503, "mail_failed");
      }
      return json({ awaiting_confirmation: true, order_number: order.order_number, total_cents: total });
    }

    // ── 6b) Online: Stripe Checkout (30 Min) ─────────────────────────────────
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const reqOrigin = req.headers.get("origin") ?? "";
    const origin = ALLOWED_ORIGINS.some((re) => re.test(reqOrigin)) ? reqOrigin : DEFAULT_ORIGIN;
    const en = input.language === "en";
    const prefix = en ? "/en" : "";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: "eur",
        unit_amount: l.unit_price_cents,
        product_data: { name: en ? `${l.basket_name_en} – ${l.variant_label_en}` : `${l.basket_name} – ${l.variant_label}` },
      },
    }));
    if (deliveryFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: deliveryFee,
          product_data: { name: en ? `Delivery (${(distanceKm ?? 0).toFixed(1)} km)` : `Lieferung (${(distanceKm ?? 0).toFixed(1)} km)` },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customer.email,
      client_reference_id: order.order_number,
      line_items: lineItems,
      payment_method_types: ["card"], // nur sofortige Zahlarten: SEPA & Co. würden den Hold überdauern (Bestand/Verfall)
      expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_MINUTES * 60, // direkt vor dem Aufruf gerechnet (Stripe-Minimum 30 Min); Hold >= 36 Min
      locale: en ? "en" : "de",
      success_url: `${origin}${prefix}/geschenkkoerbe/danke?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${prefix}/geschenkkoerbe/bestellung?cancelled=1`,
      metadata: {
        order_type: "gift_basket",
        gift_order_id: order.id,
        order_number: order.order_number,
        customer_name: input.customer.name,
        language: input.language,
        is_test: isTest ? "true" : "false",
        isTest: isTest ? "true" : "false",
      },
      payment_intent_data: { metadata: { order_type: "gift_basket", order_number: order.order_number, isTest: isTest ? "true" : "false" } },
    });

    const { error: sessErr } = await supabase.from("gift_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    if (sessErr) {
      // Session ohne gespeicherte ID wäre im Webhook nicht prüfbar: Session beenden, Bestellung zurückrollen (catch)
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error(`stripe_session_update_failed: ${sessErr.message}`);
    }
    log("Checkout session created", { orderNumber: order.order_number, total });
    return json({ url: session.url, order_number: order.order_number, total_cents: total, delivery_fee_cents: deliveryFee });
  } catch (e) {
    // Aufräumen: nie einen Hold/eine offene Bestellung ohne Kunden-Weiterleitung zurücklassen
    if (orderId) {
      try {
        if (holdPlaced) await supabase.rpc("gift_release_stock", { p_order_id: orderId });
        await supabase.from("gift_orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", orderId).in("status", ["pending", "awaiting_confirmation", "reserved"]);
      } catch (cleanupErr) {
        log("cleanup failed", { err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr) });
      }
    }
    if (e instanceof HttpError) {
      return json({ error: e.code, ...e.extra }, e.status);
    }
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    reportEdgeError({ source: "edge:create-gift-order", severity: "error", message: msg });
    return json({ error: "internal_error" }, 500);
  }
});
