import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  loadBusinessData,
  resolveLocationAddress,
  resolveBillingAddress,
  formatLocationOneLine,
} from '../_shared/addressResolver.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** 'per_person' (Default) oder 'per_event' (Gesamtpreis für Anlass) */
  pricingMode?: 'per_person' | 'per_event';
  drinksMode?: 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln';
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
  type: 'custom';
  name: string;
  description: string;
  quantity: number;
  unitName: string;
  unitPrice: {
    currency: 'EUR';
    netAmount: number;
    taxRatePercentage: number;
  };
}

// ─── Line-item builder ────────────────────────────────────────────────────────

const FOOD_TAX_RATE = 7;
const DRINK_TAX_RATE = 19;
const bruttoToNet = (brutto: number, taxPct: number) =>
  round2(brutto / (1 + taxPct / 100));

function buildLineItems(
  opt: OfferOption,
  packageName: string | null,
  guestOverride?: number,
): LexOfficeLineItem[] {
  const ms = opt.menu_selection;
  const guestCount = guestOverride && guestOverride > 0
    ? guestOverride
    : (parseInt(String(opt.guest_count)) || 1);
  const totalAmount = opt.total_amount || 0;
  const items: LexOfficeLineItem[] = [];

  // Pricing-Modus per_event: Positionen mit korrektem MwSt-Split.
  // WICHTIG: totalAmount und alle overridePrice-/pricePerPerson-Werte sind BRUTTO
  // (so gibt der Admin die Preise in Maestro ein). LexOffice erwartet aber
  // netAmount in den Line-Items. Deshalb rechnen wir hier Brutto -> Netto zurueck.
  //   Essen:    Netto = Brutto / 1.07
  //   Getraenke: Netto = Brutto / 1.19
  // Jede Speise / jedes Getraenk wird zu einer eigenen Line-Item-Zeile.
  if (ms?.pricingMode === 'per_event') {
    const FOOD_TAX = FOOD_TAX_RATE;
    const DRINK_TAX = DRINK_TAX_RATE;

    type BruttoEntry = { name: string; description: string; brutto: number; tax: number; unitName: string };
    const entries: BruttoEntry[] = [];

    // --- Speisen: eine Zeile pro Gericht ---
    for (const c of (ms.courses || [])) {
      if (!c.itemName || c.overridePrice == null || c.overridePrice <= 0) continue;
      const qty = c.quantity ?? 1;
      const lineBrutto = round2((c.overridePrice || 0) * qty);
      if (lineBrutto <= 0) continue;
      // qty im Namen mitteilen damit der Kunde versteht woher die Summe kommt
      const name = qty > 1 ? `${qty} × ${c.itemName}` : c.itemName;
      entries.push({
        name,
        description: c.itemDescription || '',
        brutto: lineBrutto,
        tax: FOOD_TAX,
        unitName: 'Portion',
      });
    }

    // --- Getraenke: je nach drinksMode ---
    const drinkMode = ms.drinksMode ?? 'none';
    if (drinkMode === 'einzeln' && ms.drinksEinzeln) {
      for (const d of ms.drinksEinzeln) {
        if (!d.name || d.pricePerPerson <= 0) continue;
        const qty = d.quantity ?? 1;
        const lineBrutto = round2(d.pricePerPerson * qty);
        if (lineBrutto <= 0) continue;
        const name = qty > 1 ? `${qty} × ${d.name}` : d.name;
        entries.push({
          name,
          description: '',
          brutto: lineBrutto,
          tax: DRINK_TAX,
          unitName: 'Stk',
        });
      }
    } else if (drinkMode === 'pauschale' && ms.drinksPauschalePrice && ms.drinksPauschalePrice > 0) {
      entries.push({
        name: ms.drinksPauschaleDescription || 'Getränkepauschale',
        description: '',
        brutto: round2(ms.drinksPauschalePrice),
        tax: DRINK_TAX,
        unitName: 'Stk',
      });
    } else if ((drinkMode === 'weinbegleitung' || drinkMode === 'none') && ms.winePairingPrice && ms.winePairingPrice > 0) {
      entries.push({
        name: 'Weinbegleitung',
        description: '',
        brutto: round2(ms.winePairingPrice),
        tax: DRINK_TAX,
        unitName: 'Stk',
      });
    }

    // --- Proportionale Korrektur falls Summe != totalAmount (Override wurde angepasst) ---
    const entriesSum = round2(entries.reduce((s, e) => s + e.brutto, 0));
    if (entriesSum > 0 && totalAmount > 0 && Math.abs(entriesSum - totalAmount) > 0.01) {
      const factor = totalAmount / entriesSum;
      for (const e of entries) {
        e.brutto = round2(e.brutto * factor);
      }
      // Rundungs-Restbetrag auf letzte Zeile legen damit die Summe exakt stimmt
      const adjSum = round2(entries.reduce((s, e) => s + e.brutto, 0));
      const diff = round2(totalAmount - adjSum);
      if (Math.abs(diff) > 0 && entries.length > 0) {
        entries[entries.length - 1].brutto = round2(entries[entries.length - 1].brutto + diff);
      }
    }

    // --- Brutto -> Netto fuer LexOffice ---
    for (const e of entries) {
      if (e.brutto <= 0) continue;
      items.push({
        type: 'custom',
        name: e.name,
        description: e.description,
        quantity: 1,
        unitName: e.unitName,
        unitPrice: {
          currency: 'EUR',
          netAmount: bruttoToNet(e.brutto, e.tax),
          taxRatePercentage: e.tax,
        },
      });
    }

    // Fallback: keine Positionen erkannt — eine Sammelzeile
    if (items.length === 0) {
      items.push({
        type: 'custom',
        name: opt.offer_mode === 'menu' ? 'Catering-Bestellung' : (packageName || 'Veranstaltungspaket'),
        description: '',
        quantity: 1,
        unitName: 'Stk',
        unitPrice: { currency: 'EUR', netAmount: bruttoToNet(round2(totalAmount), FOOD_TAX), taxRatePercentage: FOOD_TAX },
      });
    }
    return items;
  }

  if (opt.offer_mode === 'menu' && ms?.courses && ms.courses.length > 0) {
    const courses = ms.courses.filter(c => c.itemName);
    const winePricePerPerson = ms.winePairingPrice ?? 0;

    // Try to use per-course overridePrice if set
    const hasOverridePrices = courses.some(
      c => c.overridePrice != null && c.overridePrice > 0,
    );

    if (hasOverridePrices) {
      for (const course of courses) {
        const price = course.overridePrice != null && course.overridePrice > 0
          ? course.overridePrice
          : 0;
        if (price === 0) continue;
        items.push({
          type: 'custom',
          name: `${course.courseLabel}: ${course.itemName}`,
          description: course.itemDescription || '',
          quantity: 1,
          unitName: 'Person',
          unitPrice: {
            currency: 'EUR',
            netAmount: bruttoToNet(price, FOOD_TAX_RATE),
            taxRatePercentage: 7,
          },
        });
      }
    } else {
      // No individual prices — distribute total evenly across courses
      const wineTotalBrutto = winePricePerPerson * guestCount;
      const courseTotalBrutto = totalAmount - wineTotalBrutto;
      const pricePerCourseNet = courses.length > 0
        ? bruttoToNet(courseTotalBrutto / courses.length / guestCount, FOOD_TAX_RATE)
        : 0;

      for (const course of courses) {
        items.push({
          type: 'custom',
          name: `${course.courseLabel}: ${course.itemName}`,
          description: course.itemDescription || '',
          quantity: 1,
          unitName: 'Person',
          unitPrice: {
            currency: 'EUR',
            netAmount: pricePerCourseNet,
            taxRatePercentage: 7,
          },
        });
      }
    }

    // Getränke: je nach drinksMode eigene Positionen
    const drinkMode = ms.drinksMode ?? 'none';

    if (drinkMode === 'pauschale' && ms.drinksPauschalePrice && ms.drinksPauschalePrice > 0) {
      items.push({
        type: 'custom',
        name: ms.drinksPauschaleDescription || 'Getränkepauschale',
        description: '',
        quantity: 1,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          netAmount: bruttoToNet(ms.drinksPauschalePrice, DRINK_TAX_RATE),
          taxRatePercentage: 19,
        },
      });
    } else if (drinkMode === 'weinbegleitung' && ms.winePairingPrice && ms.winePairingPrice > 0) {
      items.push({
        type: 'custom',
        name: 'Weinbegleitung zum Menü',
        description: '',
        quantity: 1,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          netAmount: bruttoToNet(ms.winePairingPrice, DRINK_TAX_RATE),
          taxRatePercentage: 19,
        },
      });
    } else if (drinkMode === 'einzeln' && ms.drinksEinzeln && ms.drinksEinzeln.length > 0) {
      for (const drink of ms.drinksEinzeln) {
        if (drink.pricePerPerson > 0) {
          items.push({
            type: 'custom',
            name: drink.name,
            description: '',
            quantity: 1,
            unitName: 'Person',
            unitPrice: {
              currency: 'EUR',
              netAmount: bruttoToNet(drink.pricePerPerson, DRINK_TAX_RATE),
              taxRatePercentage: 19,
            },
          });
        }
      }
    } else if ((drinkMode === 'none' || !drinkMode) && winePricePerPerson > 0) {
      // Fallback: Altes Verhalten (winePairingPrice direkt gesetzt ohne neuen Modus)
      const drinkLabels = (ms.drinks || [])
        .map(d => d.drinkLabel + (d.selectedChoice ? `: ${d.selectedChoice}` : ''))
        .join(', ');
      items.push({
        type: 'custom',
        name: 'Getränkebegleitung',
        description: drinkLabels,
        quantity: 1,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          netAmount: bruttoToNet(winePricePerPerson, DRINK_TAX_RATE),
          taxRatePercentage: 19,
        },
      });
    }

    // Multiplikation: Zwischensummen + (guestCount-1) für korrekte Gesamtsumme
    if (guestCount > 1 && items.length > 0) {
      const foodTotal = round2(items
        .filter(i => i.unitPrice.taxRatePercentage === 7)
        .reduce((s, i) => s + i.unitPrice.netAmount * i.quantity, 0));
      const drinkTotal = round2(items
        .filter(i => i.unitPrice.taxRatePercentage === 19)
        .reduce((s, i) => s + i.unitPrice.netAmount * i.quantity, 0));

      if (foodTotal > 0) {
        items.push({
          type: 'custom',
          name: 'Menü pro Person (netto)',
          description: '',
          quantity: 1,
          unitName: 'Stück',
          unitPrice: { currency: 'EUR', netAmount: foodTotal, taxRatePercentage: 7 },
        });
        items.push({
          type: 'custom',
          name: `Speisen × ${guestCount} Personen`,
          description: '',
          quantity: guestCount - 1,
          unitName: 'Person',
          unitPrice: { currency: 'EUR', netAmount: foodTotal, taxRatePercentage: 7 },
        });
      }
      if (drinkTotal > 0) {
        items.push({
          type: 'custom',
          name: 'Getränke pro Person (netto)',
          description: '',
          quantity: 1,
          unitName: 'Stück',
          unitPrice: { currency: 'EUR', netAmount: drinkTotal, taxRatePercentage: 19 },
        });
        items.push({
          type: 'custom',
          name: `Getränke × ${guestCount} Personen`,
          description: '',
          quantity: guestCount - 1,
          unitName: 'Person',
          unitPrice: { currency: 'EUR', netAmount: drinkTotal, taxRatePercentage: 19 },
        });
      }
    }
  } else {
    // Paket-Modus oder E-Mail-Modus: eine Gesamtposition
    // totalAmount ist BRUTTO (Maestro-Eingabe). Pro-Person-Preis brutto -> netto fuer LexOffice.
    const unitPriceBrutto = guestCount > 0 ? totalAmount / guestCount : 0;
    items.push({
      type: 'custom',
      name: packageName || 'Veranstaltungspaket',
      description: '',
      quantity: guestCount,
      unitName: 'Person',
      unitPrice: {
        currency: 'EUR',
        netAmount: bruttoToNet(unitPriceBrutto, FOOD_TAX_RATE),
        taxRatePercentage: 7,
      },
    });
  }

  return items;
}

