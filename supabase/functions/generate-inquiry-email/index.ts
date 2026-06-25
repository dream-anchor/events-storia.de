import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';



// Sender mapping for personalized signatures
const SENDER_INFO: Record<string, { firstName: string; mobile?: string }> = {
  'monot@hey.com': { firstName: 'Antoine' },
  'mimmo2905@yahoo.de': { firstName: 'Domenico', mobile: '+49 163 6033912' },
  'nicola@storia.de': { firstName: 'Nicola' },
  'madi@events-storia.de': { firstName: 'Madina', mobile: '+49 179 2200921' },
  'madina.khader@gmail.com': { firstName: 'Madina', mobile: '+49 179 2200921' },
  'info@storia.de': { firstName: 'STORIA Team' },
};

// Fallback-Signatur falls DB leer
const DEFAULT_COMPANY_FOOTER = `Speranza GmbH
Karlstraße 47a
80333 München
Deutschland

Telefon: +49 89 51519696
E-Mail: info@events-storia.de`;

/** Lädt die E-Mail-Signatur aus der DB (email_templates, category='signatur') */
async function loadCompanyFooter(supabaseAdmin: any): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('email_templates')
      .select('content')
      .eq('category', 'signatur')
      .eq('is_active', true)
      .limit(1)
      .single();
    return (data as any)?.content || DEFAULT_COMPANY_FOOTER;
  } catch {
    return DEFAULT_COMPANY_FOOTER;
  }
}

// Types for legacy format
interface CourseSelection {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
}

interface DrinkSelection {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
}

interface MenuSelection {
  courses: CourseSelection[];
  drinks: DrinkSelection[];
}

// Legacy request format (flat fields)
interface LegacyRequest {
  inquiryType: 'event' | 'catering';
  contactName: string;
  companyName?: string;
  eventType?: string;
  guestCount?: string;
  preferredDate?: string;
  timeSlot?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  packages?: Array<{ name: string; price: number }>;
  deliveryAddress?: string;
  deliveryTime?: string;
  totalAmount?: number;
  notes?: string;
  menuSelection?: MenuSelection;
  packageName?: string;
  senderEmail?: string;
  customerMessage?: string; // Original message from customer inquiry
}

// Multi-Offer request format (nested)
interface MultiOfferInquiry {
  contact_name: string;
  company_name?: string;
  email?: string;
  preferred_date?: string;
  guest_count?: string;
  event_type?: string;
  time_slot?: string;
  room_selection?: string;
  message?: string;
}

interface MultiOfferOption {
  label: string;
  packageName: string;
  offerMode?: string;
  guestCount: number;
  totalAmount: number;
  menuSelection?: MenuSelection;
  pricingMode?: 'per_person' | 'per_event';
  paymentLinkUrl?: string;
  // Rabatt-/Brutto-Infos (kommen aus menu_selection.discountPercent/discountAmount)
  discountPercent?: number;
  discountAmount?: number;
  subtotalAmount?: number;
  // Freitext-Programm (KI-Import) — wenn vorhanden, ersetzt es Menü/Getränke-Logik.
  freeformProgram?: {
    title?: string;
    location?: string | null;
    dateRangeLabel?: string | null;
    scopeOfServices?: string[] | null;
    days?: Array<{
      dateLabel: string;
      isoDate?: string | null;
      meals?: Array<{
        label: string;
        guestCount: number;
        flatPriceNet: number;
        vatRate: number;
        sections?: Array<{ heading?: string | null; items: string[] }>;
      }>;
    }>;
    taxBreakdown?: {
      foodNet: number;
      foodVatRate: number;
      foodVatAmount?: number | null;
      servicesNet: number;
      servicesVatRate: number;
      servicesVatAmount?: number | null;
    };
    totalsFromText?: { net: number; gross: number };
    notes?: string[] | null;
    discount?: { mode: 'percent' | 'amount'; value: number } | null;
  } | null;
}

interface MultiOfferRequest {
  inquiry: MultiOfferInquiry;
  options: MultiOfferOption[];
  isMultiOption: true;
  senderEmail?: string;
}

// OfferBuilder request format (new: fetches data from DB)
interface OfferBuilderRequest {
  inquiryId: string;
  phase: 'proposal' | 'final';
}

type RequestBody = LegacyRequest | MultiOfferRequest | OfferBuilderRequest;

function formatEUR(amount: number): string {
  // Truncate to 2 decimals (no rounding up), German format with thousand separator.
  const truncated = Math.trunc(amount * 100) / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(truncated);
}

function isOfferBuilderRequest(body: RequestBody): body is OfferBuilderRequest {
  return 'inquiryId' in body && 'phase' in body && !('isMultiOption' in body);
}

function isMultiOfferRequest(body: RequestBody): body is MultiOfferRequest {
  return 'isMultiOption' in body && body.isMultiOption === true && 'options' in body;
}

