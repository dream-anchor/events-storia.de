import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  loadBusinessData,
  resolveLocationAddress,
  resolveBillingAddress,
  formatLocationOneLine,
} from "../_shared/addressResolver.ts";

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
  /** Menge bei per_event. Zeilen-Total = quantity * pricePerPerson. */
  quantity?: number | null;
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
    grossAmount: number;
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
    // Maestro-Admin gibt IMMER Brutto-Preise ein. LexOffice unterstuetzt Brutto
    // nativ via taxConditions.taxType='gross' + unitPrice.grossAmount und rechnet
    // die enthaltene MwSt heraus. Keine manuelle Konvertierung mehr noetig.
    const FOOD_TAX = 7;
    const DRINK_TAX = 19;

    type BruttoEntry = { name: string; description: string; brutto: number; tax: 7 | 19; unitName: string };
    const entries: BruttoEntry[] = [];

    // Speisen: eine Zeile pro Gericht
    for (const c of (ms.courses || [])) {
      if (!c.itemName || c.overridePrice == null || c.overridePrice <= 0) continue;
      const qty = c.quantity ?? 1;
      const lineBrutto = round2((c.overridePrice || 0) * qty);
      if (lineBrutto <= 0) continue;
      const name = qty > 1 ? `${qty} × ${c.itemName}` : c.itemName;
      entries.push({
        name,
        description: c.itemDescription || "",
        brutto: lineBrutto,
        tax: FOOD_TAX,
        unitName: "Portion",
      });
    }

    // Getraenke je nach drinksMode
    const drinkMode = ms.drinksMode ?? "none";
    if (drinkMode === "einzeln" && ms.drinksEinzeln) {
      for (const d of ms.drinksEinzeln) {
        if (!d.name || d.pricePerPerson <= 0) continue;
        const qty = d.quantity ?? 1;
        const lineBrutto = round2(d.pricePerPerson * qty);
        if (lineBrutto <= 0) continue;
        const name = qty > 1 ? `${qty} × ${d.name}` : d.name;
        entries.push({
          name,
          description: "",
          brutto: lineBrutto,
          tax: DRINK_TAX,
          unitName: "Stk",
        });
      }
    } else if (drinkMode === "pauschale" && ms.drinksPauschalePrice && ms.drinksPauschalePrice > 0) {
      entries.push({
        name: ms.drinksPauschaleDescription || "Getränkepauschale",
        description: "",
        brutto: round2(ms.drinksPauschalePrice),
        tax: DRINK_TAX,
        unitName: "Stk",
      });
    } else if ((drinkMode === "weinbegleitung" || drinkMode === "none") && ms.winePairingPrice && ms.winePairingPrice > 0) {
      entries.push({
        name: "Weinbegleitung",
        description: "",
        brutto: round2(ms.winePairingPrice),
        tax: DRINK_TAX,
        unitName: "Stk",
      });
    }

    // Proportionale Skalierung falls Summe != totalAmount
    const entriesSum = round2(entries.reduce((s, e) => s + e.brutto, 0));
    if (entriesSum > 0 && totalAmount > 0 && Math.abs(entriesSum - totalAmount) > 0.01) {
      const factor = totalAmount / entriesSum;
      for (const e of entries) {
        e.brutto = round2(e.brutto * factor);
      }
      const adjSum = round2(entries.reduce((s, e) => s + e.brutto, 0));
      const diff = round2(totalAmount - adjSum);
      if (Math.abs(diff) > 0 && entries.length > 0) {
        entries[entries.length - 1].brutto = round2(entries[entries.length - 1].brutto + diff);
      }
    }

    // Brutto direkt als grossAmount fuer LexOffice
    for (const e of entries) {
      if (e.brutto <= 0) continue;
      items.push({
        type: "custom",
        name: e.name,
        description: e.description,
        quantity: 1,
        unitName: e.unitName,
        unitPrice: {
          currency: "EUR",
          grossAmount: e.brutto,
          taxRatePercentage: e.tax,
        },
      });
    }

    if (items.length === 0) {
      items.push({
        type: "custom",
        name: opt.offer_mode === "menu" ? "Catering-Bestellung" : (packageName || "Veranstaltungspaket"),
        description: "",
        quantity: 1,
        unitName: "Stk",
        unitPrice: {
          currency: "EUR",
          grossAmount: round2(totalAmount),
          taxRatePercentage: FOOD_TAX,
        },
      });
    }
    return items;
  }

  // per_person-Fallback: Paket/E-Mail-Modus = eine Gesamtposition (Brutto)
  const unitPriceBrutto = guestCount > 0 ? round2(totalAmount / guestCount) : 0;
  items.push({
    type: "custom",
    name: packageName || "Veranstaltungspaket",
    description: "",
    quantity: guestCount,
    unitName: "Person",
    unitPrice: {
      currency: "EUR",
      grossAmount: unitPriceBrutto,
      taxRatePercentage: 7,
    },
  });
  return items;
}

