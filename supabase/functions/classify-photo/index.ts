// Edge function: classify-photo
// Calls Lovable AI Gateway (Gemini 2.5 Flash, vision) to assign 1 category + 1-5 tags
// from the STORIA vocabulary to a photo, then writes result back to public.photo_album.

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
  pizza: ["margherita","marinara","napoletana","pizza-bianca","büffelmozzarella","trüffel","parmaschinken","salami-piccante","meeresfrüchte","lachs","thunfisch","4-formaggi","vegetarisch","calzone","steinofen"],
  pasta: ["spaghetti","tagliolini","tagliatelle","paccheri","penne","orecchiette","fusilli","gnocchi","ravioli","cavatelli","carbonara","arrabbiata","trüffel","meeresfrüchte","scampi","ragout","hausgemacht"],
  risotto: ["steinpilze","spargel","lachs","safran","kürbis"],
  antipasti: ["caprese","burrata","vitello-tonnato","carpaccio","oktopus","tatar","roastbeef","spargel","rote-bete","hummer"],
  salat: ["insalata-mista","burrata","ziegenkäse","lachs","caesar","roastbeef","avocado"],
  suppe: ["spargelcreme","fischsuppe","brokkoli"],
  fleisch: ["kalb","ossobuco","lamm","rinderfilet","rib-eye","tagliata","dry-aged","lavastein"],
  fisch: ["dorade","oktopus","thunfisch","wolfsbarsch","pesce-misto","gegrillt","salzkruste"],
  dessert: ["tiramisu","schokoladensoufflé","zitronentörtchen","panna-cotta","sorbet","eis"],
  beilage: ["grillgemüse","ofenkartoffeln","kartoffelpüree","frühlingsgemüse"],
  "getränk": ["wasser","softdrink","saft","crodino","limonade"],
  cocktail: ["aperol-spritz","negroni","spritz","martini","mojito","caipirinha","gin-tonic","champagner","aperitivo"],
  wein: ["rotwein","weißwein","roséwein","spumante","prosecco","champagner","magnum","flasche","glas"],
  kaffee: ["espresso","cappuccino","latte-macchiato","affogato"],
  ambiente: ["innenraum","terrasse","bar","tisch-gedeckt","steinofen","detail"],
  team: ["familie-speranza","küche","service"],
};

const CROSS_TAGS = [
  "vegetarisch","scharf","trüffel","meeresfrüchte","büffelmozzarella",
  "hausgemacht","gegrillt","signature","saisonal","mittagskarte",
];

const ALL_TAGS = Array.from(
  new Set([...Object.values(TAGS_BY_CATEGORY).flat(), ...CROSS_TAGS])
);

const SYSTEM_PROMPT = `Du bist ein Bild-Klassifizierer für STORIA (italienisches Restaurant in München).
Analysiere das Foto und wähle GENAU 1 Kategorie und 1-5 Tags aus den vorgegebenen Listen.

ERLAUBTE KATEGORIEN (genau 1, niemals andere Werte):
${CATEGORIES.join(", ")}

Wenn das Foto in keine Kategorie passt, verwende "sonstiges".

ERLAUBTE TAGS (nur diese Werte, keine eigenen erfinden):
${ALL_TAGS.join(", ")}

REGELN:
- Wähle Tags die zum Bild passen, bevorzuge spezifische über generische.
- Bei Speisen-Fotos: Wenn du eine Pasta-Sorte erkennst, vergib sowohl die Sorte (z.B. "tagliatelle") als auch passende Querschnitt-Tags (z.B. "trüffel", "hausgemacht").
- Bei Ambiente-Fotos: Kategorie "ambiente".
- Confidence 0-1 wie sicher du bei der Kategorie bist.`;

interface ClassifyRequest {
  photoId: string;
  photoUrl?: string;
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

    // Resolve a fresh signed URL from storage_path so Gemini can fetch the
    // image regardless of whether the bucket is private.
    const { data: photoRow, error: photoErr } = await sb
      .from("photo_album")
      .select("storage_path")
      .eq("id", photoId)
      .single();
    if (photoErr || !photoRow?.storage_path) {
      throw new Error(`photo not found: ${photoErr?.message ?? photoId}`);
    }
    const { data: signed, error: signErr } = await sb.storage
      .from("photo-album")
      .createSignedUrl(photoRow.storage_path, 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`signed url failed: ${signErr?.message ?? "unknown"}`);
    }
    const photoUrl = signed.signedUrl;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Klassifiziere dieses Foto." },
              { type: "image_url", image_url: { url: photoUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_photo",
              description: "Return category + tags for the photo.",
              parameters: {
                type: "object",
                properties: {
                  category: { type: "string", description: "Genau 1 Wert aus der Kategorie-Liste oder 'sonstiges'." },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-5 Tags aus der erlaubten Tag-Liste.",
                  },
                  confidence: { type: "number" },
                },
                required: ["category", "tags", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_photo" } },
      }),
    });

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
    const category = CATEGORIES.includes(args.category) ? args.category : "sonstiges";
    const tags = (Array.isArray(args.tags) ? args.tags : [])
      .filter((t: string) => ALL_TAGS.includes(t))
      .slice(0, 5);
    const confidence = typeof args.confidence === "number" ? args.confidence : null;

    const { error } = await sb
      .from("photo_album")
      .update({
        category,
        tags,
        ai_classified: true,
        ai_confidence: confidence,
        ai_model: "google/gemini-2.5-flash",
        ai_error: null,
      })
      .eq("id", photoId);
    if (error) throw error;

    return new Response(JSON.stringify({ category, tags, confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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