function buildMultiOfferContext(inquiry: MultiOfferInquiry, options: MultiOfferOption[]): string {
  const parts: string[] = [];

  parts.push(`Kunde: ${inquiry.contact_name || '(kein Name bekannt)'}${inquiry.company_name ? ` (${inquiry.company_name})` : ''}`);

  // Freitext-Erkennung: NICHT vom offer_mode-String abhängig machen — manche
  // Datensätze haben offer_mode='menu', tragen aber trotzdem ein vollständiges
  // freeformProgram im menu_selection. Wenn days[] vorhanden ist, ist es Freitext.
  const isFreeformOpt = (o: MultiOfferOption) => !!o.freeformProgram?.days?.length;
  const allFreeform = options.length > 0 && options.every(isFreeformOpt);

  // Nur tatsächlich vorhandene Daten aufnehmen
  if (inquiry.event_type) parts.push(`Event-Typ (nur Hintergrundinfo, NICHT im Text verwenden!): ${inquiry.event_type}`);
  if (!allFreeform) {
    // Bei reinen Freitext-Angeboten kommen Datum/Gäste aus freeformProgram.dateRangeLabel
    // bzw. variieren je Mahlzeit — Inquiry-Werte würden die KI zu „29. Juni 2026" /
    // „833 Gäste" verleiten.
    if (inquiry.preferred_date) parts.push(`Datum: ${inquiry.preferred_date}`);
    if (inquiry.guest_count) parts.push(`Gäste: ${inquiry.guest_count}`);
  } else {
    parts.push(`Datum: SIEHE freeformProgram.dateRangeLabel (Mehrtages-Programm — NIEMALS ein Einzeldatum aus anderen Feldern verwenden).`);
    parts.push(`Gäste: VARIABEL je Mahlzeit — NIEMALS eine Gesamtgästezahl nennen.`);
  }
  if (inquiry.time_slot && !allFreeform) parts.push(`Uhrzeit: ${inquiry.time_slot} Uhr`);
  if (inquiry.room_selection) parts.push(`Raum: ${inquiry.room_selection}`);

  // Optionen — nur aufnehmen was tatsächlich konfiguriert ist
  const hasOptions = options.length > 0;
  const hasMenu = options.some(o => o.menuSelection?.courses?.some(c => c.itemName));
  // Paket-Erkennung NICHT vom aufgelösten packageName abhängig machen —
  // package_id kann fehlen (Custom-Paket) und der Name landet dann in
  // menu_selection.packageNameOverride. offer_mode='paket' oder 'full_menu'
  // signalisiert klar: hier wurde etwas konfiguriert, kein Leerangebot.
  const isPackageOpt = (o: MultiOfferOption) =>
    !isFreeformOpt(o) && (
      o.offerMode === 'paket' ||
      o.offerMode === 'full_menu' ||
      (o.offerMode !== 'menu' && o.offerMode !== 'email'
        && !!o.packageName && o.packageName !== 'Individuell')
    );
  const hasPackage = options.some(isPackageOpt);
  const hasFreeform = options.some(isFreeformOpt);
  // Nur reine Email-Optionen → wirklich keine Konfiguration
  const allEmailOnly = hasOptions && options.every(o => o.offerMode === 'email' && !isPackageOpt(o) && !isFreeformOpt(o) && !(o.menuSelection?.courses?.some(c => c.itemName)));

  if (hasOptions) {
    parts.push('');
    parts.push(`Angebotene Optionen (${options.length}):`);

    for (const opt of options) {
      const label = options.length > 1 ? `Option ${opt.label}` : 'Angebot';
      const optParts: string[] = [];

      // ============ FREITEXT-PROGRAMM (KI-Import) ============
      if (isFreeformOpt(opt)) {
        const prog = opt.freeformProgram;
        parts.push(`\n--- ${label} (FREITEXT-PROGRAMM, mehrtägig) ---`);
        if (prog.title) parts.push(`Titel: ${prog.title}`);
        if (prog.dateRangeLabel) parts.push(`Zeitraum: ${prog.dateRangeLabel}`);
        if (prog.location) parts.push(`Location: ${prog.location}`);

        parts.push(`Gästezahl: VARIABEL je Mahlzeit — NIEMALS eine Gesamtgästezahl summieren und NIEMALS einen Pro-Person-Preis berechnen.`);

        if (prog.scopeOfServices && prog.scopeOfServices.length > 0) {
          parts.push('Leistungsumfang:');
          for (const s of prog.scopeOfServices) parts.push(`  • ${s}`);
        }

        for (const day of prog.days) {
          parts.push(`\n${day.dateLabel} (${(day.meals || []).length} Mahlzeit${(day.meals || []).length === 1 ? '' : 'en'}):`);
          for (const meal of day.meals || []) {
            const priceTxt = meal.flatPriceNet > 0 ? ` — ${formatEUR(meal.flatPriceNet)} netto (${meal.vatRate}% MwSt)` : '';
            parts.push(`  ▸ ${meal.label} · ${meal.guestCount} Pers.${priceTxt}`);
            for (const sec of meal.sections || []) {
              if (sec.heading) parts.push(`      ${sec.heading}:`);
              for (const it of sec.items || []) parts.push(`        – ${it}`);
            }
          }
        }

        const tb = prog.taxBreakdown;
        if (tb) {
          parts.push('');
          parts.push('Kalkulation (1:1 aus Maestro, NICHT neu berechnen):');
          if (tb.foodNet > 0) parts.push(`  Speisen netto: ${formatEUR(tb.foodNet)} (+ ${tb.foodVatRate}% MwSt = ${formatEUR(tb.foodVatAmount ?? 0)})`);
          if (tb.servicesNet > 0) parts.push(`  Personal/Equipment netto: ${formatEUR(tb.servicesNet)} (+ ${tb.servicesVatRate}% MwSt = ${formatEUR(tb.servicesVatAmount ?? 0)})`);
        }
        if (prog.totalsFromText) {
          parts.push(`  Gesamt netto: ${formatEUR(prog.totalsFromText.net)}`);
          parts.push(`  Gesamt brutto: ${formatEUR(prog.totalsFromText.gross)}`);
        }
        const disc = prog.discount;
        let discAmt = 0;
        if (disc && Number(disc.value) > 0) {
          discAmt = disc.mode === 'percent'
            ? (Number(prog.totalsFromText?.gross || 0) * Number(disc.value)) / 100
            : Number(disc.value);
          parts.push(`  Rabatt: ${disc.mode === 'percent' ? `${disc.value}% (entspricht ${formatEUR(discAmt)})` : formatEUR(discAmt)}`);
        }
        // Effektiver Endbetrag: opt.totalAmount falls > 0, sonst aus totalsFromText.gross − discount.
        const grossFromText = Number(prog.totalsFromText?.gross || 0);
        const effectiveGross = Number(opt.totalAmount) > 0
          ? Number(opt.totalAmount)
          : Math.max(0, grossFromText - discAmt);
        if (effectiveGross > 0) {
          parts.push(`  ENDBETRAG BRUTTO (= Hauptzahl im Anschreiben, EXAKT übernehmen, NIEMALS 0,00 schreiben): ${formatEUR(effectiveGross)}`);
        } else {
          parts.push(`  ENDBETRAG BRUTTO: NICHT VERFÜGBAR — lasse die Preisangabe im Anschreiben komplett weg, erfinde keinen Betrag.`);
        }

        if (prog.notes && prog.notes.length > 0) {
          parts.push('');
          parts.push('Hinweise (sinngemäß im Anschreiben erwähnen, NICHT erfinden):');
          for (const n of prog.notes) parts.push(`  • ${n}`);
        }
        continue; // Standard-Menü/Getränke/Equipment-Pfad überspringen
      }

      if (isPackageOpt(opt) && opt.packageName) {
        optParts.push(`Paket: ${opt.packageName}`);
      }
      if (opt.guestCount > 0) optParts.push(`${opt.guestCount} Gäste`);

      // Preis-Darstellung je nach pricingMode:
      //   per_event: Gesamtpreis fuer den Anlass (z.B. 5-Tage-Lieferung, Mehrtages-Catering)
      //   per_person (default): Preis pro Person
      if (opt.pricingMode === 'per_event' && opt.totalAmount > 0) {
        optParts.push(`Gesamtpreis (Endpreis nach Rabatt): ${formatEUR(opt.totalAmount)} fuer den gesamten Anlass`);
      } else if (opt.totalAmount > 0 && opt.guestCount > 0) {
        optParts.push(`${formatEUR(opt.totalAmount / opt.guestCount)} pro Person (Endpreis nach Rabatt)`);
      }

      parts.push(`\n--- ${label} ---`);
      if (optParts.length > 0) parts.push(optParts.join(', '));

      const courses = opt.menuSelection?.courses?.filter(c => c.itemName) || [];
      if (courses.length > 0) {
        parts.push('Menü:');
        for (const c of courses) {
          const qty = (c as { quantity?: number | null }).quantity;
          const hasQty = typeof qty === 'number' && qty > 1;
          const namePrefix = hasQty ? `${qty} × ` : '';
          parts.push(`  ${c.courseLabel}: ${namePrefix}${c.itemName}`);
        }
      }

      const drinks = opt.menuSelection?.drinks?.filter(d => d.selectedChoice || d.quantityLabel) || [];
      const drinksEinzeln = ((opt.menuSelection as Record<string, unknown> | undefined)?.drinksEinzeln as Array<{ name?: string; quantity?: number | null; pricePerPerson?: number }> | undefined) || [];
      const drinksEinzelnFiltered = drinksEinzeln.filter(d => d?.name);
      const hasRealDrinks = drinks.length > 0 || drinksEinzelnFiltered.length > 0;
      if (drinks.length > 0) {
        parts.push('Getränke:');
        for (const d of drinks) {
          // Inklusiv-Einträge (z.B. Wasser/Kaffee) haben kein selectedChoice, sondern quantityLabel="inklusive"
          if (d.selectedChoice) {
            const qty = d.quantityLabel && !/^(inklusive|inkl\.?|included)$/i.test(d.quantityLabel)
              ? ` (${d.quantityLabel})`
              : '';
            parts.push(`  ${d.drinkLabel}: ${d.selectedChoice}${qty}`);
          } else {
            // Reine Inklusiv-Position: z.B. Wasser inklusive, Kaffee-Spezialitäten inklusive
            parts.push(`  ${d.drinkLabel}: inklusive`);
          }
        }
      } else if (!hasRealDrinks) {
        parts.push('Getränke: KEINE im Angebot — im Anschreiben DARF KEIN Getränke-Satz vorkommen. Kein "Wasser wird gestellt", kein "zwei Getränke pro Person", keine erfundenen Wein/Spritz/Bier-Optionen. Thema Getränke komplett auslassen.');
      }

      // Einzeln-Getränke (z.B. Softdrinks, Wein nach Flaschen) — werden separat
      // in menuSelection.drinksEinzeln gespeichert und müssen auch im Anschreiben
      // erscheinen, sonst fehlen Positionen wenn der Modus „einzeln" aktiv ist.
      if (drinksEinzelnFiltered.length > 0) {
        parts.push('Weitere Getränke:');
        for (const d of drinksEinzelnFiltered) {
          const q = typeof d.quantity === 'number' && d.quantity > 1 ? `${d.quantity} × ` : '';
          parts.push(`  ${q}${d.name}`);
        }
      }

      // Equipment & Staff context for AI
      const equipment = (opt.menuSelection as any)?.equipment?.filter((e: any) => e.name && e.pricePerUnit > 0 && e.quantity > 0) || [];
      if (equipment.length > 0) {
        parts.push('Ausstattung:');
        for (const e of equipment) {
          parts.push(`  ${e.name}: ${e.quantity}x ${formatEUR(Number(e.pricePerUnit))}`);
        }
      }

      const staff = (opt.menuSelection as any)?.staff?.filter((e: any) => e.name && e.pricePerUnit > 0 && e.quantity > 0) || [];
      if (staff.length > 0) {
        parts.push('Personal:');
        for (const e of staff) {
          parts.push(`  ${e.name}: ${e.quantity}x ${formatEUR(Number(e.pricePerUnit))}`);
        }
      }

      // Rabatt-Block: falls Rabatt vorhanden, explizit für die KI ausweisen.
      // Die KI muss diesen Rabatt im Anschreiben erwähnen (siehe HARTE REGEL Nr. 6).
      const discountPercent = Number(opt.discountPercent ?? 0);
      const discountAmount = Number(opt.discountAmount ?? 0);
      const subtotal = Number(opt.subtotalAmount ?? 0);
      if (discountAmount > 0 || discountPercent > 0) {
        parts.push('Rabatt: JA — MUSS im Anschreiben erwähnt werden. Der oben genannte Gesamtpreis IST der Endpreis nach Rabatt.');
        if (subtotal > 0) {
          parts.push(`  Zwischensumme vor Rabatt: ${formatEUR(subtotal)}`);
        }
        if (discountAmount > 0) {
          parts.push(`  Rabattbetrag: -${formatEUR(discountAmount)}`);
        } else if (discountPercent > 0) {
          parts.push(`  Rabatt: ${discountPercent} %`);
        }
        if (opt.totalAmount > 0) {
          parts.push(`  Endpreis nach Rabatt (= Hauptpreis im Anschreiben): ${formatEUR(opt.totalAmount)}`);
        }
      }
    }
  }

  // Inhalts-Status für den Prompt — Fallback NUR wenn wirklich nichts konfiguriert ist.
  // Wenn mindestens eine Option ein Paket, Menü oder Freitext trägt, ist die
  // Formulierung "noch keine Menü-/Paketkonfiguration" verboten.
  if (!hasMenu && !hasPackage && !hasFreeform) {
    parts.push('\nHINWEIS: Es sind noch KEINE Menüs oder Pakete konfiguriert. Schreibe ein einfaches, allgemeines Anschreiben.');
  } else {
    parts.push('\nHARTE REGEL: Mindestens eine Option enthält ein Paket, Menü oder Programm. Die Formulierungen "noch keine Menü- oder Paketkonfiguration", "Aktuell liegt uns noch keine ... vor" oder Ähnliches sind STRENG VERBOTEN. Beziehe dich konkret auf das/die konfigurierten Pakete/Menüs.');
  }

  if (inquiry.message) {
    parts.push('');
    parts.push(`Kundenanmerkung: ${inquiry.message}`);
  }

  return parts.join('\n');
}

