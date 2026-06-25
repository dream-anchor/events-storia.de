import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

interface ReqBody {
  inquiryId: string;
  target?: "event" | "catering";
}

interface MenuItemLite {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  serving_info: string | null;
  min_order: string | null;
}

interface PackageLite {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_per_person: boolean | null;
  min_guests: number | null;
  max_guests: number | null;
}

const SYSTEM_PROMPT = `Du bist Maître des Storia — eines italienischen Restaurants mit Catering in München (Karlstraße 47a, Maxvorstadt).
Deine Aufgabe: aus einer Kundenanfrage **drei Varianten** vorschlagen: Low, Medium, High.

WICHTIG — Kontextuelles Preis-Fingerspitzengefühl (KEINE fixen Bänder, KEINE Hardcodes):
- Lies die gesamte Anfrage als Mensch: Anlass, Tonfall/Sprachstil, evtl. genannter Ort/Stadtteil, evtl. Firma/Branche, evtl. genannte Wünsche, evtl. genanntes Budget.
- Bilde innerlich ein Bauchgefühl für die "Mitte" (Medium) — was würdest du diesem konkreten Kunden ehrlich anbieten, ohne ihn zu unter- oder überfordern?
- Setze Low bewusst schlanker/pragmatischer als Medium, und High bewusst gehobener als Medium — aber alle drei müssen für DIESEN Kunden glaubwürdig wirken. Keine mechanischen ±X %.
- Wenn der Kunde ein konkretes Budget nennt, ankert Medium dort; Low/High passen sich darum herum an (Low etwas darunter, High mit dezentem Upsell).
- Spüre Signale (z. B. Stadtteil/Adresse, formeller Tonfall, Anlass-Größe, Branche) — aber leite daraus immer individuell ab. Erfinde keine festen Listen.

Modus-Entscheidung pro Variante (Mehrgang vs. Buffet/Fingerfood):
- Strukturiertes Mehrgang-Menü (Antipasto → Primo → Secondo → Dolce) wenn der Anlass ein gesetztes Essen verlangt (Hochzeit, Jubiläum, runder Geburtstag, Geschäftsessen, festliches Dinner).
- Buffet / Fingerfood-Auswahl wenn der Anlass eher Steh-/Mingle-Charakter hat (Firmenfeier, Empfang, Get-together, Vernissage, Casual).
- Du DARFST den Modus pro Variante unterschiedlich wählen, wenn es zum Tier passt (z. B. Low = Fingerfood, High = Mehrgang) — solange es zum Anlass plausibel ist.

Quellen-Wahl pro Variante:
- Wenn ein verfügbares Paket für ein Tier wirklich passt (Größe, Stil, Preissegment) → mode="paket" + packageId.
- Sonst aus menu_items kombinieren → mode="menu" + courses[].
- Jede der drei Varianten wird unabhängig entschieden — Low/Medium/High können beliebig Paket oder Menü sein.

Bei mode="menu":
- Wähle Items mit echten IDs aus der bereitgestellten menu_items-Liste. KEINE erfundenen Items.
- Pro Gang 1–3 Items (mehrere = "zur Auswahl" oder Buffet-Vielfalt).
- courseType einer von: starter, pasta, main, main_fish, main_meat, dessert, fingerfood, vegetarisch, vegan.
- courseLabel passend auf Deutsch (z.B. "Antipasto", "Primo", "Hauptgang", "Dolce").

WICHTIG — Platten vs. Pro-Person-Preise (Reichweite beachten):
- Jedes menu_item hat ein Feld "serving_info" als Freitext. Lies es pro Item und entscheide:
  • Enthält es "pro Person" / "pro Glas pro Person" / "Mini-... pro Person" → "price" ist BEREITS pro Person. 1× nehmen.
  • Enthält es "für X Personen" / "Ideal für X-Y Personen" → Platte für X (bzw. Mittelwert von X-Y) Personen. Anzahl Platten = ceil(gaeste / X). Effektive p.P. = (anzahl × price) / gaeste.
  • Enthält es "Platte aus N Spießen/Stück" / "Auswahl an N ..." → Platte mit N Portionen. Anzahl Platten = ceil(gaeste / N). Effektive p.P. = (anzahl × price) / gaeste.
  • Fehlt serving_info oder ist unklar → konservativ als pro-Person-Preis behandeln, aber nicht doppelt.
- "min_order" (z.B. "Ab 4 Personen bestellbar") ist nur eine Mindestbestellmenge — wenn gaeste < min_order, Item meiden.
- Die Summe der effektiven p.P.-Preise aller gewählten Items ergibt deinen "estimatedPricePerPerson". Rechne sauber, damit Platten nicht versehentlich als 49 €/Person verbucht werden.

Output:
- Liefere GENAU 3 Varianten in der Reihenfolge low → medium → high.
- Pro Variante: 1 kurzer Satz "reasoning" in der ersten Person Plural ("Wir schlagen … vor, weil …"), der das Preissegment und die Logik erklärt.
- Zusätzlich: 1 kurzer "overallReasoning"-Satz, der die Wahrnehmung der Anfrage zusammenfasst (was hast du aus der Anfrage gespürt).`;

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
      const price = p.price != null
        ? `${p.price} €${p.price_per_person ? "/Person" : " pauschal"}`
        : "Preis n/a";
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
    const target: "event" | "catering" = body.target === "catering" ? "catering" : "event";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Anfrage laden — der Admin-OfferBuilder arbeitet über die
    // Kompatibilitäts-View `event_inquiries` (Resource "events").
    // Wichtig: nicht `v2_events` verwenden; dort existieren ältere/andere
    // Spaltennamen und viele Angebots-IDs aus dem Wizard werden nicht gefunden.
    const { data: inquiry, error: invErr } = await supabase
      .from("event_inquiries")
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
      .select("id, name, description, price, price_per_person, min_guests, max_guests, is_active")
      .eq("is_active", true)
      .order("price", { ascending: true });
    const packages: PackageLite[] = (packagesRaw ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      description: (p.description as string | null) ?? null,
      price: (p.price as number | null) ?? null,
      price_per_person: (p.price_per_person as boolean | null) ?? null,
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

    const variantSchema = {
      type: "object",
      properties: {
        tier: { type: "string", enum: ["low", "medium", "high"] },
        reasoning: { type: "string", description: "1 Satz: warum diese Variante für diesen Kunden glaubwürdig ist." },
        mode: { type: "string", enum: ["paket", "menu"] },
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
      required: ["tier", "reasoning", "mode", "estimatedPricePerPerson"],
    };

    const tool = {
      type: "function" as const,
      function: {
        name: "propose_menu_variants",
        description: "Schlägt genau drei Varianten (Low, Medium, High) vor — je Variante Paket oder Menü.",
        parameters: {
          type: "object",
          properties: {
            overallReasoning: {
              type: "string",
              description: "1 Satz: wie hast du die Anfrage wahrgenommen (Anlass, Ton, Ortsbezug, Budget-Signale).",
            },
            variants: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              description: "Genau 3 Varianten in der Reihenfolge low, medium, high.",
              items: variantSchema,
            },
          },
          required: ["overallReasoning", "variants"],
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              target === "catering"
                ? SYSTEM_PROMPT +
                  `\n\nMODUS: CATERING-CART\n- Liefere GENAU EINE Variante (tier="medium", mode="menu").\n- Pakete sind in diesem Modus NICHT erlaubt.\n- Wähle 6–12 passende Catering-Items aus menu_items (Antipasti / Pasta / Mains / Dessert / Fingerfood je nach Anlass).\n- Wähle Mengen/Items so, dass der Cart eine kompletteCatering-Lieferung für die angefragte Gästezahl darstellt.`
                : SYSTEM_PROMPT,
          },
          { role: "user", content: context },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "propose_menu_variants" } },
        temperature: 0.6,
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

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "KI-Antwort konnte nicht geparst werden" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overallReasoning = typeof parsed.overallReasoning === "string" ? parsed.overallReasoning : "";
    const rawVariants = Array.isArray(parsed.variants) ? (parsed.variants as Array<Record<string, unknown>>) : [];

    const validIds = new Set(menuItems.map((m) => m.id));
    const itemMap = new Map(menuItems.map((m) => [m.id, m]));

    const cleanedVariants = rawVariants
      .map((v) => {
        const tier = v.tier as "low" | "medium" | "high" | undefined;
        const mode = v.mode as "paket" | "menu" | undefined;
        if (!tier || !mode) return null;

        if (mode === "paket") {
          const pkg = packages.find((p) => p.id === v.packageId);
          if (!pkg) return null;
          return {
            tier,
            mode,
            reasoning: typeof v.reasoning === "string" ? v.reasoning : "",
            estimatedPricePerPerson: typeof v.estimatedPricePerPerson === "number" ? v.estimatedPricePerPerson : null,
            packageId: pkg.id,
            packageName: pkg.name,
            packagePricePerPerson: pkg.price,
          };
        }

        // mode === "menu"
        const rawCourses = Array.isArray(v.courses) ? (v.courses as Array<Record<string, unknown>>) : [];
        const courses = rawCourses
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

        if (courses.length === 0) return null;

        return {
          tier,
          mode,
          reasoning: typeof v.reasoning === "string" ? v.reasoning : "",
          estimatedPricePerPerson: typeof v.estimatedPricePerPerson === "number" ? v.estimatedPricePerPerson : null,
          courses,
        };
      })
      .filter((v): v is Record<string, unknown> => v !== null);

    // Tiers eindeutig + Reihenfolge low/medium/high
    const seen = new Set<string>();
    const tierOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
    const variants = cleanedVariants
      .filter((v) => {
        const t = v.tier as string;
        if (seen.has(t)) return false;
        seen.add(t);
        return true;
      })
      .sort((a, b) => (tierOrder[a.tier as string] ?? 99) - (tierOrder[b.tier as string] ?? 99));

    if (variants.length === 0) {
      return new Response(JSON.stringify({ error: "KI lieferte keine gültigen Varianten" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Im catering-Modus auf 1 Variante normalisieren (Medium-Tier bevorzugt, sonst erste).
    const finalVariants =
      target === "catering"
        ? [variants.find((v) => v.tier === "medium") ?? variants[0]].filter(Boolean)
        : variants;

    return new Response(JSON.stringify({ overallReasoning, variants: finalVariants }), {
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