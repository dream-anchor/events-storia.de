import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

interface ReqBody {
  inquiryId: string;
  target?: "event" | "catering";
}

type Source = "catering" | "restaurant";

interface MenuItemLite {
  id: string; // präfixierte ID (catering_… / ristorante_…)
  rawId: string;
  source: Source;
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
  package_type: string | null;
  includes: string[] | null;
}

interface EquipmentLite {
  id: string;
  name: string;
  price_per_unit: number | null;
  unit: string | null;
}

const SYSTEM_PROMPT = `Du bist der Maître des Storia — Gastgeber, Küchenchef und Angebots-Experte in einer Person. STORIA betreibt zwei Linien: das Ristorante Storia (Events IM Haus) und STORIA Catering (außer Haus). Aus einer Kundenanfrage erstellst du genau drei Menü-Varianten (low, medium, high), aus denen das Team im Angebots-Builder auswählt.

ZUERST: GESCHÄFTSLINIE BESTIMMEN
Entscheide aus dem Inhalt der Anfrage, ob das Event IM HAUS (Restaurant) oder AUSSER HAUS (Catering) stattfindet:
- Catering / außer Haus: Feier beim Kunden, zu Hause, in fremder Location; „zu mir", „bei mir zu Hause", eigene Adresse, „liefern", Kunde stellt Tische/Deko/Geschirr selbst, Platten- oder Familienservice ohne Restauranträume.
- Restaurant / im Haus: Veranstaltung bei STORIA; Räume (Private Room, Gesamte Location), Tischreservierung, „bei euch", „im Restaurant".
Im Zweifel entscheiden Standort und Logistik. In der Regel teilen alle drei Varianten dieselbe businessLine. Liegt am Vorgang ein location_type vor, halte dich daran; sonst leite die Linie aus dem Inhalt ab.

ITEMS NACH LINIE TRENNEN
Jede Speise ist mit Quelle markiert: [Catering] (ID-Präfix catering_…) oder [Restaurant] (ID-Präfix ristorante_…). Catering-Anfrage → ausschließlich [Catering]-Speisen; Restaurant-Anfrage → ausschließlich [Restaurant]-Speisen. Mische die Linien nie. Übernimm die ID immer vollständig inklusive Präfix.

PAKETE & PREIS-ORIENTIERUNG (wichtig)
Pakete sind im Kontext mit [Restaurant] oder [Gruppenreisen] getaggt — beide gehören zur Restaurant-/Haus-Linie. Es gibt KEINE catering-spezifischen Pakete. Behandle [Gruppenreisen]-Pakete genauso wie [Restaurant]-Pakete: mode='paket' ist nur bei businessLine='restaurant' zulässig.
Die p.P.-Preise dieser Pakete dienen ABER beiden Linien als Preis-Orientierung/Anker für estimatedPricePerPerson. Die strikte Linien-Trennung gilt nur für die Auswahl konkreter Speisen in courses[] und für die Wahl von mode='paket', NICHT für die Preis-Orientierung.

KATEGORIEN GEZIELT NUTZEN
Die Speisen sind im Kontext nach Kategorie gruppiert. Bestimme aus der Anfrage, welche Gänge gewünscht sind, und ziehe für jeden Gang NUR aus den thematisch passenden Kategorien — du musst nicht alle durchsuchen. Orientierung (Kategorienamen können leicht abweichen, gehe nach Bedeutung):
- Restaurant: Suppen/Antipasti/Salate → starter; Risotto/Pasta (Cilento & Gragnano)/Hausgemachte Pasta → pasta; Secondi di Pesce → main_fish; Secondi di Carne → main_meat; Beilagen → als zusätzliche items im jeweiligen Hauptgang; Pizzen (alle Pizza-Kategorien) → main (courseLabel „Pizza"); Desserts → dessert; Degustationsmenüs → fertige Mehrgänge mit Pro-Person-Festpreis, eignen sich besonders für die high-Variante.
- Catering: Fingerfood & Mini-Gerichte → fingerfood; Platten & Sharing → starter (kalte Sharing-Platten, courseLabel z. B. „Platten zum Teilen"); Warme Gerichte & Aufläufe → main bzw. main_meat/main_fish je nach Protein des Gerichts; Pizza Napoletana → main (courseLabel „Pizza"); Desserts → dessert. „Events im Storia" ist eine Verlinkung zur Restaurant-Linie, keine bestellbare Catering-Kategorie.
courseType vegetarisch/vegan nur, wenn der Kunde ausdrücklich ein vegetarisches/veganes Menü wünscht; sonst die normalen Gang-Typen verwenden und vegane/vegetarische Items dort einsetzen.

GANG UND PROTEIN ERKENNEN
Bestimme Protein und Gang aus Kategorie und Gerichtsname mit deinem kulinarischen Wissen (meist italienische Gerichte): „Secondi di Carne", „Tagliata di Manzo", „Ossobuco" = Fleisch; „Secondi di Pesce", „Branzino", „Salmone", „Dorade" = Fisch. Eine Pasta oder Vorspeise mit Fleisch-/Fischanteil ist KEIN vollwertiger Fleisch- oder Fisch-Hauptgang — ordne sie als pasta bzw. starter ein. Wünscht der Kunde Fleisch UND Fisch, nimm beide als getrennte Hauptgänge auf (main_meat und main_fish).

NUR VORHANDENE SPEISEN
Verwende ausschließlich Gerichte aus der Liste mit korrekter, vollständiger ID (inkl. Präfix). Erfinde niemals Gerichte oder IDs. Fehlt für einen gewünschten Gang ein passendes Gericht in der richtigen Kategorie/Linie, wähle das nächstliegende vorhandene und vermerke das knapp im reasoning.

QUELLE WÄHLEN — PAKET ODER MENÜ
- mode='paket' (nur bei businessLine='restaurant'): Ein vorhandenes Paket deckt den Wunsch im Wesentlichen ab. packageId angeben. Schlage ein Paket nur vor, wenn die Gästezahl zu min/max passt oder unbekannt ist. Standort-/Location-Pakete (z. B. „Gesamte Location") nur im Haus.
- mode='menu': Der Wunsch ist individuell oder es ist eine Catering-Anfrage. Stelle die Gänge aus den vorhandenen Speisen der passenden Linie/Kategorien zusammen.

DREI STUFEN (low / medium / high)
Kein festes Preisband. Nutze die p.P.-Preise der Pakete als Orientierungsraster (linien-übergreifend, siehe oben).
- low: schlanke, preisbewusste Variante.
- medium: empfohlene Variante mit bestem Verhältnis. Nennt der Kunde ein Budget, ankert medium daran.
- high: gehobene Variante — mehr Gänge, Premium-Komponenten oder exklusivere Nutzung.
Die drei Varianten müssen sich spürbar in Umfang und Niveau unterscheiden, nicht nur im Preis. Halte dich an die vom Kunden beschriebene Struktur, wenn er eine vorgibt (z. B. Vorspeisen-Platten, warmer Hauptgang, Dessert im Glas).

PREISE — serving_info AUSWERTEN
estimatedPricePerPerson ist ein realistischer Brutto-Preis pro Person; Schätzung, finale Preise kommen aus Maestro. Keine Rabatte, keine erfundenen Summen.
Lies pro Item das Feld serving_info und entscheide die Preiseinheit:
- Enthält serving_info „pro Person" (z. B. „Eine Fingerfood-Schale pro Person") oder fehlt es bei Restaurant-à-la-carte → price ist bereits der Pro-Person-Preis. Summiere je ein Gericht pro Gang.
- Enthält serving_info eine Personen- oder Stückzahl (z. B. „Ideal für 6-8 Personen", „Platte aus 12 Spießen", „Auswahl an 16 Bruschette") → Platten-/Buffet-Posten. Setze serves = die genannte Zahl (bei Bereichen die OBERE Zahl, um nicht zu überteuern; Stück-/Spieß-Angaben als Portionsanzahl, 1 Portion ≈ 1 Stück). Rechne: benötigte Menge = aufgerundet(Gäste / serves); Beitrag p.P. = (Menge × price) / Gäste. Ist die Gästezahl unbekannt, schätze konservativ und vermerke die Annahme im reasoning.
- Fixpreis-Pakete (Pauschale für die ganze Location): bei bekannter Gästezahl p.P. = Pauschale / Gäste; sonst passendstes p.P.-Paket als Anker, Annahme vermerken.
- Fehlt serving_info ganz und kein Stückpreis-Kontext ist erkennbar („servierfertig geliefert" o. ä.) → als Pauschale behandeln, Annahme im reasoning vermerken; NIE als 1 €/Person verbuchen.
Beachte min_order (z. B. „Ab 4 Personen bestellbar") als Mindestmenge — schlage keine Position unterhalb ihrer Mindestmenge vor. Summiere alle Pro-Person-Beiträge der gewählten Gänge zu estimatedPricePerPerson.

EQUIPMENT (nur Catering / außer Haus)
Schlage je Variante passendes Equipment aus dem EQUIPMENT-KATALOG vor (Feld equipment), abgestimmt auf Gästezahl und Service-Art: Stehtische bei stehenden Fingerfood-/Aperitivo-Events; Gedecke/Geschirr/Besteck/Gläser ungefähr pro Gast; Warmhalte-/Chafing-Lösungen bei warm serviertem oder im Ofen geschmortem Essen; Servierplatten/Schalen beim Familienservice. Nutze vorhandene Katalog-Einträge mit ID (catalogId), sonst catalogId=null und sprechenden Namen. Equipment fließt NICHT in estimatedPricePerPerson ein. Bei businessLine='restaurant' kein Equipment.

BEGRÜNDUNG (Deutsch, knapp, muttersprachlich)
- overallReasoning: erkannte Geschäftslinie + kurze Begründung, Kern-Wunsch des Kunden, wodurch sich low/medium/high unterscheiden.
- reasoning je Variante: warum diese Stufe passt, was enthalten ist, warum der Preis (inkl. Annahmen bei Platten/Pauschalen).

AUSGABE
Antworte ausschließlich über den Funktionsaufruf propose_menu_variants — kein Freitext. Standard sind genau drei Varianten (low, medium, high). Erzwingt die User-Nachricht eine abweichende Vorgabe (z. B. Warenkorb-Modus: genau eine Variante, tier=medium, mode=menu, nur Catering-Items, keine Pakete), befolge diese Vorgabe.`;

