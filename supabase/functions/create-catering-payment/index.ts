import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { reportEdgeError } from '../_shared/reportError.ts';
import { REJECT_MESSAGES_DE, verifyCateringOrder, type ClientLine } from '../_shared/cateringPricing.ts';
import { CATALOG_TENANT_ID, cachedOneWayDistanceKm, computeServerQuote, loadCatalog } from '../_shared/cateringServer.ts';
import { orderMessage, quoteHasChanges, toLang, type Lang, type OrderErrorCode, type OrderQuote, type QuoteRequestItem } from '../_shared/orderQuote.ts';
import { buildCateringPayload, buildEventPayload, parseCreateInput } from '../_shared/orderCreate.ts';
import { checkOrderSchedule } from '../_shared/orderSchedule.ts';
import { ensureOrder } from '../_shared/orderFlow.ts';
import { createSessionIdempotent, deterministicExpiresAt, findOpenSessions, loadSessionLedger, recordSession, reusableSession, sessionIdempotencyKey, settleSessions, type StripeLike } from '../_shared/stripeSessions.ts';
import { rateLimited, clientIp } from '../_shared/giftRateLimit.ts';
import { EVENT_REJECT_MESSAGES_DE, verifyEventBooking } from '../_shared/eventPricing.ts';
import { giftLineName, mixedPaymentMethodTypes, validateGiftForCateringPayment } from '../_shared/giftMixed.ts';



