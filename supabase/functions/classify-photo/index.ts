// Edge function: classify-photo
// Calls Lovable AI Gateway (Gemini 2.5 Pro, vision) with a description-first
// two-stage tool schema to assign 1 category + 1-5 tags from the STORIA
// vocabulary, plus a free-form visible description used as SEO/GEO alt text.
// Falls back to gemini-2.5-flash on 429. Writes results back to photo_album.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CATEGORIES = [
  "pizza", "pasta", "risotto", "antipasti", "salat", "suppe",
  "fleisch", "fisch", "dessert", "beilage", "getränk", "cocktail",
  "wein", "kaffee", "ambiente", "team",
] as const;

const TAGS_BY_CATEGORY: Record<string, string[]> = {
  pizza: ["margherita","marinara","napoletana","pizza-bianca","parmaschinken","salami-piccante","lachs","thunfisch","4-formaggi","calzone","steinofen"],
  pasta: ["spaghetti","tagliolini","tagliatelle","paccheri","penne","orecchiette","fusilli","gnocchi","ravioli","cavatelli","carbonara","arrabbiata","scampi","ragout"],
  risotto: ["steinpilze","spargel","lachs","safran","kürbis"],
  antipasti: ["caprese","burrata","vitello-tonnato","carpaccio","oktopus","tatar","roastbeef","spargel","rote-bete","hummer"],
  salat: ["insalata-mista","burrata","ziegenkäse","lachs","caesar","roastbeef","avocado"],
  suppe: ["spargelcreme","fischsuppe","brokkoli"],
  fleisch: [],
  fisch: ["dorade","oktopus","thunfisch","wolfsbarsch","pesce-misto","salzkruste"],
  dessert: ["tiramisu","schokoladensoufflé","zitronentörtchen","panna-cotta","sorbet","eis"],
  beilage: ["grillgemüse","ofenkartoffeln","kartoffelpüree","frühlingsgemüse"],
  "getränk": [],
  cocktail: ["aperol-spritz","negroni","spritz","martini","mojito","caipirinha","gin-tonic","champagner","aperitivo"],
  wein: ["rotwein","weißwein","roséwein","spumante","prosecco","champagner","magnum","flasche","glas"],
  kaffee: ["espresso","cappuccino","latte-macchiato","affogato"],
  ambiente: ["innenraum","terrasse","bar","tisch-gedeckt","steinofen","detail"],
  team: ["familie-speranza","küche","service"],
};

const CROSS_TAGS: string[] = [];

const ALL_TAGS = Array.from(
  new Set([...Object.values(TAGS_BY_CATEGORY).flat(), ...CROSS_TAGS])
);

const SYSTEM_PROMPT = `Du bist ein präziser Bild-Klassifizierer für STORIA (italienisches Restaurant in München).

ARBEITSWEISE — strikt in dieser Reihenfolge:
1) Beschreibe in 1-2 Sätzen wörtlich, was physisch im Bild zu sehen ist
   (Gericht, Hauptzutaten, Geschirr, Setting). Keine Vermutungen, keine Marketingsprache.
2) Wähle GENAU 1 Kategorie aus der Liste, basierend NUR auf dem, was du im Schritt 1 beschrieben hast.
3) Wähle 1-5 Tags aus der erlaubten Tag-Liste.
4) Gib eine ehrliche Confidence 0-1.

ERLAUBTE KATEGORIEN (genau 1, niemals andere Werte):
${CATEGORIES.join(", ")} — oder "sonstiges" wenn nichts passt.

ERKENNUNGSREGELN (hart anwenden, Negativregeln zuerst):
- pizza = runder Teig-Boden sichtbar, Käse/Belag obenauf, typischerweise napoletanisch dünn. KEIN sichtbarer runder Boden → NIE pizza.
- pasta = sichtbare Nudeln (Spaghetti, Tagliatelle, Penne, Gnocchi, Ravioli …). Reiskörner → NICHT pasta.
- risotto = cremiger Reis sichtbar, oft mit Schaum/Glanz; meist Teller mit gleichmäßiger Masse.
- antipasti = Vorspeisen-Brett / Teller mit Aufschnitt, Käse, Tatar, Carpaccio, Caprese, Burrata, Vitello tonnato.
- salat = überwiegend Blattsalat / Rohkost sichtbar.
- suppe = Schüssel mit flüssiger Masse, Löffel typisch.
- fleisch = großes Fleischstück als Hauptkomponente, KEINE Pasta/Pizza darunter.
- fisch = Fisch ganz oder filetiert als Hauptkomponente.
- dessert = Süßspeise: Tiramisu, Panna Cotta, Soufflé, Eis, Sorbet.
- beilage = nur Gemüse/Kartoffeln als Hauptbild ohne Protein-Hauptkomponente.
- getränk = alkoholfreies Getränk (Wasser, Softdrink, Saft, Crodino).
- cocktail = Cocktail-Glas mit klar erkennbarem Cocktail (Aperol Spritz, Negroni, Martini …).
- wein = Wein in Flasche oder Glas dominiert das Bild.
- kaffee = Espresso, Cappuccino, Latte Macchiato, Affogato.
- ambiente = Innenraum, Tisch gedeckt, Bar, Terrasse, Steinofen, Detail — KEIN Gericht dominiert.
- team = Personen (Personal/Familie) sind das Hauptmotiv.

TAG-REGELN:
- Nutze NUR Tags aus der erlaubten Liste, niemals eigene erfinden.
- Bevorzuge spezifische Sorten (z.B. "tagliatelle", "burrata", "aperol-spritz") über generische.
- Bei Dateiname-Hint mit klarem Begriff (z.B. "aperol-spritz"): nimm ihn ernst, falls er nicht im Widerspruch zum Bild steht.

ERLAUBTE TAGS (nur diese Werte):
${ALL_TAGS.join(", ")}

CONFIDENCE:
- 0.9-1.0 = eindeutig erkennbar
- 0.6-0.9 = wahrscheinlich
- 0.45-0.6 = unsicher
- < 0.45  = nicht klar erkennbar → category darf "sonstiges" sein.`;

