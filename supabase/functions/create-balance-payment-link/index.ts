import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Body {
  eventId: string; // v2_events.id (entspricht catering_orders.id / event_bookings.id)
  context: "catering_order" | "event_booking" | "inquiry";
  amountEur: number; // offener Betrag in Euro (brutto)
  description?: string;
  customerEmail: string;
  customerName?: string;
  sendEmail?: boolean; // default true
}

const log = (s: string, d?: unknown) => console.log(`[BALANCE-LINK] ${s}`, d ? JSON.stringify(d) : "");

const PUBLIC_BASE_URL = "https://events-storia.de";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
}

async function buildUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  base: string,
  eventId: string,
): Promise<string> {
  // If a link for this event already exists, reuse its slug
  const { data: existing } = await supabase
    .from("balance_payment_links")
    .select("slug")
    .eq("event_id", eventId)
    .limit(1)
    .maybeSingle();
  if (existing?.slug) return existing.slug;

  let candidate = base;
  let n = 1;
  while (true) {
    const { data: clash } = await supabase
      .from("balance_payment_links")
      .select("id")
      .eq("slug", candidate)
      .limit(1)
      .maybeSingle();
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const { data: userData, error: ue } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !userData.user) throw new Error("Auth failed");
    const { data: role } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").single();
    if (!role) throw new Error("Admin role required");

    const body: Body = await req.json();
    if (!body.eventId || !body.amountEur || body.amountEur <= 0 || !body.customerEmail) {
      throw new Error("eventId, amountEur, customerEmail required");
    }

    // ============================================================
    // NEU: Dynamische Restzahlungs-Seite /restzahlung/<slug>
    // Statt statischer stripe.paymentLinks.create(...) — der Kunde
    // wählt finale Gästezahl, Seite berechnet Preis × Gäste − Anzahlung.
    // ============================================================

    // Event-Daten holen (für price_per_person, guests, deposit, date)
    const { data: ev } = await supabaseAdmin
      .from("v2_events")
      .select("id, customer_id, date, booking_number, number, amount_total, guest_count, deposit_amount")
      .eq("id", body.eventId)
      .maybeSingle();

    if (!ev) throw new Error(`Event ${body.eventId} nicht gefunden`);

    // Bereits gezahlte Anzahlung (status=paid, payment_type=deposit/prepayment) ermitteln
    const { data: paidRows } = await supabaseAdmin
      .from("v2_payments")
      .select("amount_cents, status, payment_type")
      .eq("event_id", body.eventId)
      .eq("status", "paid");
    const depositPaidCents = (paidRows || [])
      .filter((p) => p.payment_type === "deposit" || p.payment_type === "prepayment")
      .reduce((s, p) => s + (p.amount_cents || 0), 0);

    const guestCount = Math.max(1, Number(ev.guest_count || 1));
    const amountTotalCents = Math.round(Number(ev.amount_total || 0) * 100);
    // Preis pro Person 1:1 aus Maestro: amount_total / guest_count
    // Fallback wenn amount_total fehlt: amountEur + deposit
    const totalCents = amountTotalCents > 0
      ? amountTotalCents
      : Math.round(body.amountEur * 100) + depositPaidCents;
    const pricePerPersonCents = Math.round(totalCents / guestCount);

    // Slug: <nachname>-<booking_number-suffix>
    const lastName = (body.customerName || "kunde").trim().split(/\s+/).pop() || "kunde";
    const numSuffix = (ev.booking_number || ev.number || body.eventId)
      .toString().match(/(\d+)\s*$/)?.[1] || ev.id.slice(0, 6);
    const baseSlug = `${slugify(lastName)}-${numSuffix}`;
    const slug = await buildUniqueSlug(supabaseAdmin, baseSlug, body.eventId);

    // Upsert balance_payment_links Eintrag
    const eventLabel = body.description || `Veranstaltung ${ev.booking_number || ev.number || ""}`.trim();
    const upsertRow = {
      slug,
      event_label: eventLabel,
      event_label_en: eventLabel,
      price_per_person_cents: pricePerPersonCents,
      deposit_paid_cents: depositPaidCents,
      min_guests: guestCount,
      max_guests: guestCount + 30,
      default_guests: guestCount,
      customer_email: body.customerEmail,
      customer_name: body.customerName ?? null,
      event_id: body.eventId,
      event_date: ev.date,
      active: true,
      created_by: userData.user.id,
    };

    const { error: upsertErr } = await supabaseAdmin
      .from("balance_payment_links")
      .upsert(upsertRow, { onConflict: "slug" });
    if (upsertErr) throw new Error(`balance_payment_links upsert: ${upsertErr.message}`);

    const paymentUrl = `${PUBLIC_BASE_URL}/restzahlung/${slug}`;
    log("dynamic balance link prepared", { slug, url: paymentUrl, pricePerPersonCents, depositPaidCents, guestCount });

    // Payment-Record (sent) anlegen, damit die Timeline ihn sofort sieht
    const { data: paymentRow } = await supabaseAdmin.from("v2_payments").insert({
      event_id: body.eventId,
      amount_cents: Math.round(body.amountEur * 100),
      payment_type: "balance",
      status: "sent",
      stripe_payment_link_url: paymentUrl,
      notes: body.description || "Restzahlung via Maestro",
      created_by: userData.user.email ?? null,
    }).select("id").single();

    // Optional: E-Mail mit dem Link via send-payment-email
    if (body.sendEmail !== false && paymentRow?.id) {
      try {
        await supabaseAdmin.functions.invoke("send-payment-email", {
          body: { payment_id: paymentRow.id },
        });
      } catch (e) {
        log("send-payment-email failed (non-fatal)", e instanceof Error ? e.message : e);
      }
    }

    // Activity Log
    await supabaseAdmin.from("activity_logs").insert({
      entity_type: body.context,
      entity_id: body.eventId,
      action: "balance_payment_link_created",
      actor_email: userData.user.email,
      metadata: {
        amount_eur: body.amountEur,
        slug,
        payment_link_url: paymentUrl,
        kind: "dynamic_balance_page",
      },
    });

    return new Response(JSON.stringify({ success: true, paymentLinkUrl: paymentUrl, slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});