function buildLegacyContext(body: LegacyRequest): string {
  let menuContext = '';
  if (body.menuSelection) {
    if (body.menuSelection.courses && body.menuSelection.courses.length > 0) {
      menuContext += 'Ausgewähltes Menü: ';
      menuContext += body.menuSelection.courses.map(c => c.itemName).join(', ');
      menuContext += '\n';
    }
    
    if (body.menuSelection.drinks && body.menuSelection.drinks.length > 0) {
      menuContext += 'Getränke: ';
      menuContext += body.menuSelection.drinks.map(d => d.selectedChoice || d.drinkLabel).join(', ');
      menuContext += '\n';
    }
  }

  if (body.inquiryType === 'event') {
    return `
Kunde: ${body.contactName}${body.companyName ? ` (${body.companyName})` : ''}
Event: ${body.eventType || 'Feier'}
Datum: ${body.preferredDate || 'nach Absprache'}${body.timeSlot ? ` um ${body.timeSlot} Uhr` : ''}
Gäste: ${body.guestCount || 'n.a.'}
${body.packageName ? `Paket: ${body.packageName}` : ''}
${menuContext}
${body.notes ? `Bemerkung: ${body.notes}` : ''}
${body.customerMessage ? `Kundenanfrage: ${body.customerMessage}` : ''}
    `.trim();
  } else {
    return `
Kunde: ${body.contactName}${body.companyName ? ` (${body.companyName})` : ''}
Lieferung: ${body.deliveryAddress || 'n.a.'}
Datum/Zeit: ${body.preferredDate || ''} ${body.deliveryTime || ''}
${menuContext}
${body.notes ? `Bemerkung: ${body.notes}` : ''}
${body.customerMessage ? `Kundenanfrage: ${body.customerMessage}` : ''}
    `.trim();
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth-Check: Nur admin/staff dürfen E-Mails generieren
    const auth = await requireAuth(req);

    const rawBody: RequestBody = await req.json();

    // Sender-E-Mail kommt direkt aus der Auth
    const senderEmail = auth.email;

    const senderInfo = SENDER_INFO[senderEmail?.toLowerCase() || ''] || { firstName: 'STORIA Team', mobile: '' };

    // Signatur: KI erzeugt nur Grußformel + Name, Company Footer wird nachträglich angehängt
    const shortSignature = `Viele Grüße
${senderInfo.firstName}${senderInfo.mobile ? `\n${senderInfo.mobile}` : ''}`;

    // Build context based on request format
    let context: string;
    let isMultiOption = false;
    let optionCount = 0;
    let isProposal = false;
    let paymentMethod = 'deposit_online';
    let isRevision = false;
    let lastSentAtISO: string | null = null;

    // Previous successful emails for few-shot learning
    let previousEmails: string[] = [];

    if (isOfferBuilderRequest(rawBody)) {
      // New: Fetch data from DB
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Lade die letzten 3 gesendeten E-Mails als Beispiele für den Schreibstil
      const { data: exampleEmails } = await supabaseAdmin
        .from('inquiry_offer_history')
        .select('email_content')
        .not('email_content', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(3);

      if (exampleEmails?.length) {
        previousEmails = exampleEmails
          .map(e => e.email_content)
          .filter((e): e is string => !!e && e.length > 50 && e.length < 3000);
      }

      const { data: inquiryData } = await supabaseAdmin
        .from('event_inquiries')
        .select('contact_name, company_name, email, preferred_date, guest_count, event_type, time_slot, room_selection, message, payment_method')
        .eq('id', rawBody.inquiryId)
        .single();

      const { data: optionsData } = await supabaseAdmin
        .from('inquiry_offer_options')
        .select('option_label, guest_count, total_amount, menu_selection, is_active')
        .eq('inquiry_id', rawBody.inquiryId)
        .eq('is_active', true)
        .order('sort_order');

      // Also try to get package names + offer_mode
      const { data: optionsWithPkg } = await supabaseAdmin
        .from('inquiry_offer_options')
        .select('option_label, guest_count, total_amount, menu_selection, package_id, offer_mode, is_active')
        .eq('inquiry_id', rawBody.inquiryId)
        .eq('is_active', true)
        .order('sort_order');

      const pkgIds = [...new Set((optionsWithPkg || []).filter(o => o.package_id).map(o => o.package_id))];
      let pkgNames: Record<string, string> = {};
      if (pkgIds.length > 0) {
        const { data: pkgs } = await supabaseAdmin
          .from('packages')
          .select('id, name')
          .in('id', pkgIds);
        pkgNames = Object.fromEntries((pkgs || []).map(p => [p.id, p.name]));
      }

      if (!inquiryData) throw new Error('Inquiry not found');

      // Payment method for AI context
      paymentMethod = (inquiryData as any).payment_method || 'deposit_online';

      isMultiOption = true;
      isProposal = rawBody.phase === 'proposal';
      const opts = optionsData || [];
      optionCount = opts.length;

      const multiOpts: MultiOfferOption[] = (optionsWithPkg || []).map(o => {
        const menuSel = o.menu_selection as (MenuSelection & {
          pricingMode?: 'per_person' | 'per_event';
          discountPercent?: number;
          discountAmount?: number;
        }) | undefined;
        const discountPercent = Number(menuSel?.discountPercent ?? 0);
        const discountAmount = Number(menuSel?.discountAmount ?? 0);
        const total = Number(o.total_amount);
        // Zwischensumme (vor Rabatt) für die KI rekonstruieren, damit die
        // Mail einen sauberen Hinweis wie "Zwischensumme X, Rabatt Y, Endpreis Z" liefern kann.
        let subtotal = total;
        if (discountAmount > 0) {
          subtotal = total + discountAmount;
        } else if (discountPercent > 0 && discountPercent < 100) {
          subtotal = total / (1 - discountPercent / 100);
        }
        const pkgNameOverride = (menuSel as any)?.packageNameOverride as string | undefined;
        const resolvedPkgName = (o.offer_mode === 'menu')
          ? 'Individuell'
          : (pkgNames[o.package_id] || pkgNameOverride || (o.offer_mode === 'paket' || o.offer_mode === 'full_menu' ? 'Paket' : 'Individuell'));
        return {
          label: o.option_label,
          offerMode: o.offer_mode || undefined,
          packageName: resolvedPkgName,
          guestCount: o.guest_count,
          totalAmount: total,
          menuSelection: menuSel,
          pricingMode: menuSel?.pricingMode || 'per_person',
          discountPercent,
          discountAmount,
          subtotalAmount: subtotal,
          freeformProgram: (menuSel as any)?.freeformProgram ?? null,
        };
      });

      context = buildMultiOfferContext(
        {
          contact_name: inquiryData.contact_name,
          company_name: inquiryData.company_name,
          preferred_date: inquiryData.preferred_date,
          guest_count: inquiryData.guest_count,
          event_type: inquiryData.event_type,
          time_slot: inquiryData.time_slot,
          room_selection: inquiryData.room_selection,
          message: inquiryData.message,
        },
        multiOpts
      );

      // Append payment method to context
      {
      const pmLabels: Record<string, string> = {
        'deposit_online': 'Anzahlung online',
        'prepayment_online': 'Vorauszahlung online (100%)',
        'on_site': 'Zahlung vor Ort',
        'invoice_after': 'Rechnung nach Event',
      };
      context += `\nZahlungsart: ${pmLabels[paymentMethod] || paymentMethod}`;
      }

      // Revisions-Erkennung: Wurde bereits eine Version dieses Angebots versendet?
      try {
        const { data: sentHistory } = await supabaseAdmin
          .from('inquiry_offer_history')
          .select('sent_at')
          .eq('inquiry_id', rawBody.inquiryId)
          .not('sent_at', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(1);
        if (sentHistory && sentHistory.length > 0) {
          isRevision = true;
          lastSentAtISO = (sentHistory[0] as { sent_at: string }).sent_at;
          const dateStr = lastSentAtISO
            ? new Date(lastSentAtISO).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : null;
          context += `\nRevisions-Status: ÜBERARBEITETE VERSION. Eine frühere Version wurde${dateStr ? ` am ${dateStr}` : ''} bereits an den Kunden versendet. Das Anschreiben muss das ausdrücklich erwähnen (überarbeitetes Angebot / angepasste Version).`;
        }
      } catch (revErr) {
        console.warn('[generate-inquiry-email] Revisions-Check fehlgeschlagen:', revErr);
      }
    } else if (isMultiOfferRequest(rawBody)) {
      isMultiOption = true;
      optionCount = rawBody.options.length;
      context = buildMultiOfferContext(rawBody.inquiry, rawBody.options);
    } else {
      context = buildLegacyContext(rawBody);
    }

    // Payment method instruction for AI
    const paymentInstruction = (() => {
      switch (paymentMethod) {
        case 'on_site':
          return 'Erwähne, dass die Zahlung bequem vor Ort am Tag der Veranstaltung erfolgt. KEINE Anzahlung oder Vorauszahlung erwähnen.';
        case 'invoice_after':
          return 'Erwähne, dass die Rechnung nach der Veranstaltung zugestellt wird. KEINE Anzahlung oder Vorauszahlung erwähnen.';
        case 'prepayment_online':
          return 'Erwähne, dass der Gesamtbetrag vorab online bezahlt wird.';
        case 'deposit_online':
        default:
          return 'Erwähne, dass eine Anzahlung vorab online fällig wird.';
      }
    })();

    // Build system prompt
    const hasFreeformContext = context.includes('FREITEXT-PROGRAMM, mehrtägig');
    const systemPrompt = isMultiOption
      ? `Du bist ein professioneller Mitarbeiter von STORIA München.

╔════════════════════════════════════════════════════════════╗
║ HARTE REGELN — IMMER PRÜFEN, NIE BRECHEN              ║
╚════════════════════════════════════════════════════════════╝

1. ANREDE — Du SIEZT. IMMER. AUSNAHMSLOS.
   • "Liebe Frau [Nachname]," (weiblich, erkennbar)
   • "Lieber Herr [Nachname]," (männlich, erkennbar)
   • "Hallo [Vorname Nachname]," (NUR bei unklarem Geschlecht, z.B. nicht-deutscher Name)
   • "Guten Tag," (wenn gar kein Name bekannt)
   • VERBOTEN: "Hallo [Vorname]," — NIE nur Vorname bei bekanntem Nachnamen
   • VERBOTEN: "Sehr geehrte/r"
   • Den Nachnamen findest Du im Feld "Kunde: [Vorname Nachname] (...)". Alles nach dem Vornamen ist Nachname — auch mehrteilige Nachnamen wie "Alves Quintas", "van der Berg" oder "Müller-Schmidt".

2. VOLLSTÄNDIGKEIT — ALLES muss rein, NICHTS darf fehlen.
   • ALLE Menügänge vollständig nennen (Vorspeise, Hauptgang, Dessert)
   • ALLE Menügänge vollständig auflisten mit ihren Mengen aus den Daten.
   • GETRÄNKE — ABSOLUTE REGEL: Getränke dürfen NUR erwähnt werden, wenn sie in den Daten unter dem Block "Getränke:" oder "Weitere Getränke:" tatsächlich aufgelistet sind. Dann werden sie 1:1 mit Mengen und "inklusive"-Markern übernommen.
   • Steht in den Daten "Getränke: KEINE im Angebot" (oder gibt es schlicht keinen Getränke-Block), dann KOMMT KEIN GETRÄNKE-SATZ ins Anschreiben. STRENG VERBOTEN: "Wasser wird … bereitgestellt", "zwei Getränke pro Person", "ein Glas Wein, Spritz oder Bier", oder ähnliche Standardformulierungen. Auch keine erfundenen Inklusiv-Getränke wie "Wasser und Kaffee inklusive".
   • Erfinde niemals Getränke. Wenn die Daten schweigen, schweigt auch das Anschreiben zum Thema Getränke.

3. RECHTSCHREIBUNG — kein Slang, keine Abkürzungen.
   • Immer "inklusive" — NIE "inkl."
   • "Paket" mit k und t — NIE "Packet"
   • Jedes Wort korrekt, inkl. Fachbegriffe

5. PREISE — NIEMALS runden, NIEMALS auf-/abrunden auf volle Euro.
   • Übernimm Preise EXAKT so wie sie in den Daten stehen, inkl. beider Nachkommastellen.
   • Beispiel: "2.974,80 €" bleibt "2.974,80 €" — NIE "2.975 €", NIE "2.975,- €", NIE "ca. 2.975 €".
   • Format ist immer deutsch: Tausenderpunkt, Komma als Dezimaltrenner, zwei Nachkommastellen, "€" am Ende.

 6. MENGEN — exakte Mengen aus den Daten übernehmen.
    • Wenn eine Position als "N × Name" angegeben ist (z.B. "3 × Vitello Tonnato-Platte", "25 × Burratina"), MUSS diese Menge im Anschreiben genannt werden.
    • Beispiel: "Als Speisen servieren wir 3 × Vitello Tonnato-Platte, 25 × Burratina ..." — NICHT nur "Vitello Tonnato-Platte, Burratina".
    • Pflicht für ALLE Positionen mit Menge > 1 (Speisen, Getränke, Ausstattung, Personal).

 6b. SPEISEN LOGISCH GRUPPIEREN — niemals 1:1 die Reihenfolge aus den Daten übernehmen.
    • Sortiere die Speisen gastronomisch sinnvoll in diese Reihenfolge:
      1) Antipasti / Vorspeisen (z.B. Vitello Tonnato, Burratina, Bruschette, Vitello, Carpaccio)
      2) Beilagen, Salate, Brot/Focaccia (z.B. Insalata Caprina, Nudelsalat, Rosmarin Focaccia, Gemüse-Platte)
      3) Hauptgang (z.B. Roastbeef, Dorade, Kalbsrücken, Pasta-Hauptgang)
      4) Dessert (z.B. Tiramisù, Panna Cotta)
    • Brot/Focaccia gehört NIE zum Dessert. Salate und Beilagen gehören NIE zum Dessert.
    • Mengenangaben (z.B. "4 × Rosmarin Focaccia für 6-8 Personen") werden 1:1 übernommen, nur die Reihenfolge wird sortiert.
    • Formuliere in Absätzen oder Fließtext nach Kategorien — z.B. "Als Vorspeisen ...", "Dazu reichen wir als Beilagen und Brot ...", "Als Hauptgang ...", "Zum Abschluss ...".
    • FALSCH: "Zum Abschluss gibt es 25 × Tiramisù und 4 × Rosmarin Focaccia." (Focaccia ist kein Dessert!)
    • RICHTIG: "Dazu reichen wir 4 × Rosmarin Focaccia für 6-8 Personen. Zum Abschluss 25 × Tiramisù STORIA."

 7. RABATT — wenn in den Daten "Rabatt: JA" steht, MUSS er GENAU EINMAL im Anschreiben erwähnt werden.
    • GENAU EIN Rabatt-Satz im gesamten Anschreiben — direkt vor dem Link-Absatz.
    • Im Eröffnungs-/Preissatz NUR den Endpreis als nackte Zahl nennen (z. B. "zum Preis von 1.053,99 €"). KEINE Zwischensumme, KEIN "statt … berücksichtigt", KEIN Prozentsatz, KEIN Rabatt-Hinweis in diesem Satz.
    • Der Hauptpreis (Gesamtpreis bzw. Preis pro Person) ist IMMER der Endpreis nach Rabatt — NIE die Zwischensumme.
    • Genau EINE zulässige Formulierung für den Rabatt-Satz (vor dem Link):
      "Gerne räumen wir Ihnen einen Rabatt von X % ein. Der Endpreis nach Rabatt beträgt [ENDPREIS] € (Zwischensumme zuvor: [ZWISCHENSUMME] €)."
    • Zwischensumme + Prozentsatz dürfen NUR in diesem einen Rabatt-Satz vorkommen — nirgendwo sonst.
    • Nie selbst rechnen, immer die Zahlen aus den Daten 1:1 verwenden.
    • Wenn KEIN Rabatt-Block in den Daten steht, KEINEN Rabatt erfinden.
    • FALSCH (Rabatt im Eröffnungssatz, dann nochmal unten):
      "… zum Preis von 1.053,99 €. Im Endpreis ist bereits ein Rabatt von 10 % berücksichtigt – statt 1.171,09 € beträgt Ihr Endpreis 1.053,99 €. […] Gerne räumen wir Ihnen einen Rabatt von 10 % ein. Der Endpreis nach Rabatt beträgt 1.053,99 € (Zwischensumme zuvor: 1.171,09 €)."
    • RICHTIG: Oben nur "zum Preis von 1.053,99 €", und vor dem Link einmal:
      "Gerne räumen wir Ihnen einen Rabatt von 10 % ein. Der Endpreis nach Rabatt beträgt 1.053,99 € (Zwischensumme zuvor: 1.171,09 €)."

 8. REVISION — wenn in den Daten "Revisions-Status: ÜBERARBEITETE VERSION" steht, MUSS das Anschreiben das ausdrücklich kommunizieren.
    • KEIN "vielen Dank für Ihre Anfrage" als Einstieg — das wäre für eine Erstanfrage.
    • Stattdessen Einleitung wie "anbei das überarbeitete Angebot mit den angepassten Punkten" oder "wie besprochen erhalten Sie hier die überarbeitete Version unseres Angebots".
    • Datum/Uhrzeit/Gästezahl können kurz bestätigt werden, aber als Folgekommunikation, nicht als Erstkontakt.
    • Wenn KEIN Revisions-Status in den Daten steht, ganz normal als Erstangebot formulieren ("vielen Dank für Ihre Anfrage …").

4. ABSÄTZE — genau eine Leerzeile zwischen Absätzen.
   • Zwei Newlines (\n\n) zwischen jedem Absatz
   • Jeder Gedankengang ist ein eigener Absatz
   • Niemals zwei Absätze ohne Leerzeile aneinanderhängen
${hasFreeformContext ? `
╔════════════════════════════════════════════════════════════╗
║ FREITEXT-PROGRAMM (mehrtägig) — ZUSATZREGELN          ║
╚════════════════════════════════════════════════════════════╝

F1. ZEITRAUM statt einzelnem Datum.
    • Nenne immer die volle Datumsspanne aus "Zeitraum:" (z.B. "29.06.–02.07.2026"), niemals nur einen Einzeltag.
    • Wenn "Location:" angegeben ist, nimm sie in den Eröffnungssatz auf.

F2. KEINE Gesamtgästezahl, KEIN Pro-Person-Preis.
    • Es gibt unterschiedliche Gästezahlen pro Mahlzeit. STRENG VERBOTEN: eine Summe wie "für 833 Gäste" oder ein Wert wie "X € pro Person".
    • Erwähne stattdessen knapp: "X Tage mit Y Mahlzeiten und variablen Gästezahlen je Mahlzeit".

F3. PROGRAMM-ÜBERSICHT im Anschreiben.
    • Nach dem Eröffnungssatz pro Tag eine kompakte Zeile als Fließtext, z.B.:
      "Montag, 29.06.: Lunch (25 Pers.) und Dinner Live Cooking (24 Pers.)."
    • Inhalte der Mahlzeiten NICHT komplett zitieren — nur Mahlzeitennamen + Personenzahl. Details stehen im verlinkten Angebot.
    • Wenn "Leistungsumfang:" gegeben ist, einen einzigen Fließtext-Satz daraus formen ("Inklusive sind …"), keine Aufzählungsliste.

F4. ENDBETRAG BRUTTO 1:1 aus Maestro.
    • Verwende den Wert hinter "ENDBETRAG BRUTTO" EXAKT — keine Rundung, keine Umrechnung, kein Splitting.
    • Niemals aus Mahlzeit-Preisen neu summieren.

F5. HINWEISE übernehmen.
    • Wenn ein "Hinweise:"-Block vorhanden ist, fasse die Punkte sinngemäß in 1–2 kurzen Sätzen zusammen (insb. "Finale Gästezahl bis 7 Tage vor Veranstaltung anpassbar").
    • Keine zusätzlichen Hinweise erfinden.

F6. STRUKTUR FÜR FREITEXT-ANGEBOTE:
    1. Anrede.
    2. Bezug: Anlass-Titel + Zeitraum + Location.
    3. Kurze Programm-Übersicht (Anzahl Tage, Mahlzeiten, variable Gästezahlen).
    4. Pro-Tag-Zeilen (kompakt, siehe F3).
    5. Optional Leistungsumfang als ein Satz.
    6. Endbetrag brutto exakt nennen.
    7. Hinweise sinngemäß in 1–2 Sätzen.
    8. Zahlungshinweis (gemäß paymentInstruction).
    9. Link-Satz "Das Angebot mit allen Details finden Sie hier: [ANGEBOT_LINK]" als eigener Absatz.
    10. Schlusssatz + Signatur.

F7. Bei aktivem Freitext-Programm IGNORIERE die Regeln 2/5/6/6b/7 zu Menügängen, Getränken und Rabatt-Standardsatz — die gelten nur für Menü-/Paket-Angebote. Endpreis kommt einfach als nackte Zahl ("zum Endpreis von 25.000,00 € brutto").
` : ''}

╔════════════════════════════════════════════════════════════╗
║ BEISPIEL (zur Orientierung am Stil)                    ║
╚════════════════════════════════════════════════════════════╝

"Liebe Frau Alves Quintas,

vielen Dank für Ihre Anfrage für den 15. Juni 2026 um 18:30 Uhr für 20 Gäste.

Basierend auf Ihren Angaben haben wir ein Business Dinner — Exclusive zusammengestellt, zum Preis von 99,00 € pro Person.

Als Vorspeise Vitello Tonnato, fein geschnittenes rosa Kalbfleisch mit Thunfischcreme, oder wahlweise Ofenpaprika gefüllt mit Kräuterseitlingen. Als Hauptgang gegrillte Dorade Royal oder zarte Kalbsrückenmedaillons mit sautierten Kräuterseitlingen in Marsalasauce. Zum Abschluss Tiramisu.

Dazu ein Aperitif Spritz und 4 × 0,1 l Wein oder Bier pro Person. Wasser und Kaffee-Spezialitäten sind inklusive. (NUR weil diese Getränke im Datenblock "Getränke:" stehen — sonst weglassen!)

Das Angebot mit allen Details finden Sie hier: [ANGEBOT_LINK]

Wir freuen uns auf Ihre Rückmeldung.

Viele Grüße
Domenico"

BEACHTE am Beispiel:
• Anrede mit "Liebe Frau [Nachname],"
• Alle 3 Gänge vollständig beschrieben
• Getränke nur weil sie im Datenblock stehen — ohne Datenblock KEIN Getränke-Satz
• Zwischen jedem Absatz eine Leerzeile
• "inklusive" ausgeschrieben
• Kein "Packet" und keine abgeschnittenen Sätze

╔════════════════════════════════════════════════════════════╗
║ WEITERE VORGABEN                                       ║
╚════════════════════════════════════════════════════════════╝

NUR FAKTEN AUS DEN DATEN:
• Erfinde NICHTS! Kein Paketname, kein Gericht, kein Event-Typ der nicht in den Daten steht
• Wenn eine Info fehlt, erwähne sie NICHT
• Event-Typ ist NUR Hintergrundinfo — NIE als Titel im Text (also NICHT "Ihr Network-Aperitivo")

STIL:
• Freundlich, geschäftsmäßig, auf den Punkt — max. 200 Wörter
• Kein Markdown (keine **, keine #, keine Listen mit -)
• Keine übertriebenen Floskeln ("wunderbar", "fantastisch", "außergewöhnlich")
• Normale E-Mail-Flüsstext in kurzen Absätzen
• PREIS-DARSTELLUNG: Wenn in den Daten "Gesamtpreis: X € fuer den gesamten Anlass" steht — dann ist das ein per_event-Angebot (z.B. Mehrtageslieferung). IMMER den Gesamtpreis nennen, NIE in "pro Person" umrechnen. Wenn "X € pro Person" steht — normales Event mit Gastzahl, dann "pro Person" verwenden.

${isProposal ? `STRUKTUR (VORSCHLAG):
1. Anrede (siehe Regel 1)
2. Einleitung — je nach Revisions-Status (siehe Regel 8):
   • Erstangebot: "vielen Dank für Ihre Anfrage für den …" mit Datum, Uhrzeit, Gästeanzahl.
   • Überarbeitete Version: "anbei das überarbeitete Angebot …" / "wie besprochen erhalten Sie hier die überarbeitete Version …" — KEIN "vielen Dank für Ihre Anfrage".
3. Angebot vorstellen mit Preis pro Person
4. ALLE Speisen vollständig auflisten (siehe Regel 2)
5. ALLE Getränke inklusive der Inklusiv-Positionen auflisten (siehe Regel 2)
${optionCount > 1
  ? `6. Erwähne dass du ${optionCount} Optionen zusammengestellt hast
7. EXAKT diesen Satz als eigenen Absatz: "Wählen Sie Ihren Favoriten über diesen Link: [ANGEBOT_LINK]"`
  : `6. EXAKT diesen Satz als eigenen Absatz: "Das Angebot mit allen Details finden Sie hier: [ANGEBOT_LINK]"`}
8. Schlusssatz: "Wir freuen uns auf Ihre Rückmeldung."
9. Signatur (siehe unten)

WICHTIG: VORSCHLAG, KEINE finale Buchung. KEIN Zahlungshinweis!

Bei leerem Angebot (keine Menü/Paket-Konfig): kurzer allgemeiner Text mit Datum/Zeit/Gästen + Link-Satz.`
: `STRUKTUR (FINALES ANGEBOT):
1. Anrede (siehe Regel 1)
2. "wie besprochen haben wir Ihr Menü finalisiert."
3. Zusammenfassung der finalen Option — Preis pro Person
4. ALLE Speisen und Getränke (inkl. Inklusiv-Positionen) auflisten
5. Eigener Absatz: "Das finale Angebot finden Sie über den folgenden Link: [ANGEBOT_LINK]"
6. Zahlungshinweis: ${paymentInstruction}
7. Schlusssatz mit Kontaktangebot
8. Signatur`}

SIGNATUR (exakt so, NICHT ändern!):
${shortSignature}`
      : `Du bist ein professioneller Mitarbeiter von STORIA München.

STIL:
- Freundlich, aber geschäftsmäßig und auf den Punkt
- Kurz und prägnant (maximal 150 Wörter)
- Keine überschwänglichen Floskeln wie "wunderbar", "fantastisch", "herausragend", "Es ist uns eine große Ehre"
- KEIN Markdown (keine **, keine #, keine Listen mit -)
- Normaler E-Mail-Fließtext mit kurzen Absätzen, IMMER mit Leerzeile zwischen Absätzen

ANREDE (WICHTIG!):
- IMMER Sie-Form verwenden, niemals duzen
- Format: "Liebe Frau [Nachname]," oder "Lieber Herr [Nachname],"
- Bei unklarem Geschlecht oder nur Vorname: "Hallo [Vorname Nachname],"
- NIEMALS "Hallo [Vorname]," bei bekanntem vollständigen Namen
- NIEMALS "Sehr geehrte/r" verwenden

ABKÜRZUNGEN:
- NIEMALS "inkl." schreiben — immer "inklusive" ausschreiben
- "Paket" mit einem k und einem t (nicht "Packet")

STRUKTUR (genau einhalten):
1. Anrede: "Liebe Frau [Nachname]," / "Lieber Herr [Nachname],"
2. Bestätigung der wichtigsten Fakten (Datum, Uhrzeit, Gästeanzahl, ggf. Paket) in einem Fließtext-Satz
3. Hinweis: "Das detaillierte Angebot finden Sie im Anhang."
4. Zahlungshinweis: ${paymentInstruction}
5. Schlusssatz mit Kontaktangebot
6. Signatur

VERBOTEN:
- "Sehr geehrte/r" als Anrede
- "Hallo [Vorname]," bei bekannten Kunden
- Duzen in jeder Form
- "inkl." als Abkürzung
- Aufzählungslisten
- Fettdruck oder andere Formatierung
- Übertrieben blumige Sprache
- Mehr als 3 kurze Absätze vor der Signatur
- Phrasen wie "Wir freuen uns außerordentlich", "Ihr exklusives Event wird unvergesslich"

SIGNATUR (exakt so verwenden - NICHT ändern!):
${shortSignature}`;

    const userPrompt = isMultiOption
      ? isProposal
        ? `Schreibe eine kurze E-Mail (max. 200 Wörter) basierend AUSSCHLIEßLICH auf diesen Daten. Verwende NUR Informationen die unten stehen — erfinde NICHTS dazu:

${context}`
        : `Schreibe eine kurze E-Mail (max. 200 Wörter) für das finale Angebot, basierend AUSSCHLIEßLICH auf diesen Daten:

${context}`
      : `Schreibe eine kurze Bestätigungs-E-Mail (max. 150 Wörter) basierend AUSSCHLIEßLICH auf diesen Daten:

${context}`;

    // Use Lovable AI API
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI API...');

    // Messages mit Few-Shot-Examples aus vorherigen E-Mails
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Vorherige E-Mails als Stil-Beispiele einfügen
    if (previousEmails.length > 0) {
      const examplesText = previousEmails
        .map((e, i) => `--- Beispiel ${i + 1} ---\n${e.slice(0, 800)}`)
        .join('\n\n');
      messages.push({
        role: 'user',
        content: `Hier sind Beispiele von E-Mails die wir vorher geschrieben haben. Orientiere dich am Ton und Stil, aber NICHT am Inhalt (der Inhalt muss zu den AKTUELLEN Daten passen):\n\n${examplesText}`,
      });
      messages.push({
        role: 'assistant',
        content: 'Verstanden, ich orientiere mich am Ton und Stil dieser Beispiele für die neue E-Mail.',
      });
    }

    messages.push({ role: 'user', content: userPrompt });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;

      let friendly = `KI-Service Fehler (HTTP ${status}).`;
      if (status === 429) {
        friendly = 'KI-Service ist gerade rate-limited. Bitte 30-60 Sekunden warten.';
      } else if (status === 402) {
        friendly = 'KI-Service: Guthaben/Limit erreicht. Bitte Credits nachladen.';
      }

      console.error('Lovable AI API error:', status, errorText);

      return new Response(
        JSON.stringify({ success: false, error: friendly, status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    let generatedEmail = aiResponse.choices?.[0]?.message?.content || '';

    // A3: [ANGEBOT_LINK] Placeholder durch echten Link ersetzen (nur für OfferBuilderRequest)
    // Robuster Fallback: Wir pruefen ob die fertige Mail TATSAECHLICH die
    // offerUrl enthaelt. Falls nicht, fuegen wir sie zwingend ein — auch wenn
    // das LLM den Placeholder ignoriert oder eine "im Anhang"-Variante geschrieben hat.
    if (isOfferBuilderRequest(rawBody)) {
      const offerUrl = `https://events-storia.de/offer/${rawBody.inquiryId}`;
      // Erst Placeholder ersetzen falls vorhanden
      if (generatedEmail.includes('[ANGEBOT_LINK]')) {
        generatedEmail = generatedEmail.replaceAll('[ANGEBOT_LINK]', offerUrl);
      }
      // Jetzt pruefen ob der Link wirklich drin ist (das LLM koennte ihn weggelassen haben)
      const hasLink = generatedEmail.includes(offerUrl)
        || /https?:\/\/events-storia\.de\/offer\//i.test(generatedEmail);
      if (!hasLink) {
        // Link-Satz vor der Signatur einfuegen, mit klarer Formulierung
        const linkSentence = `\n\nDas Angebot mit allen Details finden Sie hier: ${offerUrl}`;
        const signatureMarker = '\n\nViele Grüße';
        const sigIdx = generatedEmail.indexOf(signatureMarker);
        if (sigIdx !== -1) {
          generatedEmail =
            generatedEmail.slice(0, sigIdx) +
            linkSentence +
            generatedEmail.slice(sigIdx);
        } else {
          generatedEmail += linkSentence;
        }
      }
    }

    // Rabatt-Absicherung: Falls Rabattdaten vorhanden, MUSS der Endpreis nach Rabatt
    // im Text auftauchen. Sonst fügen wir einen freundlichen Rabatt-Satz vor dem Link ein.
    if (isOfferBuilderRequest(rawBody)) {
      try {
        // Wir nutzen die zuletzt gebauten multiOpts via Re-Parse des Kontexts:
        // einfacher: regex aus context — wir haben Werte schon — aber context ist ein String.
        // Daher Werte erneut aus DB-Daten ableiten (gleicher Pfad wie oben).
        const discountMatch = context.match(/Rabatt:\s*JA/);
        if (discountMatch) {
          const endpreisMatch = context.match(/Endpreis nach Rabatt[^\n:]*:\s*([0-9.,]+\s*€)/);
          const subtotalMatch = context.match(/Zwischensumme vor Rabatt:\s*([0-9.,]+\s*€)/);
          const percentMatch = context.match(/Rabatt:\s*([0-9.,]+)\s*%/);
          const endpreis = endpreisMatch?.[1]?.trim();
          const subtotal = subtotalMatch?.[1]?.trim();
          const percent = percentMatch?.[1]?.trim();

          // Nur einfügen, wenn weder der Endpreis noch ein Rabatt-Hinweis im Text steht.
          // So vermeidet die Absicherung, dass ein zweiter/dritter Rabatt-Satz entsteht,
          // wenn die KI den Rabatt bereits korrekt erwähnt hat.
          const endpreisInEmail = endpreis && generatedEmail.includes(endpreis);
          const rabattAlreadyMentioned = /rabatt/i.test(generatedEmail);
          if (endpreis && !endpreisInEmail && !rabattAlreadyMentioned) {
            const rabattTeil = percent
              ? `Gerne räumen wir Ihnen einen Rabatt von ${percent} % ein.`
              : `Im Endpreis ist bereits ein Rabatt berücksichtigt.`;
            const subtotalTeil = subtotal ? ` (Zwischensumme zuvor: ${subtotal})` : '';
            const rabattSatz = `\n\n${rabattTeil} Der Endpreis nach Rabatt beträgt ${endpreis}${subtotalTeil}.`;

            // Vor dem Link-Satz einfügen (oder vor der Signatur, falls kein Link)
            const linkIdx = generatedEmail.search(/(Das Angebot mit allen Details|Wählen Sie Ihren Favoriten|Das finale Angebot finden Sie)/);
            const sigIdx = generatedEmail.indexOf('\n\nViele Grüße');
            const insertIdx = linkIdx !== -1 ? linkIdx : (sigIdx !== -1 ? sigIdx : generatedEmail.length);
            generatedEmail =
              generatedEmail.slice(0, insertIdx).trimEnd() +
              rabattSatz +
              '\n\n' +
              generatedEmail.slice(insertIdx).trimStart();
          }
        }
      } catch (rabattErr) {
        console.warn('[generate-inquiry-email] Rabatt-Absicherung übersprungen:', rabattErr);
      }
    }

    // Company Footer aus DB laden und an die E-Mail anhängen
    const footerAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const companyFooter = await loadCompanyFooter(footerAdmin);
    // HARTE SICHERUNG: Markdown-Reste IMMER strippen, egal was die KI ausgibt.
    // Anschreiben darf nirgendwo **fett**, __unter__, ## Überschriften, > Zitate
    // oder Listen mit "- "/"* " enthalten.
    generatedEmail = stripMarkdown(generatedEmail);
    const emailWithFooter = `${generatedEmail}\n\n${companyFooter}`;

    console.log('Email generated successfully, length:', emailWithFooter.length);

    // Return both `email` and `emailDraft` for compatibility with all callers
    return new Response(
      JSON.stringify({ success: true, email: emailWithFooter, emailDraft: emailWithFooter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.error('Error generating email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, status: 500 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
