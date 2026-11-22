// Angebot für den Checkout: rechnet Positionen, Entfernung, Liefergebühr, Mindestbestellwert-Aufschlag und Summe am Server
// (gleiche Rechnung wie create-catering-payment: _shared/orderQuote.ts). Schreibt NICHTS in die Datenbank.
// Der Checkout ruft die Funktion bei jeder Änderung von Warenkorb/Adresse und vor dem Absenden auf und zeigt NUR diese Werte an.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { computeServerQuote } from "../_shared/cateringServer.ts";
import { orderMessage, toLang, type QuoteRequestItem } from "../_shared/orderQuote.ts";
import { reportEdgeError } from "../_shared/reportError.ts";
import { clientIp, rateLimited } from "../_shared/giftRateLimit.ts";

const MAX_ITEMS = 60;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" ? v.slice(0, max) : null);

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Routing und Katalogabfragen kosten: je Client-IP begrenzen (best effort je Edge-Instanz)
  if (rateLimited(`quote:${clientIp(req)}`, 90, 60_000)) {
    return json({ ok: false, error: "rate_limited", message: orderMessage("rate_limited", "de") }, 429);
  }

  let lang = toLang(undefined);
  try {
    const body = await req.json();
    lang = toLang(body?.language);
    const rawItems: unknown[] = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
      return json({ ok: false, error: "invalid_items", message: orderMessage("invalid_items", lang) }, 400);
    }
    const items: QuoteRequestItem[] = rawItems.map((r) => {
      const i = (r ?? {}) as Record<string, unknown>;
      return {
        id: String(i.id ?? "").slice(0, 80),
        quantity: Number(i.quantity),
        price: num(i.price),
        name: str(i.name, 200),
        name_en: str(i.name_en, 200),
      };
    });

    // Lieferangebote kosten ORS-Aufrufe: deutlich enger begrenzen als Abholung/Event (Cache und Tagesbudget in cateringServer.ts)
    if (String(body?.deliveryType) === "delivery" && rateLimited(`quote-delivery:${clientIp(req)}`, 18, 60_000)) {
      return json({ ok: false, error: "rate_limited", message: orderMessage("rate_limited", lang) }, 429);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const a = (body?.address ?? {}) as Record<string, unknown>;
    const outcome = await computeServerQuote(
      supabase,
      {
        items,
        chafingQuantity: Number(body?.chafingQuantity ?? 0),
        deliveryType: String(body?.deliveryType ?? "pickup"),
        address: { street: str(a.street, 200) ?? "", zip: str(a.zip, 20) ?? "", city: str(a.city, 120) ?? "" },
        clientKey: clientIp(req),
      },
      Deno.env.get("OPENROUTE_API_KEY"),
    );
    if (!outcome.ok) {
      if (outcome.code === "delivery_unverifiable") {
        reportEdgeError({ source: "edge:quote-catering-order", severity: "warning", message: "delivery_unverifiable" });
      }
      return json({ ok: false, error: outcome.code, message: orderMessage(outcome.code, lang) }, outcome.code === "delivery_unverifiable" ? 503 : 400);
    }
    return json({ ok: true, quote: outcome.quote });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[QUOTE-CATERING-ORDER]", msg);
    reportEdgeError({ source: "edge:quote-catering-order", severity: "critical", message: msg });
    return json({ ok: false, error: "invalid_request", message: orderMessage("invalid_request", lang) }, 500);
  }
});