interface ClassifyRequest {
  photoId: string;
  photoUrl?: string;
}

const PRIMARY_MODEL = "google/gemini-2.5-pro";
const FALLBACK_MODEL = "google/gemini-2.5-flash";
const CONFIDENCE_GATE = 0.45;

function filenameHint(filename: string | null | undefined): string {
  if (!filename) return "";
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base || /^\d+$/.test(base) || base.length < 3) return "";
  return base;
}

async function callGateway(model: string, photoUrl: string, hint: string, apiKey: string) {
  const userText = hint
    ? `Klassifiziere dieses Foto. Hinweis aus Dateiname/Titel: "${hint}". Nutze den Hinweis nur wenn er sich mit dem deckt, was du im Bild siehst.`
    : "Klassifiziere dieses Foto.";

  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: photoUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify_photo",
            description: "Return visible description, category, tags and confidence.",
            parameters: {
              type: "object",
              properties: {
                visible_description: {
                  type: "string",
                  description: "1-2 Sätze: was ist physisch im Bild zu sehen (Gericht, Hauptzutaten, Setting). Deutsch.",
                },
                category: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                confidence: { type: "number" },
              },
              required: ["visible_description", "category", "tags", "confidence"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify_photo" } },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { photoId } = (await req.json()) as ClassifyRequest;
    if (!photoId) {
      return new Response(JSON.stringify({ error: "photoId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load photo row + storage path + existing hints
    const { data: photoRow, error: photoErr } = await sb
      .from("photo_album")
      .select("storage_path, filename, title, description")
      .eq("id", photoId)
      .single();
    if (photoErr || !photoRow?.storage_path) {
      throw new Error(`photo not found: ${photoErr?.message ?? photoId}`);
    }

    // Signed URL so Gemini can fetch the image even though the bucket is private.
    const { data: signed, error: signErr } = await sb.storage
      .from("photo-album")
      .createSignedUrl(photoRow.storage_path, 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`signed url failed: ${signErr?.message ?? "unknown"}`);
    }
    const photoUrl = signed.signedUrl;

    const hint = [
      filenameHint(photoRow.filename as string | null),
      photoRow.title as string | null,
    ]
      .filter(Boolean)
      .join(" · ");

    // Primary call (Pro). Fallback to Flash on 429.
    let aiResp = await callGateway(PRIMARY_MODEL, photoUrl, hint, LOVABLE_API_KEY);
    let usedModel = PRIMARY_MODEL;
    if (aiResp.status === 429) {
      await aiResp.text().catch(() => "");
      aiResp = await callGateway(FALLBACK_MODEL, photoUrl, hint, LOVABLE_API_KEY);
      usedModel = FALLBACK_MODEL;
    }

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      const errMsg =
        aiResp.status === 429 ? "Rate limit erreicht – bitte später erneut versuchen." :
        aiResp.status === 402 ? "AI-Credits aufgebraucht." :
        `AI gateway error ${aiResp.status}`;

      await writeError(photoId, errMsg);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: aiResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const args = JSON.parse(toolCall.function.arguments);

    // Validate
    let category = CATEGORIES.includes(args.category) ? args.category : "sonstiges";
    let tags: string[] = (Array.isArray(args.tags) ? args.tags : [])
      .filter((t: string) => ALL_TAGS.includes(t))
      .slice(0, 5);
    const confidence = typeof args.confidence === "number" ? args.confidence : null;
    const visibleDescription =
      typeof args.visible_description === "string" ? args.visible_description.trim() : "";

    // Confidence gate — low confidence => sonstiges + visible warning
    let aiError: string | null = null;
    if (confidence !== null && confidence < CONFIDENCE_GATE) {
      category = "sonstiges";
      tags = [];
      aiError = "Niedrige Erkennungs-Confidence – bitte manuell prüfen.";
    }

    const update: Record<string, unknown> = {
      category,
      tags,
      ai_classified: true,
      ai_confidence: confidence,
      ai_model: usedModel,
      ai_error: aiError,
    };
    // Fill description only when empty — used as SEO/GEO alt text.
    if (visibleDescription && !(photoRow.description as string | null)) {
      update.description = visibleDescription;
    }

    const { error } = await sb.from("photo_album").update(update).eq("id", photoId);
    if (error) throw error;

    return new Response(
      JSON.stringify({ category, tags, confidence, visible_description: visibleDescription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("classify-photo error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function writeError(photoId: string, message: string) {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await sb.from("photo_album").update({ ai_error: message }).eq("id", photoId);
  } catch (e) {
    console.error("Failed to write ai_error", e);
  }
}