function packageLineTag(p: PackageLite): string {
  return p.package_type === "gruppenreisen" ? "[Gruppenreisen]" : "[Restaurant]";
}

function buildContext(
  inquiry: Record<string, unknown>,
  packages: PackageLite[],
  menuItems: MenuItemLite[],
  equipment: EquipmentLite[],
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

  parts.push("# VERFÜGBARE PAKETE (Restaurant-/Haus-Linie — auch [Gruppenreisen] zählt zur Restaurant-Linie)");
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
      parts.push(`- ${packageLineTag(p)} id="${p.id}" | ${p.name} | ${price}${range}`);
      if (p.description) parts.push(`  ${p.description.slice(0, 200)}`);
      if (Array.isArray(p.includes) && p.includes.length > 0) {
        parts.push(`  Inklusiv: ${p.includes.join(" · ").slice(0, 200)}`);
      }
    }
  }
  parts.push("");

  parts.push("# VERFÜGBARE MENU-ITEMS");
  // Gruppe: Source → Kategorie → Items
  const bySource: Record<Source, Map<string, MenuItemLite[]>> = {
    restaurant: new Map(),
    catering: new Map(),
  };
  for (const it of menuItems) {
    const m = bySource[it.source];
    if (!m.has(it.category)) m.set(it.category, []);
    m.get(it.category)!.push(it);
  }
  const renderSource = (label: string, m: Map<string, MenuItemLite[]>) => {
    if (m.size === 0) {
      parts.push(`\n## ${label} (keine Items geladen)`);
      return;
    }
    for (const [cat, items] of m) {
      parts.push(`\n## ${label} ${cat}`);
      for (const it of items) {
        const price = it.price ? `${it.price} €` : "—";
        const tags = [it.is_vegan ? "vegan" : it.is_vegetarian ? "vegetarisch" : null].filter(Boolean).join(", ");
        const serving = it.serving_info ? ` | reicht: ${it.serving_info}` : "";
        const minOrder = it.min_order ? ` | ${it.min_order}` : "";
        parts.push(`- id="${it.id}" | ${it.name} | ${price}${serving}${minOrder}${tags ? ` [${tags}]` : ""}`);
      }
    }
  };
  renderSource("[Restaurant]", bySource.restaurant);
  renderSource("[Catering]", bySource.catering);

  parts.push("");
  parts.push("# EQUIPMENT-KATALOG (nur für Catering relevant)");
  if (equipment.length === 0) {
    parts.push("(noch keine Einträge gepflegt — du darfst Equipment mit catalogId=null vorschlagen)");
  } else {
    for (const e of equipment) {
      const price = e.price_per_unit != null ? `${e.price_per_unit} €` : "Preis n/a";
      const unit = e.unit ? `/${e.unit}` : "";
      parts.push(`- id="${e.id}" | ${e.name} | ${price}${unit}`);
    }
  }

  return parts.join("\n");
}

