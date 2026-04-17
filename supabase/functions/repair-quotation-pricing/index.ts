import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Repair-Skript fuer eine fehlerhaft erstellte LexOffice-Quotation.
 *
 * Aufgabe: Eine existierende Quotation (deren ID in event_inquiries.lexoffice_quotation_id
 * steht) komplett neu erstellen mit korrekten Line-Items. Der typische Fehlerfall:
 * bei per_event-Bestellungen wurde die alte Logik genutzt die den Preis mit
 * guestCount multipliziert hat -> Faktor-N-Falschbetrag.
 *
 * Flow:
 *  1. Inquiry + aktive Options laden
 *  2. Neue Quotation mit finalize=true erstellen (mit neuer per_event-Logik)
 *  3. Alte Quotation stornieren/loeschen via LexOffice API
 *  4. lexoffice_quotation_id in inquiry auf neue ID setzen
 *
 * POST-Body: { inquiryId: string }
 */

interface CourseSelectionDB {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
  overridePrice?: number | null;
  /** Menge (quantity); bei Zeilen-Total = quantity * overridePrice */
  quantity?: number | null;
}

interface DrinkSelectionDB {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
}

interface DrinkEinzelnItemDB {
  id: string;
  name: string;
  pricePerPerson: number;
}

interface MenuSelectionDB {
  courses?: CourseSelectionDB[];
  drinks?: DrinkSelectionDB[];
  winePairingPrice?: number | null;
  budgetPerPerson?: number | null;
  pricingMode?: "per_person" | "per_event";
  drinksMode?: "none" | "pauschale" | "weinbegleitung" | "einzeln";
  drinksPauschalePrice?: number | null;
  drinksPauschaleDescription?: string | null;
  drinksEinzeln?: DrinkEinzelnItemDB[];
}

interface OfferOption {
  offer_mode: string;
  total_amount: number;
  guest_count: number;
  package_id: string | null;
  menu_selection: MenuSelectionDB | null;
}