function formatDateDE(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildIntroduction(
  inquiry: Record<string, unknown> | null,
  ms: MenuSelectionDB | null,
  locationLine: string | null,
): string {
  // Hinweis: Speisen/Getraenke werden hier NICHT mehr aufgelistet (jetzt Line-Items).
  void ms;
  const rawDate = inquiry?.preferred_date ? String(inquiry.preferred_date) : null;
  const parts = [
    `Event-Angebot für den ${rawDate ? formatDateDE(rawDate) : 'nach Vereinbarung'}`,
    `Gäste: ${inquiry?.guest_count || '-'} Personen`,
    `Art: ${inquiry?.event_type ? capitalize(String(inquiry.event_type)) : '-'}`,
  ];
  if (locationLine) parts.push(`Veranstaltungsort: ${locationLine}`);
  return parts.join('\n');
}

function buildPaymentConditions(
  depositPercent: number,
  depositDueDays: number,
): { paymentTermLabel: string; paymentTermDuration: number } {
  const paymentTermDuration = Math.max(1, depositDueDays || 1);

  if (depositPercent === 0) {
    return {
      paymentTermLabel: 'Zahlung vollständig bei Auftragserteilung',
      paymentTermDuration,
    };
  }

  if (depositPercent === 100) {
    return {
      paymentTermLabel: `Vorauszahlung 100% innerhalb von ${paymentTermDuration} Tagen ab Rechnungsdatum`,
      paymentTermDuration,
    };
  }

  return {
    paymentTermLabel: `Anzahlung ${depositPercent}% innerhalb von ${paymentTermDuration} Tagen`,
    paymentTermDuration,
  };
}

function buildRemarkText(depositPercent: number, offerValidityDays: number): string {
  if (depositPercent === 0) {
    return `Dieses Angebot ist ${offerValidityDays} Tage gültig.`;
  }

  return `Restzahlung vor Veranstaltung. Dieses Angebot ist ${offerValidityDays} Tage gültig.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { inquiryId, useSelectedQuantity } = await req.json();
    if (!inquiryId) throw new Error('inquiryId fehlt');

    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) throw new Error('LEXOFFICE_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Anfrage laden
    const { data: inquiry, error: inqErr } = await supabase
      .from('event_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single();
    if (inqErr || !inquiry) throw new Error(`Anfrage nicht gefunden: ${inqErr?.message}`);

    // 2. Aktive Angebots-Optionen laden
    const { data: options, error: optErr } = await supabase
      .from('inquiry_offer_options')
      .select('offer_mode, total_amount, guest_count, selected_quantity, package_id, menu_selection')
      .eq('inquiry_id', inquiryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (optErr) throw new Error(`Optionen nicht geladen: ${optErr.message}`);

    let workingOptions = options || [];
    if (useSelectedQuantity) {
      workingOptions = workingOptions.filter(
        (o: { selected_quantity?: number | null }) => (o.selected_quantity ?? 0) > 0,
      );
    }

    if (workingOptions.length === 0) {
      throw new Error('Keine aktiven Angebots-Optionen gefunden');
    }

    // 3. Paketnamen für alle package_ids auflösen
    const packageIds = [...new Set(
      workingOptions.map((o: OfferOption) => o.package_id).filter(Boolean)
    )] as string[];

    const packageNameMap: Record<string, string> = {};
    if (packageIds.length > 0) {
      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, name')
        .in('id', packageIds);
      for (const p of pkgs || []) {
        packageNameMap[p.id] = p.name;
      }
    }

    // 4. Line-Items aus allen aktiven Optionen bauen
    const lineItems: LexOfficeLineItem[] = [];
    for (const opt of workingOptions as Array<OfferOption & { selected_quantity?: number | null }>) {
      const pkgName = opt.package_id ? packageNameMap[opt.package_id] || null : null;
      const guestOverride = useSelectedQuantity ? (opt.selected_quantity ?? 0) : undefined;
      lineItems.push(...buildLineItems(opt, pkgName, guestOverride));
    }

    if (lineItems.length === 0) {
      throw new Error('Keine Positionen für das Angebot — Menü oder Paket konfigurieren');
    }

    // 5. Adressen live auflösen (kein Snapshot)
    const businessData = await loadBusinessData(supabase);
    const locationAddr = resolveLocationAddress(inquiry as never, businessData);
    const billingAddr = resolveBillingAddress(inquiry as never);
    const locationLine = formatLocationOneLine(locationAddr);

    if (!billingAddr.street || !billingAddr.postalCode || !billingAddr.city) {
      console.warn('[create-event-quotation] Empfänger-Adresse unvollständig — nur Name wird gesetzt', {
        inquiryId,
        billing: billingAddr,
      });
    }

    // 6. Einleitungstext aus erster aktiver Option (inkl. Veranstaltungsort)
    const firstOpt = workingOptions[0] as OfferOption;
    const introduction = buildIntroduction(
      inquiry as Record<string, unknown>,
      firstOpt.menu_selection,
      locationLine,
    );

    // 6b. Zahlungs-Konditionen — pro Inquiry, Fallback auf site_settings.default_payment_terms
    const inq = inquiry as Record<string, unknown>;
    let depositPercent = inq.deposit_percent as number | null | undefined;
    let depositDueDays = inq.deposit_due_days as number | null | undefined;
    let offerValidityDays = inq.offer_validity_days as number | null | undefined;

    if (depositPercent == null || depositDueDays == null || offerValidityDays == null) {
      const { data: settings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'default_payment_terms')
        .maybeSingle();
      const defaults = (settings?.value || {}) as { deposit_percent?: number; deposit_due_days?: number; offer_validity_days?: number };
      if (depositPercent == null) depositPercent = defaults.deposit_percent ?? 20;
      if (depositDueDays == null) depositDueDays = defaults.deposit_due_days ?? 5;
      if (offerValidityDays == null) offerValidityDays = defaults.offer_validity_days ?? 14;
    }

    const paymentConditions = buildPaymentConditions(depositPercent, depositDueDays);
    const remarkText = buildRemarkText(depositPercent, offerValidityDays);

    // 7. LexOffice Angebot aufbauen — Empfänger aus resolved billing
    const quotationPayload = {
      voucherDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + offerValidityDays * 24 * 60 * 60 * 1000).toISOString(),
      address: {
        name: billingAddr.name || inquiry.contact_name,
        supplement: billingAddr.name && inquiry.contact_name && billingAddr.name !== inquiry.contact_name
          ? inquiry.contact_name
          : undefined,
        street: billingAddr.street || '',
        zip: billingAddr.postalCode || '',
        city: billingAddr.city || '',
        countryCode: billingAddr.countryCode,
      },
      lineItems,
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      paymentConditions,
      introduction,
      remark: remarkText,
    };

    console.log('Creating LexOffice quotation:', JSON.stringify(quotationPayload, null, 2));

    // 7. LexOffice API
    const response = await fetch('https://api.lexoffice.io/v1/quotations?finalize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(quotationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LexOffice error:', errorText);
      throw new Error(`LexOffice API error: ${response.status} – ${errorText}`);
    }

    const result = await response.json();
    console.log('LexOffice quotation created:', result);

    return new Response(
      JSON.stringify({ success: true, quotationId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
