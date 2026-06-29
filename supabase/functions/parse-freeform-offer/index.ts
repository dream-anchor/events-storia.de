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
5. Strukturiere jede Mahlzeit in Sektionen (heading optional, z.B. "Antipasti-Auswahl", "Live Pasta Station", "Dessert"). Jedes Item ist ein Objekt { quantity (Stk, default 1), name (wörtlich, ohne Bullet), unitPriceNet (Netto-€ pro Stück, default 0 wenn nicht im Text genannt) }.
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
                                items: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      quantity: { type: "number" },
                                      name: { type: "string" },
                                      unitPriceNet: { type: "number" },
                                    },
                                    required: ["name"],
                                  },
                                },
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

    // Menu-Lookup: Original-Bezeichnung + Preis aus DB übernehmen, wenn Match gefunden.
    try {
      await enrichItemsFromMenu(parsed);
    } catch (e) {
      console.error("Menu-Lookup-Fehler (ignoriert):", e);
    }

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

// ---------- Menu-Lookup ----------

interface MenuEntry { name: string; price: number | null; source: 'ristorante' | 'catering'; norm: string; tokens: Set<string> }

let menuCache: { items: MenuEntry[]; ts: number } | null = null;
const CACHE_MS = 60_000;

function parsePriceDisplay(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[€\s]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): Set<string> {
  const stop = new Set(['mit','und','von','der','die','das','dem','den','im','in','al','alla','con','di','la','le','il','e','a','of']);
  return new Set(normalize(s).split(' ').filter(t => t.length >= 3 && !stop.has(t)));
}

async function loadMenu(): Promise<MenuEntry[]> {
  if (menuCache && Date.now() - menuCache.ts < CACHE_MS) return menuCache.items;
  const items: MenuEntry[] = [];

  // Lokale Catering-Items
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const r = await fetch(`${url}/rest/v1/menu_items?select=name,price&deleted_at=is.null&archived_at=is.null&limit=2000`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (r.ok) {
        const rows = await r.json();
        for (const row of rows) {
          if (!row?.name) continue;
          items.push({ name: row.name, price: typeof row.price === 'number' ? row.price : null, source: 'catering', norm: normalize(row.name), tokens: tokenize(row.name) });
        }
      }
    }
  } catch (e) { console.error('catering fetch', e); }

  // Ristorante (externe DB)
  try {
    const rUrl = Deno.env.get('RISTORANTE_SUPABASE_URL');
    const rKey = Deno.env.get('RISTORANTE_SUPABASE_ANON_KEY');
    if (rUrl && rKey) {
      const r = await fetch(`${rUrl}/rest/v1/menu_items?select=name,price,price_display&limit=2000`, {
        headers: { apikey: rKey, Authorization: `Bearer ${rKey}` },
      });
      if (r.ok) {
        const rows = await r.json();
        for (const row of rows) {
          if (!row?.name) continue;
          const price = typeof row.price === 'number' ? row.price : parsePriceDisplay(row.price_display);
          items.push({ name: row.name, price, source: 'ristorante', norm: normalize(row.name), tokens: tokenize(row.name) });
        }
      }
    }
  } catch (e) { console.error('ristorante fetch', e); }

  menuCache = { items, ts: Date.now() };
  return items;
}

function findMatch(name: string, menu: MenuEntry[]): MenuEntry | null {
  const n = normalize(name);
  if (!n) return null;
  const candidates: MenuEntry[] = [];

  // Exakt
  for (const m of menu) if (m.norm === n) candidates.push(m);
  // startsWith bidirektional
  if (candidates.length === 0) {
    for (const m of menu) if (m.norm && (m.norm.startsWith(n) || n.startsWith(m.norm))) candidates.push(m);
  }
  // Token-Überlappung ≥ 80%
  if (candidates.length === 0) {
    const queryTokens = tokenize(name);
    if (queryTokens.size > 0) {
      for (const m of menu) {
        if (m.tokens.size === 0) continue;
        let overlap = 0;
        for (const t of queryTokens) if (m.tokens.has(t)) overlap++;
        const ratio = overlap / Math.max(queryTokens.size, m.tokens.size);
        if (ratio >= 0.8) candidates.push(m);
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const ap = a.price && a.price > 0 ? 1 : 0;
    const bp = b.price && b.price > 0 ? 1 : 0;
    if (ap !== bp) return bp - ap;
    if (a.source === 'ristorante' && b.source !== 'ristorante') return -1;
    if (b.source === 'ristorante' && a.source !== 'ristorante') return 1;
    return 0;
  });
  return candidates[0];
}

async function enrichItemsFromMenu(parsed: Record<string, unknown>): Promise<void> {
  const days = (parsed?.days as Array<Record<string, unknown>>) || [];
  if (!Array.isArray(days) || days.length === 0) return;
  const menu = await loadMenu();
  if (menu.length === 0) return;

  for (const day of days) {
    const meals = (day?.meals as Array<Record<string, unknown>>) || [];
    for (const meal of meals) {
      const sections = (meal?.sections as Array<Record<string, unknown>>) || [];
      for (const section of sections) {
        const items = (section?.items as Array<Record<string, unknown>>) || [];
        for (const item of items) {
          const name = typeof item.name === 'string' ? item.name : '';
          if (!name) continue;
          const match = findMatch(name, menu);
          if (match) {
            item.name = match.name;
            item.unitPriceNet = match.price ?? 0;
          }
          // kein Match → Name + Preis bleiben wie geparst
        }
      }
    }
  }
}