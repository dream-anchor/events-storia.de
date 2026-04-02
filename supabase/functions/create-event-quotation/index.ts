import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseSelectionDB {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
  overridePrice?: number | null;
}

interface DrinkSelectionDB {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
}

interface MenuSelectionDB {
  courses?: CourseSelectionDB[];
  drinks?: DrinkSelectionDB[];
  winePairingPrice?: number | null;
  budgetPerPerson?: number | null;
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

function buildLineItems(
  opt: OfferOption,
  packageName: string | null,
): LexOfficeLineItem[] {
  const ms = opt.menu_selection;
  const guestCount = opt.guest_count || 1;
  const totalAmount = opt.total_amount || 0;
  const items: LexOfficeLineItem[] = [];

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
          quantity: guestCount,
          unitName: 'Person',
          unitPrice: {
            currency: 'EUR',
            netAmount: round2(price),
            taxRatePercentage: 7,
          },
        });
      }
    } else {
      // No individual prices — distribute total evenly across courses
      const wineTotal = winePricePerPerson * guestCount;
      const courseTotal = totalAmount - wineTotal;
      const pricePerCourse = courses.length > 0
        ? round2(courseTotal / courses.length / guestCount)
        : 0;

      for (const course of courses) {
        items.push({
          type: 'custom',
          name: `${course.courseLabel}: ${course.itemName}`,
          description: course.itemDescription || '',
          quantity: guestCount,
          unitName: 'Person',
          unitPrice: {
            currency: 'EUR',
            netAmount: pricePerCourse,
            taxRatePercentage: 7,
          },
        });
      }
    }

    // Getränke als separate Position
    if (winePricePerPerson > 0) {
      const drinkLabels = (ms.drinks || [])
        .map(d => d.drinkLabel + (d.selectedChoice ? `: ${d.selectedChoice}` : ''))
        .join(', ');
      items.push({
        type: 'custom',
        name: 'Getränkebegleitung',
        description: drinkLabels,
        quantity: guestCount,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          netAmount: round2(winePricePerPerson),
          taxRatePercentage: 19,
        },
      });
    }
  } else {
    // Paket-Modus oder E-Mail-Modus: eine Gesamtposition
    const unitPrice = guestCount > 0 ? round2(totalAmount / guestCount) : 0;
    items.push({
      type: 'custom',
      name: packageName || 'Veranstaltungspaket',
      description: '',
      quantity: guestCount,
      unitName: 'Person',
      unitPrice: {
        currency: 'EUR',
        netAmount: unitPrice,
        taxRatePercentage: 7,
      },
    });
  }

  return items;
}

function buildIntroduction(inquiry: Record<string, unknown> | null, ms: MenuSelectionDB | null): string {
  const parts = [
    `Event-Angebot für ${inquiry?.preferred_date || 'nach Vereinbarung'}`,
    `Gäste: ${inquiry?.guest_count || '-'}`,
    `Art: ${inquiry?.event_type || '-'}`,
  ];

  if (ms?.courses && ms.courses.length > 0) {
    parts.push('\nIhr Menü:');
    ms.courses
      .filter(c => c.itemName)
      .forEach((c, i) => {
        let line = `${i + 1}. ${c.courseLabel}: ${c.itemName}`;
        if (c.itemDescription) line += ` – ${c.itemDescription}`;
        parts.push(line);
      });
  }

  if (ms?.drinks && ms.drinks.length > 0) {
    parts.push('\nGetränke:');
    ms.drinks.forEach(d => {
      let line = `• ${d.drinkLabel}`;
      if (d.selectedChoice) line += `: ${d.selectedChoice}`;
      if (d.quantityLabel) line += ` (${d.quantityLabel})`;
      parts.push(line);
    });
  }

  return parts.join('\n');
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
    const { inquiryId } = await req.json();
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
      .select('offer_mode, total_amount, guest_count, package_id, menu_selection')
      .eq('inquiry_id', inquiryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (optErr) throw new Error(`Optionen nicht geladen: ${optErr.message}`);

    if (!options || options.length === 0) {
      throw new Error('Keine aktiven Angebots-Optionen gefunden');
    }

    // 3. Paketnamen für alle package_ids auflösen
    const packageIds = [...new Set(
      options.map((o: OfferOption) => o.package_id).filter(Boolean)
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
    for (const opt of options as OfferOption[]) {
      const pkgName = opt.package_id ? packageNameMap[opt.package_id] || null : null;
      lineItems.push(...buildLineItems(opt, pkgName));
    }

    if (lineItems.length === 0) {
      throw new Error('Keine Positionen für das Angebot — Menü oder Paket konfigurieren');
    }

    // 5. Einleitungstext aus erster aktiver Option
    const firstOpt = options[0] as OfferOption;
    const introduction = buildIntroduction(
      inquiry as Record<string, unknown>,
      firstOpt.menu_selection,
    );

    // 6. LexOffice Angebot aufbauen
    const quotationPayload = {
      voucherDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      address: {
        name: inquiry.company_name || inquiry.contact_name,
        supplement: inquiry.company_name ? inquiry.contact_name : undefined,
        street: '',
        zip: '',
        city: '',
        countryCode: 'DE',
      },
      lineItems,
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      introduction,
      remark: 'Dieses Angebot ist 14 Tage gültig. Für alle Pakete ist eine Vorauszahlung von 100% erforderlich.',
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
