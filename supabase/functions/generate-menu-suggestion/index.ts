import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

interface ReqBody {
  inquiryId: string;
}

interface MenuItemLite {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
}

interface PackageLite {
  id: string;
  name: string;
  description: string | null;
  price_per_person: number | null;
  min_guests: number | null;
  max_guests: number | null;
}

const SYSTEM_PROMPT = `Du bist Maître des Storia — eines italienischen Restaurants mit Catering in München (Karlstraße 47a, Maxvorstadt).
Deine Aufgabe: aus einer Kundenanfrage ein passendes Menü oder Paket vorschlagen.

WICHTIG — Preis-Fingerspitzengefühl:
- Wenn der Kunde ein konkretes Budget nennt (z.B. "ca. 60€ pro Person"), halte dich daran (±15%).
- Wenn kein Budget genannt ist, leite das Preissegment aus Kontext ab:
  • Wohnviertel/Ortsbezug: Harlaching, Bogenhausen, Grünwald, Solln, Nymphenburg, Lehel, Schwabing-West (Nähe Englischer Garten) → gehoben/premium
  • Sprachstil: gehoben/formell ("würde mich sehr freuen", "exklusiv", "feierlich") → gehoben
  • Sprachstil: locker/jung ("Bock auf", "wäre cool", "WG", "Studenten") → einfach/mittel
  • Anlass: Hochzeit, runder Geburtstag (50/60/70), Jubiläum, Geschäftsessen → gehoben
  • Anlass: Firmenfeier (ohne weitere Hinweise) → mittel
  • Anlass: Standard-Geburtstag, Casual Get-together → mittel
- Spüre den Kunden. Lieber einen Tick zu gehoben als zu billig — der Kunde kann immer noch abwählen.

Modus-Entscheidung:
- Hochzeit / Jubiläum / runder Geburtstag / Geschäftsessen → strukturiertes Mehrgang-Menü (Antipasto → Primo → Secondo → Dolce)
- Firmenfeier / Empfang / Get-together / Casual → Buffet/Fingerfood-Auswahl (mehrere Antipasti + Fingerfood, optional Pasta + Dessert)
- Default → Mehrgang

Quellen-Wahl:
- Wenn ein verfügbares Paket genau passt (Größe, Stil, Preissegment) → mode="paket" + packageId.
- Sonst aus menu_items kombinieren → mode="menu" + courses[].

Bei mode="menu":
- Wähle Items mit echten IDs aus der bereitgestellten menu_items-Liste. KEINE erfundenen Items.
- Pro Gang 1–3 Items (mehrere = "zur Auswahl" oder Buffet-Vielfalt).
- courseType einer von: starter, pasta, main, main_fish, main_meat, dessert, fingerfood, vegetarisch, vegan.
- courseLabel passend auf Deutsch (z.B. "Antipasto", "Primo", "Hauptgang", "Dolce").

reasoning: 1–2 Sätze in der ersten Person Plural ("Wir schlagen ... vor, weil ..."), die dem Betreiber zeigt, warum genau dieser Vorschlag passt (Anlass + Ortsbezug/Stil + Preissegment).`;