/**
 * Restaurant-Items aus dem externen Ristorante-Projekt laden (über die
 * vorhandene Edge Function fetch-ristorante-menus). Bei Fehler/Timeout
 * leere Liste — der KI-Flow läuft mit Catering-only weiter.
 */
async function loadRistoranteItems(supabaseUrl: string, serviceKey: string): Promise<MenuItemLite[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/fetch-ristorante-menus`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ menuTypes: ["food", "lunch"] }),
    });
    if (!res.ok) {
      console.warn("[generate-menu-suggestion] fetch-ristorante-menus failed:", res.status);
      return [];
    }
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.slice(0, 250).map((it: Record<string, unknown>): MenuItemLite => {
      const rawId = String(it.id);
      return {
        id: `ristorante_${rawId}`,
        rawId,
        source: "restaurant",
        name: String(it.name ?? ""),
        description: (it.description as string | null) ?? null,
        price: (it.price as number | null) ?? null,
        category: ((it.category_name as string | null) ?? "Sonstiges"),
        is_vegetarian: (it.is_vegetarian as boolean | null) ?? null,
        is_vegan: (it.is_vegan as boolean | null) ?? null,
        serving_info: (it.serving_info as string | null) ?? null,
        min_order: null,
      };
    });
  } catch (err) {
    console.warn("[generate-menu-suggestion] Restaurant-Quelle nicht erreichbar:", err);
    return [];
  }
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

    // 2) Aktive Pakete (alle Restaurant-/Gruppen-Linie — keine catering-spezifischen Pakete)
    const { data: packagesRaw } = await supabase
      .from("packages")
      .select("id, name, description, price, price_per_person, min_guests, max_guests, is_active, package_type, includes")
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
      package_type: (p.package_type as string | null) ?? null,
      includes: Array.isArray(p.includes) ? (p.includes as string[]) : null,
    }));

    // 3) Catering-Items + Restaurant-Items (beide Linien, präfixierte IDs)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const [{ data: cateringRaw }, ristoranteItems, { data: equipmentRaw }] = await Promise.all([
      supabase
        .from("menu_items")
        .select("id, name, description, price, is_vegetarian, is_vegan, serving_info, min_order, menu_categories!inner(name)")
        .is("deleted_at", null)
        .is("archived_at", null)
        .limit(250),
      loadRistoranteItems(supabaseUrl, serviceKey),
      supabase
        .from("equipment_catalog")
        .select("id, name, price_per_unit, unit")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const cateringItems: MenuItemLite[] = (cateringRaw ?? []).map((r: Record<string, unknown>) => {
      const rawId = String(r.id);
      return {
        id: `catering_${rawId}`,
        rawId,
        source: "catering",
        name: String(r.name ?? ""),
        description: (r.description as string | null) ?? null,
        price: (r.price as number | null) ?? null,
        category: ((r.menu_categories as { name?: string } | null)?.name) ?? "Sonstiges",
        is_vegetarian: (r.is_vegetarian as boolean | null) ?? null,
        is_vegan: (r.is_vegan as boolean | null) ?? null,
        serving_info: (r.serving_info as string | null) ?? null,
        min_order: (r.min_order as string | null) ?? null,
      };
    });

    const menuItems: MenuItemLite[] = [...cateringItems, ...ristoranteItems];

    const equipment: EquipmentLite[] = (equipmentRaw ?? []).map((e: Record<string, unknown>) => ({
      id: String(e.id),
      name: String(e.name ?? ""),
      price_per_unit: (e.price_per_unit as number | null) ?? null,
      unit: (e.unit as string | null) ?? null,
    }));

    const context = buildContext(inquiry as Record<string, unknown>, packages, menuItems, equipment);
    console.log(
      `[generate-menu-suggestion] context built: catering=${cateringItems.length}, restaurant=${ristoranteItems.length}, packages=${packages.length}, equipment=${equipment.length}, chars=${context.length}`,
    );
    // Vollen Kontext loggen (zum Verifizieren der Etappe 1 — kann später entfernt werden)
    console.log(`[generate-menu-suggestion] CONTEXT >>>\n${context}\n<<< END CONTEXT`);

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