interface LexOfficeLineItem {
  type: "custom";
  name: string;
  description: string;
  quantity: number;
  unitName: string;
  unitPrice: {
    currency: "EUR";
    netAmount: number;
    taxRatePercentage: number;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDateDE(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildLineItems(
  opt: OfferOption,
  packageName: string | null,
): LexOfficeLineItem[] {
  const ms = opt.menu_selection;
  const guestCount = parseInt(String(opt.guest_count)) || 1;
  const totalAmount = opt.total_amount || 0;
  const items: LexOfficeLineItem[] = [];

  // per_event: Positionen mit korrektem MwSt-Split.
  // Essen = 7%, Getraenke = 19%. Bei Catering-Bestellungen mit absoluten Mengen
  // ("11 x Salat") wird die Summe der overridePrices als Essen-Netto genommen,
  // und die Summe der Getraenke-Positionen als Getraenke-Netto. Wenn ein
  // budgetPerPerson-Override gesetzt ist, wird die Differenz proportional
  // auf Essen/Getraenke verteilt.
  if (ms?.pricingMode === "per_event") {
    // 1. Roh-Summen aus den Positionen (Zeilen-Total = quantity * overridePrice)
    const foodRaw = round2(
      (ms.courses || [])
        .filter((c) => c.itemName && c.overridePrice != null && c.overridePrice > 0)
        .reduce((s, c) => s + (c.overridePrice || 0) * (c.quantity ?? 1), 0),
    );
    let drinksRaw = 0;
    const drinkMode = ms.drinksMode ?? "none";
    if (drinkMode === "einzeln" && ms.drinksEinzeln) {
      drinksRaw = round2(
        ms.drinksEinzeln
          .filter((d) => d.pricePerPerson > 0)
          .reduce((s, d) => s + d.pricePerPerson, 0),
      );
    } else if (drinkMode === "pauschale" && ms.drinksPauschalePrice) {
      drinksRaw = round2(ms.drinksPauschalePrice);
    } else if (drinkMode === "weinbegleitung" && ms.winePairingPrice) {
      drinksRaw = round2(ms.winePairingPrice);
    } else if ((drinkMode === "none" || !drinkMode) && ms.winePairingPrice) {
      drinksRaw = round2(ms.winePairingPrice);
    }

    const rawSum = round2(foodRaw + drinksRaw);

    // 2. Proportionale Skalierung falls totalAmount von rawSum abweicht
    // (z.B. durch budgetPerPerson-Override oder Rabatt)
    let foodNet = foodRaw;
    let drinksNet = drinksRaw;
    if (rawSum > 0 && Math.abs(rawSum - totalAmount) > 0.01) {
      const factor = totalAmount / rawSum;
      foodNet = round2(foodRaw * factor);
      drinksNet = round2(totalAmount - foodNet); // Rest zu Getraenken, sichert exakte Summe
    }

    // 3. Line-Items erstellen
    const foodSummary = (ms.courses || [])
      .filter((c) => c.itemName)
      .map((c) => c.itemName)
      .join(", ");
    const drinkSummary = drinkMode === "einzeln"
      ? (ms.drinksEinzeln || []).filter((d) => d.name).map((d) => d.name).join(", ")
      : (ms.drinksPauschaleDescription || "Getraenke");

    if (foodNet > 0) {
      items.push({
        type: "custom",
        name: opt.offer_mode === "menu" ? "Catering-Bestellung (Speisen)" : (packageName || "Speisen"),
        description: foodSummary.length > 0 && foodSummary.length < 500 ? foodSummary : "",
        quantity: 1,
        unitName: "Stk",
        unitPrice: {
          currency: "EUR",
          netAmount: foodNet,
          taxRatePercentage: 7,
        },
      });
    }
    if (drinksNet > 0) {
      items.push({
        type: "custom",
        name: "Getraenke",
        description: drinkSummary.length > 0 && drinkSummary.length < 500 ? drinkSummary : "",
        quantity: 1,
        unitName: "Stk",
        unitPrice: {
          currency: "EUR",
          netAmount: drinksNet,
          taxRatePercentage: 19,
        },
      });
    }

    // Fallback wenn weder Essen noch Getraenke detectable: eine einzige Position mit 7%
    if (items.length === 0) {
      items.push({
        type: "custom",
        name: opt.offer_mode === "menu" ? "Catering-Bestellung" : (packageName || "Veranstaltungspaket"),
        description: foodSummary.length > 0 && foodSummary.length < 500 ? foodSummary : "",
        quantity: 1,
        unitName: "Stk",
        unitPrice: {
          currency: "EUR",
          netAmount: round2(totalAmount),
          taxRatePercentage: 7,
        },
      });
    }
    return items;
  }

  // per_person-Fallback: Paket/E-Mail-Modus = eine Gesamtposition
  const unitPrice = guestCount > 0 ? round2(totalAmount / guestCount) : 0;
  items.push({
    type: "custom",
    name: packageName || "Veranstaltungspaket",
    description: "",
    quantity: guestCount,
    unitName: "Person",
    unitPrice: {
      currency: "EUR",
      netAmount: unitPrice,
      taxRatePercentage: 7,
    },
  });
  return items;
}

function buildIntroduction(
  inquiry: Record<string, unknown> | null,
  ms: MenuSelectionDB | null,
): string {
  const rawDate = inquiry?.preferred_date ? String(inquiry.preferred_date) : null;
  const parts = [
    `Event-Angebot fuer den ${rawDate ? formatDateDE(rawDate) : "nach Vereinbarung"}`,
    `Gaeste: ${inquiry?.guest_count || "-"} Personen`,
    `Art: ${inquiry?.event_type ? capitalize(String(inquiry.event_type)) : "-"}`,
  ];
  if (ms?.courses && ms.courses.length > 0) {
    parts.push("\nPositionen:");
    ms.courses
      .filter((c) => c.itemName)
      .forEach((c, i) => {
        let line = `${i + 1}. ${c.itemName}`;
        if (c.itemDescription) line += ` - ${c.itemDescription}`;
        parts.push(line);
      });
  }
  return parts.join("\n");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { inquiryId } = await req.json();
    if (!inquiryId) throw new Error("inquiryId fehlt");

    const lexofficeApiKey = Deno.env.get("LEXOFFICE_API_KEY");
    if (!lexofficeApiKey) throw new Error("LEXOFFICE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Inquiry + alte Quotation-ID laden
    const { data: inquiry, error: inqErr } = await supabase
      .from("event_inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();
    if (inqErr || !inquiry) throw new Error(`Inquiry nicht gefunden: ${inqErr?.message}`);

    const oldQuotationId = inquiry.lexoffice_quotation_id as string | null;
    console.log(`[repair] Inquiry ${inquiryId}, alte Quotation: ${oldQuotationId}`);

    // 2. Aktive Options laden
    const { data: options, error: optErr } = await supabase
      .from("inquiry_offer_options")
      .select("offer_mode, total_amount, guest_count, package_id, menu_selection")
      .eq("inquiry_id", inquiryId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (optErr) throw new Error(`Optionen nicht geladen: ${optErr.message}`);
    if (!options || options.length === 0) throw new Error("Keine aktiven Options");

    // 3. Paketnamen
    const packageIds = [...new Set(
      options.map((o: OfferOption) => o.package_id).filter(Boolean),
    )] as string[];
    const packageNameMap: Record<string, string> = {};
    if (packageIds.length > 0) {
      const { data: pkgs } = await supabase
        .from("packages")
        .select("id, name")
        .in("id", packageIds);
      for (const p of pkgs || []) packageNameMap[p.id] = p.name;
    }

    // 4. Line-Items
    const lineItems: LexOfficeLineItem[] = [];
    for (const opt of options as OfferOption[]) {
      const pkgName = opt.package_id ? packageNameMap[opt.package_id] || null : null;
      lineItems.push(...buildLineItems(opt, pkgName));
    }
    if (lineItems.length === 0) throw new Error("Keine Positionen generiert");

    // Summen-Check
    const optionsTotal = (options as OfferOption[]).reduce((s, o) => s + (o.total_amount || 0), 0);
    const lineItemsTotal = lineItems.reduce((s, i) => s + i.unitPrice.netAmount * i.quantity, 0);
    console.log(`[repair] options_total=${optionsTotal}, line_items_total=${lineItemsTotal}`);

    // 5. Einleitungstext
    const firstOpt = options[0] as OfferOption;
    const introduction = buildIntroduction(
      inquiry as Record<string, unknown>,
      firstOpt.menu_selection,
    );

    // 6. Neue Quotation
    const quotationPayload = {
      voucherDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      address: {
        name: inquiry.company_name || inquiry.contact_name,
        supplement: inquiry.company_name ? inquiry.contact_name : undefined,
        street: "",
        zip: "",
        city: "",
        countryCode: "DE",
      },
      lineItems,
      totalPrice: { currency: "EUR" },
      taxConditions: { taxType: "net" },
      introduction,
      remark: "Dieses Angebot ist 14 Tage gueltig. Fuer alle Pakete ist eine Vorauszahlung von 100% erforderlich.",
    };

    const createRes = await fetch("https://api.lexoffice.io/v1/quotations?finalize=true", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lexofficeApiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(quotationPayload),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("[repair] LexOffice create failed:", errorText);
      throw new Error(`LexOffice create: ${createRes.status} - ${errorText}`);
    }

    const newQuotation = await createRes.json();
    const newQuotationId = newQuotation.id as string;
    console.log(`[repair] Neue Quotation: ${newQuotationId}`);

    // 7. Inquiry-Referenz updaten
    const { error: updErr } = await supabase
      .from("event_inquiries")
      .update({ lexoffice_quotation_id: newQuotationId })
      .eq("id", inquiryId);
    if (updErr) throw new Error(`Inquiry-Update: ${updErr.message}`);

    // 8. Alte Quotation loeschen (nur draft, sonst manuell in LexOffice)
    let oldQuotationCleanup: "deleted" | "needs_manual" | "not_attempted" = "not_attempted";
    if (oldQuotationId) {
      try {
        const delRes = await fetch(
          `https://api.lexoffice.io/v1/quotations/${oldQuotationId}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${lexofficeApiKey}`,
              "Accept": "application/json",
            },
          },
        );
        if (delRes.ok || delRes.status === 204) {
          oldQuotationCleanup = "deleted";
          console.log(`[repair] Alte Quotation ${oldQuotationId} geloescht`);
        } else {
          oldQuotationCleanup = "needs_manual";
          const txt = await delRes.text();
          console.warn(`[repair] Alte Quotation konnte nicht geloescht werden (${delRes.status}): ${txt}`);
        }
      } catch (e) {
        oldQuotationCleanup = "needs_manual";
        console.warn("[repair] DELETE fehlgeschlagen:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        newQuotationId,
        oldQuotationId,
        oldQuotationCleanup,
        lineItemsCount: lineItems.length,
        totalAmount: lineItemsTotal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[repair] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
