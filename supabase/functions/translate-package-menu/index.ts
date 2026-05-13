import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

type Lang = "en" | "it" | "fr";

interface RequestBody {
  package_id: string;
  target_langs?: Lang[];
}

const LANG_NAMES: Record<Lang, string> = {
  en: "Englisch",
  it: "Italienisch",
  fr: "Französisch",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return json({ error: "AI service not configured" }, 500, corsHeaders);
    }

    // Auth-Check via User-Client + Admin-Rolle
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const { data: roleData } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleData) {
      return json({ error: "Forbidden — admin only" }, 403, corsHeaders);
    }

    const body: RequestBody = await req.json();
    if (!body?.package_id) {
      return json({ error: "package_id required" }, 400, corsHeaders);
    }
    const targetLangs: Lang[] =
      body.target_langs && body.target_langs.length
        ? body.target_langs
        : ["en", "it", "fr"];

    // Service-Role-Client für Schreibzugriff
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const [coursesRes, drinksRes] = await Promise.all([
      admin
        .from("package_course_config")
        .select("*")
        .eq("package_id", body.package_id),
      admin
        .from("package_drink_config")
        .select("*")
        .eq("package_id", body.package_id),
    ]);

    if (coursesRes.error) throw coursesRes.error;
    if (drinksRes.error) throw drinksRes.error;

    const courses = coursesRes.data || [];
    const drinks = drinksRes.data || [];

    // Quellstrings sammeln
    const sourcePayload = {
      courses: courses.map((c) => ({
        id: c.id,
        course_label: c.course_label || "",
        custom_item_name: c.custom_item_name || "",
        custom_item_description: c.custom_item_description || "",
      })),
      drinks: drinks.map((d) => ({
        id: d.id,
        drink_label: d.drink_label || "",
        quantity_label: d.quantity_label || "",
        options: Array.isArray(d.options)
          ? (d.options as unknown[]).map((opt) =>
              typeof opt === "string"
                ? opt
                : (opt as Record<string, unknown>)?.label?.toString() ?? "",
            )
          : [],
      })),
    };

    let totalUpdates = 0;

    for (const lang of targetLangs) {
      const translated = await translateBatch(
        sourcePayload,
        lang,
        LOVABLE_API_KEY,
      );
      if (!translated) continue;

      // Course-Updates
      for (const t of translated.courses ?? []) {
        const update: Record<string, string | null> = {};
        update[`course_label_${lang}`] = t.course_label || null;
        update[`custom_item_name_${lang}`] = t.custom_item_name || null;
        update[`custom_item_description_${lang}`] =
          t.custom_item_description || null;
        const { error } = await admin
          .from("package_course_config")
          .update(update)
          .eq("id", t.id);
        if (!error) totalUpdates++;
      }

      // Drink-Updates (mit options_translations Merge)
      for (const t of translated.drinks ?? []) {
        const drinkRow = drinks.find((d) => d.id === t.id);
        const existingTranslations =
          (drinkRow?.options_translations as Record<string, unknown>) || {};
        const merged = {
          ...existingTranslations,
          [lang]: t.options || [],
        };

        const update: Record<string, unknown> = {
          options_translations: merged,
        };
        update[`drink_label_${lang}`] = t.drink_label || null;
        update[`quantity_label_${lang}`] = t.quantity_label || null;
        const { error } = await admin
          .from("package_drink_config")
          .update(update)
          .eq("id", t.id);
        if (!error) totalUpdates++;
      }
    }

    return json(
      { success: true, target_langs: targetLangs, updates: totalUpdates },
      200,
      corsHeaders,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("translate-package-menu error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

function json(
  data: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface TranslatedShape {
  courses?: Array<{
    id: string;
    course_label?: string;
    custom_item_name?: string;
    custom_item_description?: string;
  }>;
  drinks?: Array<{
    id: string;
    drink_label?: string;
    quantity_label?: string;
    options?: string[];
  }>;
}

async function translateBatch(
  source: unknown,
  lang: Lang,
  apiKey: string,
): Promise<TranslatedShape | null> {
  const targetName = LANG_NAMES[lang];

  const systemPrompt = `Du bist ein professioneller Übersetzer für italienische Gastronomie und Eventcatering.
Übersetze gegebene deutsche Strings nach ${targetName} (${lang.toUpperCase()}).

REGELN:
- Behalte italienische Speise- und Getränkebegriffe bei (Tagliatelle al Ragù, Saltimbocca, Tiramisu, Panna Cotta, Antipasto misto, Risotto, Espresso, Prosecco, ...).
- Übersetze beschreibende Wörter (Hauptgang, Wahl, Vorspeise zum Teilen, glutenfrei, vegetarisch, Hausrezept, Wasser, Wein, ...).
- Liefere natürliche, appetitliche Sprache.
- Behalte die exakte JSON-Struktur des Inputs bei (gleiche IDs, gleiche Reihenfolge der options-Arrays).
- Wenn ein Feld leer ist, gib einen leeren String zurück.
- Antworte ausschließlich über das bereitgestellte Tool 'set_translations'.`;

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              "Übersetze die folgenden Strings:\n```json\n" +
              JSON.stringify(source, null, 2) +
              "\n```",
          },
        ],
        temperature: 0.2,
        tools: [
          {
            type: "function",
            function: {
              name: "set_translations",
              description:
                "Liefert die übersetzten Strings in identischer Struktur wie der Input.",
              parameters: {
                type: "object",
                properties: {
                  courses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        course_label: { type: "string" },
                        custom_item_name: { type: "string" },
                        custom_item_description: { type: "string" },
                      },
                      required: [
                        "id",
                        "course_label",
                        "custom_item_name",
                        "custom_item_description",
                      ],
                    },
                  },
                  drinks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        drink_label: { type: "string" },
                        quantity_label: { type: "string" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      required: [
                        "id",
                        "drink_label",
                        "quantity_label",
                        "options",
                      ],
                    },
                  },
                },
                required: ["courses", "drinks"],
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "set_translations" },
        },
      }),
    },
  );

  if (!response.ok) {
    const t = await response.text();
    console.error(`AI gateway error (${lang}):`, response.status, t);
    if (response.status === 429 || response.status === 402) {
      throw new Error(
        response.status === 429
          ? "Rate limit erreicht, bitte später erneut versuchen."
          : "AI-Guthaben aufgebraucht.",
      );
    }
    return null;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args) as TranslatedShape;
  } catch (e) {
    console.error("Failed to parse translation args:", e);
    return null;
  }
}