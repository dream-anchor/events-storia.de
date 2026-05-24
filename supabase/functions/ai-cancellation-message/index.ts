import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  customerName?: string;
  customerSalutation?: string;
  orderNumber?: string;
  eventDate?: string;
  totalAmount?: number;
  reasonNotes?: string; // Stichworte des Admins
  tone?: "formal" | "warm" | "apologetic";
  context?: "catering_order" | "event_booking" | "inquiry";
  refundInfo?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const body: Body = await req.json();
    const tone = body.tone ?? "warm";
    const ctx = body.context ?? "catering_order";
    const ctxLabel = ctx === "inquiry" ? "Anfrage" : ctx === "event_booking" ? "Event-Buchung" : "Catering-Bestellung";

    const sys = `Du bist die professionelle Stimme von Storia Events & Catering in München. Schreibe eine kurze, höfliche deutsche E-Mail an einen Kunden, in der eine ${ctxLabel} storniert/abgesagt wird.
Stil: ${tone === "formal" ? "förmlich" : tone === "apologetic" ? "entschuldigend" : "warm-persönlich, aber professionell"}.
Regeln:
- Sprich den Kunden direkt an, nutze Vor- und Nachnamen falls verfügbar.
- Erwähne Bestell-/Buchungsnummer und Datum.
- Begründung neutral und verständlich, baue die Stichworte des Admins ein, aber formuliere sie wertschätzend.
- Bedanke dich für das Vertrauen, biete eine neue Anfrage an.
- Schlussformel "Herzliche Grüße, das Team von Storia". KEIN Subject, KEIN HTML, nur reiner Text.
- Maximal 8 kurze Sätze.`;

    const user = `Daten:
- Kunde: ${body.customerName ?? "—"}
- ${ctxLabel}-Nummer: ${body.orderNumber ?? "—"}
- Datum: ${body.eventDate ?? "—"}
- Gesamtsumme: ${body.totalAmount ? body.totalAmount.toFixed(2) + " €" : "—"}
- Grund/Stichworte des Admins: ${body.reasonNotes ?? "—"}
${body.refundInfo ? "- Rückerstattungsinfo: " + body.refundInfo : ""}

Bitte verfasse die E-Mail.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "AI error", details: t }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const message = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});