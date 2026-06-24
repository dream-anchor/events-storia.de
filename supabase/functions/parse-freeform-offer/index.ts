import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * parse-freeform-offer
 * Wandelt einen vorformulierten Angebotstext (z.B. mehrtägige Catering-Programme)
 * in ein strukturiertes Programm-Objekt um. Preise und Texte werden 1:1
 * übernommen — Maestro-Prinzip: niemals rechnen, niemals runden.
 */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const text: string = typeof body?.text === "string" ? body.text : "";
    const correctionHints: string[] = Array.isArray(body?.correctionHints)
      ? body.correctionHints.filter((h: unknown) => typeof h === "string" && h.length > 0)
      : [];

    if (!text || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Text zu kurz — bitte vollständiges Angebot einfügen." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY ist nicht konfiguriert." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const correctionBlock = correctionHints.length > 0
      ? `\n\nKORREKTUR-HINWEISE AUS VORHERIGEM VERSUCH (BITTE BEHEBEN):\n${correctionHints.map((h) => `- ${h}`).join("\n")}\n\nAchte besonders auf die oben genannten Punkte. Übernimm Preise weiterhin 1:1 aus dem Text.`
      : "";

    const systemPrompt = `Du bist ein Parser für Catering-Angebote.

REGELN (NICHT VERHANDELBAR):
1. Übernimm ALLE Preise EXAKT wie im Text — niemals rechnen, runden, splitten oder konvertieren.
2. Pauschalpreise sind NETTO (so wie im Text "Pauschal: X € netto" angegeben).
3. Speisen → MwSt 7%, Personal/Equipment/Logistik → MwSt 19%.
4. Übernimm Tagesüberschriften ("MONTAG, 29.06.2026"), Mahlzeit-Labels ("Lunch", "Dinner Live Cooking", "Frühstück", "BBQ Sommerfest" etc.) und Gästezahlen ("| 25 Personen") wörtlich — sofern im Text vorhanden.
5. Strukturiere jede Mahlzeit in Sektionen (heading optional, z.B. "Antipasti-Auswahl", "Live Pasta Station", "Dessert"). Items als einfache Strings ohne Bullets.
6. Extrahiere den Block KALKULATION → taxBreakdown (foodNet, foodVatRate=7, servicesNet, servicesVatRate=19).
7. Extrahiere GESAMTANGEBOT → totalsFromText (net, gross).
8. HINWEISE-Aufzählung → notes[].
9. Wenn ein Wert im Text FEHLT, setze ihn auf 0 (Zahlen) oder leeren String. NIEMALS erfinden. 0 bedeutet "nicht im Text genannt" — der Validator wertet das nicht als Fehler.
10. Datumsangaben: dateLabel wörtlich aus Text, isoDate als YYYY-MM-DD wenn ableitbar.
11. EINFACHE ANGEBOTE (kein Mehrtages-Programm, nur eine Mahlzeit oder reine Positionsliste):
    Erzeuge GENAU EINEN Tag mit dateLabel="" und isoDate="" und packe alle
    Mahlzeiten/Positionen dort hinein. Es ist absolut OK, wenn days nur einen
    einzigen Eintrag enthält. Die UI blendet den Tag-Header dann automatisch aus.
    Lege MINDESTENS EINE Mahlzeit mit aussagekräftigem label an (z.B.
    "Sommerliches Sharing-Menü", "Catering-Vorschlag", "Buffet"). Wenn der Text
    Gänge/Komponenten beschreibt (Empfang/Aperitivo, Vorspeise/Antipasti,
    Carpaccio, Hauptgang, Dessert etc.), erstelle für JEDEN Gang eine eigene
    Sektion mit heading (z.B. "Empfang", "Vorspeise – Sharing-Platten",
    "Carpaccio-Variationen", "Hauptgang", "Dessert") und packe die Bulletpoints
    (z.B. "Roastbeef", "Vitello Tonnato", "mediterranes Gemüse",
    "Oktopussalat") als items[] hinein. Items sind reine Strings ohne Bullets,
    ohne "•", ohne führende Bindestriche. NIEMALS Speisen-Bulletpoints in
    notes[] oder scopeOfServices[] verschieben — die gehören in sections[].items[].
12. PRO-PERSON-PREISE: Wenn im Text "X € pro Person" oder "ab X € pro Person" steht, setze
    auf der Mahlzeit pricePerPersonNet=X und pricePerPersonPrefix wörtlich ("ab", "ca.", ""),
    und lasse flatPriceNet=0. NIEMALS hochrechnen (kein guestCount × pricePerPersonNet).
13. ZUSATZLEISTUNGEN (Service-Personal €/h, Auf-/Abbau €/h, Anfahrt/Abfahrt-Pauschalen,
    Equipment-Stückpreise, etc.) gehören in das TOP-LEVEL Array additionalServices[].
    Pro Eintrag: label (wörtlich), unitPriceNet (Zahl), unit ('hour'|'flat'|'piece'),
    quantity=null (nicht im Text bekannt) und vatRate=19. Diese Posten gehören NICHT
    in taxBreakdown.servicesNet, solange im Text keine Stunden/Mengen genannt sind.

Antworte AUSSCHLIESSLICH per Tool-Call extract_program.${correctionBlock}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_program",
          description: "Strukturiertes Catering-Programm aus Freitext extrahieren",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              location: { type: "string" },
              dateRangeLabel: { type: "string" },
              scopeOfServices: {
                type: "array",
                items: { type: "string" },
                description: "LEISTUNGSUMFANG Punkte",
              },
              days: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dateLabel: { type: "string" },
                    isoDate: { type: "string" },
                    meals: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          guestCount: { type: "number" },
                          sections: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                heading: { type: "string" },
                                items: { type: "array", items: { type: "string" } },
                              },
                              required: ["items"],
                            },
                          },
                          flatPriceNet: { type: "number" },
                          vatRate: { type: "number" },
                          pricePerPersonNet: { type: "number" },
                          pricePerPersonPrefix: { type: "string" },
                        },
                        required: ["label", "sections"],
                      },
                    },
                  },
                  required: ["meals"],
                },
              },
              taxBreakdown: {
                type: "object",
                properties: {
                  foodNet: { type: "number" },
                  foodVatRate: { type: "number" },
                  foodVatAmount: { type: "number" },
                  servicesNet: { type: "number" },
                  servicesVatRate: { type: "number" },
                  servicesVatAmount: { type: "number" },
                },
                required: ["foodNet", "foodVatRate", "servicesNet", "servicesVatRate"],
              },
              totalsFromText: {
                type: "object",
                properties: {
                  net: { type: "number" },
                  gross: { type: "number" },
                },
                required: ["net", "gross"],
              },
              notes: { type: "array", items: { type: "string" } },
              additionalServices: {
                type: "array",
                description: "Stunden-/Pauschal-/Stück-Posten (Personal, Logistik, Equipment)",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    unitPriceNet: { type: "number" },
                    unit: { type: "string", enum: ["hour", "flat", "piece"] },
                    quantity: { type: "number" },
                    vatRate: { type: "number" },
                  },
                  required: ["label", "unitPriceNet", "unit", "vatRate"],
                },
              },
            },
            required: ["title", "days", "taxBreakdown", "totalsFromText"],
          },
        },
      },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_program" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI Gateway Error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht — bitte später erneut versuchen." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte Workspace-Credits aufladen." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `AI Gateway Fehler ${aiRes.status}`, detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Kein Tool-Call in AI-Response:", JSON.stringify(aiJson).slice(0, 1000));
      return new Response(
        JSON.stringify({ error: "KI hat kein strukturiertes Ergebnis geliefert." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("JSON-Parse-Fehler:", e, toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: "KI-Antwort konnte nicht geparst werden." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Raw text mitliefern für Audit/Re-Parse
    parsed.rawText = text;

    return new Response(
      JSON.stringify({ success: true, program: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("parse-freeform-offer Fehler:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unbekannter Fehler" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});