function buildIntroduction(
  inquiry: Record<string, unknown> | null,
  ms: MenuSelectionDB | null,
  locationLine: string | null,
): string {
  void ms;
  const rawDate = inquiry?.preferred_date ? String(inquiry.preferred_date) : null;
  const parts = [
    `Event-Angebot für den ${rawDate ? formatDateDE(rawDate) : "nach Vereinbarung"}`,
    `Gäste: ${inquiry?.guest_count || "-"} Personen`,
    `Art: ${inquiry?.event_type ? capitalize(String(inquiry.event_type)) : "-"}`,
  ];
  if (locationLine) parts.push(`Veranstaltungsort: ${locationLine}`);
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

    // Summen-Check (Brutto)
    const optionsTotal = (options as OfferOption[]).reduce((s, o) => s + (o.total_amount || 0), 0);
    const lineItemsTotal = lineItems.reduce((s, i) => s + i.unitPrice.grossAmount * i.quantity, 0);
    console.log(`[repair] options_total=${optionsTotal}, line_items_total=${lineItemsTotal}`);

    // 5. Adressen live auflösen (kein Snapshot)
    const businessData = await loadBusinessData(supabase);
    const locationAddr = resolveLocationAddress(inquiry as never, businessData);
    const billingAddr = resolveBillingAddress(inquiry as never);
    const locationLine = formatLocationOneLine(locationAddr);

    if (!billingAddr.street || !billingAddr.postalCode || !billingAddr.city) {
      console.warn("[repair] Empfänger-Adresse unvollständig — nur Name wird gesetzt", {
        inquiryId,
        billing: billingAddr,
      });
    }

    // 6. Einleitungstext (inkl. Veranstaltungsort)
    const firstOpt = options[0] as OfferOption;
    const introduction = buildIntroduction(
      inquiry as Record<string, unknown>,
      firstOpt.menu_selection,
      locationLine,
    );

    // 7. Neue Quotation — Empfänger aus resolved billing
    const quotationPayload = {
      voucherDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      address: {
        name: billingAddr.name || inquiry.contact_name,
        supplement: billingAddr.name && inquiry.contact_name && billingAddr.name !== inquiry.contact_name
          ? inquiry.contact_name
          : undefined,
        street: billingAddr.street || "",
        zip: billingAddr.postalCode || "",
        city: billingAddr.city || "",
        countryCode: billingAddr.countryCode,
      },
      lineItems,
      totalPrice: { currency: "EUR" },
      taxConditions: { taxType: "gross" },
      introduction,
      remark: "Dieses Angebot ist 14 Tage gültig. Für alle Pakete ist eine Vorauszahlung von 100% erforderlich.",
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
    const { data: updatedInquiry, error: updErr } = await supabase
      .from("event_inquiries")
      .update({ lexoffice_quotation_id: newQuotationId })
      .eq("id", inquiryId)
      .select("lexoffice_quotation_id")
      .single();
    if (updErr) throw new Error(`Inquiry-Update: ${updErr.message}`);
    if (!updatedInquiry) throw new Error("Inquiry-Update: keine Zeile zurückgegeben");

    const { data: verifiedInquiry, error: verifyErr } = await supabase
      .from("event_inquiries")
      .select("lexoffice_quotation_id")
      .eq("id", inquiryId)
      .single();
    if (verifyErr) throw new Error(`Inquiry-Verify: ${verifyErr.message}`);
    if (verifiedInquiry.lexoffice_quotation_id !== newQuotationId) {
      throw new Error(
        `Inquiry-Verify: lexoffice_quotation_id ist ${verifiedInquiry.lexoffice_quotation_id ?? "NULL"} statt ${newQuotationId}`,
      );
    }

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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