// Zwei Modi, EIN Anlageweg:
//  * mode 'create' (Checkout seit der Abdichtung 22.11.2026): legt die Bestellung/Buchung HIER an (service_role), nachdem Positionen,
//    Entfernung (OpenRouteService), Liefergebühr, Mindestbestellwert-Aufschlag und Summe am Server berechnet wurden
//    (_shared/orderQuote.ts). Weicht das von dem ab, was der Kunde zuletzt gesehen hat (expectedTotalCents), wird NICHTS angelegt:
//    409 quote_changed mit dem neuen Angebot, der Kunde bestätigt den neuen Betrag erneut. Danach folgt die Stripe-Session.
//  * ohne mode (abwärtskompatibel, alter Checkout): prüft eine bereits vom Browser angelegte Bestellung und zahlt sie.
//    Entfällt, sobald kein alter Checkout mehr im Umlauf ist; neue Bestellungen kann der Browser nach der Sperr-Migration nicht mehr anlegen.
const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CATERING-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

  let lang: Lang = 'de';
  let createMode = false;
  try {
    logStep("Function started");

    const body = await req.json();
    const isCreate = body?.mode === 'create';
    createMode = isCreate;
    lang = toLang(body?.language);
    // Legacy-Felder (alter Checkout); im Modus 'create' kommen sie aus dem validierten Kundenblock
    // deno-lint-ignore no-explicit-any
    let { amount, customerEmail, customerName, orderNumber, items, paymentMethod, giftOrderNumber } = body as any;

    // Determine base URL for Stripe redirect URLs
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");

    let baseUrl = origin;
    if (!baseUrl && referer) {
      try {
        const refererUrl = new URL(referer);
        baseUrl = refererUrl.origin;
      } catch {
        baseUrl = null;
      }
    }

    // Fallback to production domain if no origin detected
    if (!baseUrl) {
      baseUrl = "https://www.events-storia.de";
    }

    logStep("Base URL determined", { origin, referer, baseUrl, isCreate });

    // EIN Zeitpunkt je Anfrage: Hold-Prüfung, Session-Ablauf (expires_at) und Idempotenzfenster müssen vom selben Moment ausgehen,
    // sonst kann die Session länger laufen, als der geprüfte Hold reicht.
    const requestNowMs = Date.now();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
    });

    let isEventBooking = false;
    let order: { id: string; total_amount: number; customer_email: string; payment_status: string | null } | null = null;
    let orderType = 'catering';
    // Catering (alter Weg): Zeile für die Preisprüfung (Positionen, Lieferung); bei Event-Buchungen null
    // deno-lint-ignore no-explicit-any
    let cateringRow: any = null;
    // Event-Buchung (alter Weg): Paket + Gästezahl für die Preisprüfung
    let eventRow: { package_id: string | null; guest_count: number | null } | null = null;
    // Serverseitig verifizierter Betrag in Cent (Catering und Event); Stripe berechnet NUR diesen Wert
    let verifiedCents: number | null = null;
    let createdQuote: OrderQuote | null = null;

    // Geschenkkorb-Anbindung (Mischbestellung): Beträge kommen ausschließlich aus gift_order_items (Serverpreise), nie vom Client.
    const gift: {
      order: { id: string; order_number: string } | null;
      items: { basket_name: string; variant_label: string; qty: number; unit_price_cents: number }[];
    } = { order: null, items: [] };
    // Liefert eine Fehlerantwort (oder null, wenn alles passt) und füllt giftOrder/giftItems
    const attachGift = async (): Promise<Response | null> => {
      if (giftOrderNumber === undefined || giftOrderNumber === null || giftOrderNumber === '') return null;
      // Alter Weg: Codes/Texte wie bisher (englische Kurztexte bzw. Code); neuer Weg: Code + Meldung in der Sprache der Oberfläche
      const fail = (status: number, code: OrderErrorCode, legacyText?: string) =>
        isCreate
          ? json({ error: code, message: orderMessage(code, lang) }, status)
          : json({ error: legacyText ?? code }, status);
      if (isEventBooking || typeof giftOrderNumber !== 'string') return fail(400, 'gift_not_linked', 'Invalid gift order');
      const { data: g, error: gErr } = await supabase
        .from('gift_orders')
        .select('id, order_number, status, customer_email, handover, payment_method, catering_order_number, is_test')
        .eq('order_number', giftOrderNumber)
        .maybeSingle();
      if (gErr || !g) {
        logStep("ERROR: Gift order not found", { giftOrderNumber, error: gErr?.message });
        return fail(404, 'gift_order_not_found', 'Gift order not found');
      }
      const { data: holds } = await supabase
        .from('gift_stock_holds')
        .select('expires_at')
        .eq('order_id', g.id)
        .eq('status', 'held');
      // Frühester Ablauf aller Holds der Bestellung zählt (ein abgelaufener Hold = Bestand nicht mehr gesichert)
      const holdExpiresAt = (holds ?? []).length > 0
        ? (holds ?? []).map((h: { expires_at: string }) => h.expires_at).sort()[0]
        : null;
      const check = validateGiftForCateringPayment(g, { orderNumber, customerEmail, holdExpiresAt, now: new Date(requestNowMs) });
      if (!check.ok) {
        logStep("ERROR: Gift order rejected", { giftOrderNumber, reason: check.error });
        return fail(409, check.error);
      }
      const { data: gi, error: giErr } = await supabase
        .from('gift_order_items')
        .select('basket_name, variant_label, qty, unit_price_cents')
        .eq('order_id', g.id);
      if (giErr || !gi || gi.length === 0) {
        throw new Error(`gift_items_load_failed: ${giErr?.message ?? 'empty'}`);
      }
      gift.order = { id: g.id, order_number: g.order_number };
      gift.items = gi;
      logStep("Gift order attached", { giftOrderNumber, lines: gi.length });
      return null;
    };

    // Bei einem endgültigen Fehler NACH dem Anlegen der Korb-Bestellung: Hold freigeben, Korb-Bestellung beenden (nie eine bezahlte).
    // NICHT bei quote_changed (der Kunde kann mit denselben Nummern erneut bestätigen) und nicht bei Stripe-Fehlern (Wiederholung setzt fort).
    const releaseGift = async () => {
      if (!gift.order) return;
      try {
        await supabase.from('gift_orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', gift.order.id).eq('status', 'pending');
        await supabase.rpc('gift_release_stock', { p_order_id: gift.order.id });
        logStep("Gift order released", { giftOrderNumber });
      } catch (e) {
        logStep("WARN: gift release failed", { message: e instanceof Error ? e.message : String(e) });
      }
    };

    if (isCreate) {
      // ━━━ NEUER WEG: Bestellung am Server berechnen UND anlegen ━━━
      if (rateLimited(`create:${clientIp(req)}`, 12, 60_000)) {
        return json({ error: 'rate_limited', message: orderMessage('rate_limited', lang) }, 429);
      }
      const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0 || rawItems.length > 60) {
        return json({ error: 'invalid_items', message: orderMessage('invalid_items', lang) }, 400);
      }
      const reqItems: QuoteRequestItem[] = rawItems.map((r) => {
        const i = (r ?? {}) as Record<string, unknown>;
        return {
          id: String(i.id ?? '').slice(0, 80),
          quantity: Number(i.quantity),
          price: typeof i.price === 'number' && Number.isFinite(i.price) ? i.price : null,
          name: typeof i.name === 'string' ? i.name.slice(0, 200) : null,
          name_en: typeof i.name_en === 'string' ? i.name_en.slice(0, 200) : null,
        };
      });
      const a = (body.address ?? {}) as Record<string, unknown>;
      const outcome = await computeServerQuote(
        supabase,
        {
          items: reqItems,
          chafingQuantity: Number(body.chafingQuantity ?? 0),
          deliveryType: String(body.deliveryType ?? 'pickup'),
          address: { street: String(a.street ?? ''), zip: String(a.zip ?? ''), city: String(a.city ?? '') },
          clientKey: clientIp(req),
        },
        Deno.env.get("OPENROUTE_API_KEY"),
      );
      if (!outcome.ok) {
        logStep("Quote rejected", { code: outcome.code, detail: outcome.detail });
        if (outcome.code === 'delivery_unverifiable') {
          reportEdgeError({ source: 'edge:create-catering-payment', severity: 'critical', message: 'delivery_unverifiable (create)' });
        }
        return json({ error: outcome.code, message: orderMessage(outcome.code, lang) }, outcome.code === 'delivery_unverifiable' ? 503 : 400);
      }
      const quote = outcome.quote;
      isEventBooking = quote.kind === 'event';
      orderType = isEventBooking ? 'event' : 'catering';

      const parsed = parseCreateInput(body, quote.kind);
      if (!parsed.ok) {
        return json({ error: parsed.code, message: orderMessage(parsed.code, lang) }, 400);
      }
      const input = parsed.input;
      // Termin-Regeln (Vorlauf, Pizza-Zeiten, Wochenend-Frist) am Server erzwingen, nicht nur als Browser-Hinweis
      const scheduleRejected = checkOrderSchedule(
        { kind: quote.kind, isPickup: quote.isPickup, isPizzaOnly: quote.isPizzaOnly, date: input.date, time: input.time }, new Date());
      if (scheduleRejected) return json({ error: scheduleRejected, message: orderMessage(scheduleRejected, lang) }, 400);
      orderNumber = input.orderNumber;
      customerEmail = input.customer.email;
      customerName = input.customer.name;
      paymentMethod = input.paymentMethod;
      amount = quote.totalCents / 100;
      items = quote.lines.map((l) => ({ name: lang === 'en' && l.name_en ? l.name_en : l.name, quantity: l.quantity }));

      // Abweichung zu dem, was der Kunde zuletzt sah (Artikel entfernt/Gäste außerhalb der Grenzen, Preis, Summe):
      // NICHTS anlegen, das neue Angebot zurückgeben; der Kunde bestätigt den neuen Betrag erneut (keine stille Änderung).
      const expected = Number(body.expectedTotalCents);
      if (quoteHasChanges(quote) || !Number.isInteger(expected) || expected !== quote.totalCents) {
        logStep("Quote changed", { orderNumber, expected, server: quote.totalCents, issues: quote.issues.length });
        return json({ error: 'quote_changed', message: orderMessage('quote_changed', lang), quote }, 409);
      }

      // Geschenkkorb prüfen, bevor etwas angelegt wird (scheitert das hier, entsteht nichts)
      const giftErr = await attachGift();
      if (giftErr) return giftErr;
      // Konto (falls eingeloggt) aus dem JWT lesen, nie aus dem Body
      let userId: string | null = null;
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      if (jwt) {
        const { data: u } = await supabase.auth.getUser(jwt);
        userId = u?.user?.id ?? null;
      }
      const newOrderId = crypto.randomUUID();
      const payload = isEventBooking
        ? buildEventPayload(quote, input, newOrderId)
        : buildCateringPayload(quote, input, newOrderId, userId);
      // Anlegen oder Fortsetzen (Fingerabdruck-Vergleich, 23505-Race): _shared/orderFlow.ts
      const ensured = await ensureOrder(supabase, { quote, input, orderId: newOrderId, payload });
      if (ensured.status === 'failed') {
        logStep("ERROR: order create failed", { code: ensured.code, message: ensured.message });
        reportEdgeError({ source: 'edge:create-catering-payment', severity: 'critical', message: `order_create_failed ${orderNumber}: ${ensured.message}` });
        await releaseGift();
        return json({ error: 'order_create_failed', message: orderMessage('order_create_failed', lang) }, 500);
      }
      if (ensured.status === 'conflict') {
        logStep("Order conflict", { orderNumber, reason: ensured.reason });
        if (ensured.reason === 'race') {
          // eine gleichzeitige Anfrage derselben Nummer arbeitet noch: weder Korb freigeben noch stornieren
          return json({ error: 'order_in_progress', message: orderMessage('order_in_progress', lang) }, 409);
        }
        // anderer Inhalt unter alter Nummer (alte unbezahlte Zeile wurde storniert) bzw. schon bezahlt: neue Nummer nötig.
        // Alten Korb-Hold freigeben (nur bei 'mismatch'; eine bezahlte Bestellung behält ihren Korb).
        if (ensured.reason === 'mismatch') {
          // Korb erst freigeben, wenn sicher ist, dass die alte Stripe-Session abgelaufen ist (sonst könnte noch bezahlt werden)
          const found = await findOpenSessions(stripe as unknown as StripeLike, orderNumber, await loadSessionLedger(supabase, orderNumber), requestNowMs);
          // bezahlte, unklare oder nicht nachweislich vollständig gesuchte Sessions: Korb-Hold bleibt (Freigabe nur bei sicher abgelaufenen)
          if (await settleSessions(stripe as unknown as StripeLike, found) === 'expired') await releaseGift();
        }
        return json({ error: 'order_exists', message: orderMessage('order_exists', lang) }, 409);
      }
      const orderId = ensured.orderId;
      // Offene Sessions dieser Bestellung: passende weiterverwenden, übrige aktiv ablaufen lassen; erst danach ältere Körbe freigeben
      const giftCents = gift.items.reduce((sum, g) => sum + g.unit_price_cents * g.qty, 0);
      const found = await findOpenSessions(stripe as unknown as StripeLike, orderNumber, await loadSessionLedger(supabase, orderNumber), requestNowMs);
      const reuse = ensured.status === 'resumed'
        ? reusableSession(found.sessions.filter((x) => x.metadata?.payment_method_selected === paymentMethod && String(x.customer_email ?? customerEmail).toLowerCase() === customerEmail), quote.totalCents + giftCents)
        : null;
      if (reuse) {
        logStep("Reusing open Stripe session", { orderNumber, sessionId: reuse.id });
        return json({ url: reuse.url, sessionId: reuse.id, orderNumber, quote }, 200);
      }
      const expireOutcome = await settleSessions(stripe as unknown as StripeLike, found);
      if (expireOutcome === 'paid') {
        // eine Session wurde inzwischen bezahlt: keine neue Session, nichts freigeben (der Webhook bestätigt die Bestellung)
        logStep("Session already paid, no new session", { orderNumber });
        return json({ error: 'order_exists', message: orderMessage('order_exists', lang) }, 409);
      }
      // nur "expired" (vollständige Suche, alle sicher abgelaufen) erlaubt, ältere Körbe freizugeben; unsafe = Hold bleibt
      const sessionsSettled = expireOutcome === 'expired';
      // Ältere, noch offene Korb-Bestellungen derselben Catering-Nummer (früherer Versuch mit anderem Korb): Hold freigeben, aber
      // nur wenn alte Stripe-Sessions sicher abgelaufen sind
      if (gift.order && sessionsSettled) {
        const { data: older } = await supabase.from('gift_orders').select('id')
          .eq('catering_order_number', orderNumber).eq('status', 'pending').neq('id', gift.order.id);
        for (const o of older ?? []) {
          await supabase.from('gift_orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', o.id).eq('status', 'pending');
          await supabase.rpc('gift_release_stock', { p_order_id: o.id });
          logStep("Superseded gift order released", { giftOrderId: o.id });
        }
      }
      logStep(ensured.status === 'resumed' ? "Resuming existing unpaid order" : "Order created (server prices)", { orderNumber, orderId, totalCents: quote.totalCents });
      order = { id: orderId, total_amount: quote.totalCents / 100, customer_email: customerEmail, payment_status: 'pending' };
      verifiedCents = quote.totalCents;
      createdQuote = quote;
    } else {
      // ━━━ ALTER WEG (abwärtskompatibel): vom Browser angelegte Bestellung prüfen ━━━
      // Validate input
      if (!amount || amount <= 0) {
        throw new Error("Invalid amount");
      }
      if (!customerEmail) {
        throw new Error("Email required");
      }
      if (!orderNumber) {
        throw new Error("Order number required");
      }

      logStep("Input validated", { amount, customerEmail, orderNumber, itemCount: items?.length, paymentMethod });

      // Determine if this is an event booking or catering order based on order number prefix
      isEventBooking = orderNumber.startsWith('EVT-BUCHUNG');

      if (isEventBooking) {
        // Query event_bookings table
        const { data: eventOrder, error: eventError } = await supabase
          .from('event_bookings')
          .select('id, booking_number, total_amount, customer_email, payment_status, package_id, guest_count')
          .eq('booking_number', orderNumber)
          .single();

        if (eventError || !eventOrder) {
          logStep("ERROR: Event booking not found", { orderNumber, error: eventError?.message });
          return new Response(
            JSON.stringify({ error: "Order not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
          );
        }

        order = {
          id: eventOrder.id,
          total_amount: eventOrder.total_amount || 0,
          customer_email: eventOrder.customer_email,
          payment_status: eventOrder.payment_status,
        };
        orderType = 'event';
        eventRow = { package_id: eventOrder.package_id ?? null, guest_count: eventOrder.guest_count ?? null };
        logStep("Found event booking", { bookingId: order.id });
      } else {
        // Query catering_orders table
        const { data: cateringOrder, error: orderError } = await supabase
          .from('catering_orders')
          .select('id, order_number, total_amount, customer_email, payment_status, items, is_pickup, delivery_street, delivery_zip, delivery_city, delivery_cost, minimum_order_surcharge')
          .eq('order_number', orderNumber)
          .single();

        if (orderError || !cateringOrder) {
          logStep("ERROR: Catering order not found", { orderNumber, error: orderError?.message });
          return new Response(
            JSON.stringify({ error: "Order not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
          );
        }

        order = {
          id: cateringOrder.id,
          total_amount: cateringOrder.total_amount || 0,
          customer_email: cateringOrder.customer_email,
          payment_status: cateringOrder.payment_status,
        };
        cateringRow = cateringOrder;
        logStep("Found catering order", { orderId: order.id });
      }

      // Verify email matches order
      if (order.customer_email !== customerEmail) {
        logStep("ERROR: Email mismatch", { 
          orderEmail: order.customer_email, 
          requestEmail: customerEmail 
        });
        return new Response(
          JSON.stringify({ error: "Email mismatch" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Verify amount matches (allow small rounding differences)
      const amountDifference = Math.abs(order.total_amount - amount);
      if (amountDifference > 0.02) {
        logStep("ERROR: Amount mismatch", { 
          orderAmount: order.total_amount, 
          requestAmount: amount,
          difference: amountDifference
        });
        return new Response(
          JSON.stringify({ error: "Amount mismatch - order may have been modified" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Check if already paid
      if (order.payment_status === 'paid') {
        logStep("ERROR: Order already paid", { orderNumber });
        return new Response(
          JSON.stringify({ error: "Order already paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // SECURITY (I3): Preise NICHT dem Client glauben. Positionen aus menu_items, Liefergebühr aus Server-Entfernung,
      // Mindestbestellwert und Summe werden nachgerechnet; Abweichung > 1 Cent => Ablehnung, Stripe wird nie erreicht.
      if (cateringRow) {
        const rawItems = Array.isArray(cateringRow.items) ? cateringRow.items : [];
        const lines: ClientLine[] = rawItems.map((i: { id?: unknown; quantity?: unknown; price?: unknown; name?: unknown; name_en?: unknown }) => ({
          name: typeof i?.name === 'string' ? i.name : null,
          name_en: typeof i?.name_en === 'string' ? i.name_en : null,
          id: String(i?.id ?? ''),
          quantity: Number(i?.quantity),
          price: Number(i?.price),
        }));
        const catalog = await loadCatalog(supabase, lines.map((l) => l.id));
        const isPickup = cateringRow.is_pickup === true;
        const oneWayKm = isPickup
          ? null
          : await cachedOneWayDistanceKm(
            supabase,
              `${cateringRow.delivery_street ?? ''}, ${cateringRow.delivery_zip ?? ''} ${cateringRow.delivery_city ?? ''}`,
              Deno.env.get("OPENROUTE_API_KEY"),
              fetch,
              { clientKey: clientIp(req) },
            );
        const verdict = verifyCateringOrder({
          lines,
          catalog,
          isPickup,
          oneWayKm,
          clientDeliveryEuro: Number(cateringRow.delivery_cost ?? 0),
          clientSurchargeEuro: Number(cateringRow.minimum_order_surcharge ?? 0),
          clientTotalEuro: Number(order.total_amount),
        });
        if (!verdict.ok) {
          logStep("ERROR: Catering price verification failed", { orderNumber, code: verdict.code, detail: verdict.detail });
          reportEdgeError({
            source: 'edge:create-catering-payment',
            severity: verdict.code === 'delivery_unverifiable' ? 'critical' : 'warning',
            message: `price_verification_failed:${verdict.code} order=${orderNumber} ${JSON.stringify(verdict.detail)}`,
          });
          return new Response(
            JSON.stringify({ error: verdict.code, message: REJECT_MESSAGES_DE[verdict.code] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: verdict.code === 'delivery_unverifiable' ? 503 : 409 }
          );
        }
        // auch der angefragte Betrag muss zum Serverwert passen
        if (Math.abs(Math.round(Number(amount) * 100) - verdict.expectedTotalCents) > 1) {
          logStep("ERROR: Request amount differs from server price", { amount, expectedCents: verdict.expectedTotalCents });
          return new Response(
            JSON.stringify({ error: 'total_mismatch', message: REJECT_MESSAGES_DE.total_mismatch }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
          );
        }
        verifiedCents = verdict.expectedTotalCents;
        logStep("Catering prices verified", { orderNumber, expectedCents: verdict.expectedTotalCents });
      }

      // SECURITY (I3, Teil 2): Event-Buchungen gegen packages nachrechnen (wie DB-Trigger order_guard_event_booking).
      if (eventRow) {
        let pkg: { id: string; price: number; price_per_person: boolean | null; is_active: boolean | null } | null = null;
        if (eventRow.package_id) {
          const { data: pkgRow, error: pkgErr } = await supabase
            .from('packages')
            .select('id, price, price_per_person, is_active')
            .or(`tenant_id.eq.${CATALOG_TENANT_ID},tenant_id.is.null`)
            .eq('id', eventRow.package_id)
            .maybeSingle();
          if (pkgErr) throw new Error(`package_load_failed: ${pkgErr.message}`);
          pkg = pkgRow ? { ...pkgRow, price: Number(pkgRow.price) } : null;
        }
        const eventVerdict = verifyEventBooking({ pkg, guests: eventRow.guest_count, clientTotalEuro: Number(order.total_amount) });
        if (!eventVerdict.ok) {
          logStep("ERROR: Event price verification failed", { orderNumber, code: eventVerdict.code, detail: eventVerdict.detail });
          reportEdgeError({
            source: 'edge:create-catering-payment',
            severity: 'warning',
            message: `price_verification_failed:${eventVerdict.code} order=${orderNumber} ${JSON.stringify(eventVerdict.detail)}`,
          });
          return new Response(
            JSON.stringify({ error: eventVerdict.code, message: EVENT_REJECT_MESSAGES_DE[eventVerdict.code] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
          );
        }
        if (Math.abs(Math.round(Number(amount) * 100) - eventVerdict.expectedTotalCents) > 1) {
          logStep("ERROR: Request amount differs from server event price", { amount, expectedCents: eventVerdict.expectedTotalCents });
          return new Response(
            JSON.stringify({ error: 'total_mismatch', message: 'Der Gesamtbetrag stimmt nicht. Bitte laden Sie die Seite neu und buchen Sie erneut.' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
          );
        }
        verifiedCents = eventVerdict.expectedTotalCents;
        logStep("Event prices verified", { orderNumber, expectedCents: eventVerdict.expectedTotalCents });
      }


      logStep("Order validated successfully", {
        orderId: order.id,
        orderType,
        dbAmount: order.total_amount,
        requestAmount: amount
      });

      // Mischbestellung (optional, rückwärtskompatibel): Geschenkkorb-Bestellung "mit Catering" an diese Zahlung hängen.
      const giftErr = await attachGift();
      if (giftErr) return giftErr;
    }

    // Check for existing customer
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      logStep("No existing customer found, will create new");
    }

    // Build item description (truncated to 500 chars for Stripe limit)
    const itemDescription = items
      ?.map((i: { quantity: number; name: string }) => `${i.quantity}× ${i.name}`)
      .join(", ")
      .slice(0, 500) || (isEventBooking ? "Event Buchung" : "Catering Order");

    // Determine product name based on order type
    const productName = isEventBooking 
      ? `STORIA Event Buchung #${orderNumber}`
      : `STORIA Catering #${orderNumber}`;

    // Create checkout session with dynamic price
    // If paymentMethod is 'billie', restrict to Billie only
    // Otherwise, let Stripe show all enabled payment methods
    const sessionConfig: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: itemDescription,
            },
            unit_amount: verifiedCents ?? Math.round(amount * 100), // Stripe expects cents; Catering: Serverwert (I3)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/checkout?payment=success&order=${orderNumber}`,
      cancel_url: `${baseUrl}/checkout?payment=cancelled`,
      metadata: {
        order_number: orderNumber,
        customer_name: customerName,
        order_type: orderType,
        payment_method_selected: paymentMethod || 'stripe',
      },
    };

    // Mischbestellung: Körbe als eigene Positionen (Serverbetrag), Session endet nach 31 Min (Hold >= 36 Min), Verknüpfung in den Metadaten
    if (gift.order) {
      for (const gi of gift.items) {
        sessionConfig.line_items!.push({
          price_data: {
            currency: "eur",
            product_data: { name: giftLineName(gi.basket_name, gi.variant_label) },
            unit_amount: gi.unit_price_cents,
          },
          quantity: gi.qty,
        });
      }
      // nur Karte (sofort), außer Billie: asynchrone Methoden würden den Hold überdauern
      const mixedTypes = mixedPaymentMethodTypes(paymentMethod);
      if (mixedTypes) sessionConfig.payment_method_types = mixedTypes as Parameters<typeof stripe.checkout.sessions.create>[0]['payment_method_types'];
      sessionConfig.expires_at = deterministicExpiresAt(requestNowMs); // deterministisch je 3-Min-Fenster: Wiederholungen haben identische Parameter
      sessionConfig.metadata = { ...sessionConfig.metadata, gift_order_id: gift.order.id, gift_order_number: gift.order.order_number };
    }

    // For Billie B2B invoice, restrict payment methods to Billie only
    if (paymentMethod === 'billie') {
      sessionConfig.payment_method_types = ['billie'];
      logStep("Billie payment method selected - restricting to Billie only");
    }
    // For regular stripe, don't set payment_method_types to allow all dashboard-enabled methods

    // Idempotenzschlüssel aus Bestellnummer + Hash ALLER Session-Parameter + 3-Min-Fenster: gleiche Anfrage = gleiche Session,
    // geänderte Parameter (Name, Zahlart, Körbe ...) = neuer Schlüssel statt 400 idempotency_error
    const session = await createSessionIdempotent(
      stripe as unknown as StripeLike, sessionConfig, await sessionIdempotencyKey(orderNumber, sessionConfig, requestNowMs));

    logStep("Checkout session created", { sessionId: session.id, orderNumber, orderType });
    // Session-ID an der Bestellung merken (Tabelle catering_checkout_sessions), damit spätere Anfragen sie gezielt finden.
    // Fehlertolerant: fehlt die Tabelle noch, bleibt nur der Rückfall über die Listensuche.
    if (!await recordSession(supabase, orderNumber, session.id)) logStep("WARN: session id not recorded", { orderNumber, sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id, orderNumber, ...(createdQuote ? { quote: createdQuote } : {}) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    reportEdgeError({ source: 'edge:create-catering-payment', severity: 'critical', message: errorMessage });
    // Neuer Weg: Meldung in der Sprache der Oberfläche (die technische Meldung bleibt im Log/Alarm)
    return new Response(JSON.stringify(createMode
      ? { error: 'payment_failed', message: orderMessage('payment_failed', lang) }
      : { error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