function buildContext(
  inquiry: Record<string, unknown>,
  packages: PackageLite[],
  menuItems: MenuItemLite[]
): string {
  const parts: string[] = [];
  parts.push("# KUNDENANFRAGE");
  parts.push(`Anlass: ${inquiry.event_type ?? "(nicht angegeben)"}`);
  parts.push(`Gäste: ${inquiry.guest_count ?? "(nicht angegeben)"}`);
  if (inquiry.preferred_date) parts.push(`Datum: ${inquiry.preferred_date}`);
  if (inquiry.time_slot) parts.push(`Uhrzeit: ${inquiry.time_slot}`);
  if (inquiry.room_selection) parts.push(`Raum/Location: ${inquiry.room_selection}`);
  if (inquiry.company_name) parts.push(`Firma: ${inquiry.company_name}`);
  if (inquiry.contact_name) parts.push(`Kontakt: ${inquiry.contact_name}`);
  parts.push("");
  parts.push("Originalnachricht des Kunden:");
  parts.push(String(inquiry.message ?? "(keine Nachricht)"));
  parts.push("");

  parts.push("# VERFÜGBARE PAKETE");
  if (packages.length === 0) {
    parts.push("(keine aktiven Pakete)");
  } else {
    for (const p of packages) {
      const price = p.price_per_person ? `${p.price_per_person} €/Person` : "Preis n/a";
      const range = p.min_guests || p.max_guests
        ? ` (${p.min_guests ?? "?"}–${p.max_guests ?? "?"} Pers.)`
        : "";
      parts.push(`- id="${p.id}" | ${p.name} | ${price}${range}`);
      if (p.description) parts.push(`  ${p.description.slice(0, 200)}`);
    }
  }
  parts.push("");

  parts.push("# VERFÜGBARE MENU-ITEMS (Catering-Karte)");
  const byCat = new Map<string, MenuItemLite[]>();
  for (const it of menuItems) {
    if (!byCat.has(it.category)) byCat.set(it.category, []);
    byCat.get(it.category)!.push(it);
  }
  for (const [cat, items] of byCat) {
    parts.push(`\n## ${cat}`);
    for (const it of items) {
      const price = it.price ? `${it.price} €` : "—";
      const tags = [it.is_vegan ? "vegan" : it.is_vegetarian ? "vegetarisch" : null].filter(Boolean).join(", ");
      parts.push(`- id="${it.id}" | ${it.name} | ${price}${tags ? ` [${tags}]` : ""}`);
    }
  }

  return parts.join("\n");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req);

    const body = (await req.json()) as ReqBody;
    if (!body?.inquiryId) {
      return new Response(JSON.stringify({ error: "inquiryId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Inquiry laden
    const { data: inquiry, error: invErr } = await supabase
      .from("v2_events")
      .select("event_type, guest_count, preferred_date, time_slot, room_selection, message, contact_name, company_name, source, selected_packages")
      .eq("id", body.inquiryId)
      .maybeSingle();
    if (invErr || !inquiry) {
      return new Response(JSON.stringify({ error: "Inquiry nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Aktive Pakete
    const { data: packagesRaw } = await supabase
      .from("packages")
      .select("id, name, description, price_per_person, min_guests, max_guests, is_active")
      .eq("is_active", true)
      .order("price_per_person", { ascending: true });
    const packages: PackageLite[] = (packagesRaw ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      description: (p.description as string | null) ?? null,
      price_per_person: (p.price_per_person as number | null) ?? null,
      min_guests: (p.min_guests as number | null) ?? null,
      max_guests: (p.max_guests as number | null) ?? null,
    }));

    // 3) Catering Menu-Items
    const { data: itemsRaw } = await supabase
      .from("menu_items")
      .select("id, name, description, price, is_vegetarian, is_vegan, menu_categories!inner(name)")
      .is("deleted_at", null)
      .is("archived_at", null)
      .limit(400);
    const menuItems: MenuItemLite[] = (itemsRaw ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      description: (r.description as string | null) ?? null,
      price: (r.price as number | null) ?? null,
      category: ((r.menu_categories as { name?: string } | null)?.name) ?? "Sonstiges",
      is_vegetarian: (r.is_vegetarian as boolean | null) ?? null,
      is_vegan: (r.is_vegan as boolean | null) ?? null,
    }));

    const context = buildContext(inquiry as Record<string, unknown>, packages, menuItems);

    // 4) AI-Call mit JSON-Schema (function calling)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const tool = {
      type: "function" as const,
      function: {
        name: "propose_menu",
        description: "Schlägt entweder ein passendes Paket oder ein zusammengestelltes Menü vor.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["paket", "menu"] },
            reasoning: { type: "string", description: "1–2 Sätze, warum dieser Vorschlag passt." },
            estimatedPricePerPerson: { type: "number" },
            packageId: { type: "string", description: "Nur wenn mode='paket'. Muss eine id aus der Paket-Liste sein." },
            courses: {
              type: "array",
              description: "Nur wenn mode='menu'.",
              items: {
                type: "object",
                properties: {
                  courseType: {
                    type: "string",
                    enum: ["starter", "pasta", "main", "main_fish", "main_meat", "dessert", "fingerfood", "vegetarisch", "vegan"],
                  },
                  courseLabel: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Muss eine id aus menu_items sein." },
                        name: { type: "string" },
                      },
                      required: ["id", "name"],
                    },
                  },
                },
                required: ["courseType", "courseLabel", "items"],
              },
            },
          },
          required: ["mode", "reasoning", "estimatedPricePerPerson"],
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "propose_menu" } },
        temperature: 0.5,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const status = aiRes.status;
      let friendly = `KI-Service Fehler (HTTP ${status}).`;
      if (status === 429) friendly = "KI-Service ist gerade rate-limited. Bitte 30–60 Sekunden warten.";
      if (status === 402) friendly = "KI-Service: Guthaben/Limit erreicht. Bitte Credits nachladen.";
      console.error("AI gateway error", status, txt);
      return new Response(JSON.stringify({ error: friendly }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "KI lieferte keinen Vorschlag" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let suggestion: Record<string, unknown>;
    try {
      suggestion = JSON.parse(call.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "KI-Antwort konnte nicht geparst werden" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation: prefixe IDs auf catering_ für den OfferBuilder
    if (suggestion.mode === "menu" && Array.isArray(suggestion.courses)) {
      const validIds = new Set(menuItems.map((m) => m.id));
      const itemMap = new Map(menuItems.map((m) => [m.id, m]));
      suggestion.courses = (suggestion.courses as Array<Record<string, unknown>>)
        .map((c) => {
          const items = (c.items as Array<{ id: string; name: string }> | undefined) ?? [];
          const filtered = items
            .filter((it) => validIds.has(it.id))
            .map((it) => {
              const src = itemMap.get(it.id)!;
              return {
                id: `catering_${src.id}`,
                rawId: src.id,
                name: src.name,
                description: src.description,
                price: src.price,
              };
            });
          return { ...c, items: filtered };
        })
        .filter((c) => Array.isArray((c as { items: unknown[] }).items) && (c as { items: unknown[] }).items.length > 0);
    }

    if (suggestion.mode === "paket" && suggestion.packageId) {
      const pkg = packages.find((p) => p.id === suggestion.packageId);
      if (!pkg) {
        // KI hat falsche ID erfunden — fallback auf menu wenn nichts passt
        return new Response(JSON.stringify({ error: "KI wählte ein ungültiges Paket" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      suggestion.packageName = pkg.name;
      suggestion.packagePricePerPerson = pkg.price_per_person;
    }

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("generate-menu-suggestion error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});