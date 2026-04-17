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
  paymentLinkUrl?: string;
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

function isOfferBuilderRequest(body: RequestBody): body is OfferBuilderRequest {
  return 'inquiryId' in body && 'phase' in body && !('isMultiOption' in body);
}

function isMultiOfferRequest(body: RequestBody): body is MultiOfferRequest {
  return 'isMultiOption' in body && body.isMultiOption === true && 'options' in body;
}

function buildMultiOfferContext(inquiry: MultiOfferInquiry, options: MultiOfferOption[]): string {
  const parts: string[] = [];

  parts.push(`Kunde: ${inquiry.contact_name || '(kein Name bekannt)'}${inquiry.company_name ? ` (${inquiry.company_name})` : ''}`);

  // Nur tatsächlich vorhandene Daten aufnehmen
  if (inquiry.event_type) parts.push(`Event-Typ (nur Hintergrundinfo, NICHT im Text verwenden!): ${inquiry.event_type}`);
  if (inquiry.preferred_date) parts.push(`Datum: ${inquiry.preferred_date}`);
  if (inquiry.time_slot) parts.push(`Uhrzeit: ${inquiry.time_slot} Uhr`);
  if (inquiry.guest_count) parts.push(`Gäste: ${inquiry.guest_count}`);
  if (inquiry.room_selection) parts.push(`Raum: ${inquiry.room_selection}`);

  // Optionen — nur aufnehmen was tatsächlich konfiguriert ist
  const hasOptions = options.length > 0;
  const hasMenu = options.some(o => o.menuSelection?.courses?.some(c => c.itemName));
  const hasPackage = options.some(o => o.packageName && o.packageName !== 'Individuell' && o.offerMode !== 'menu');

  if (hasOptions) {
    parts.push('');
    parts.push(`Angebotene Optionen (${options.length}):`);

    for (const opt of options) {
      const label = options.length > 1 ? `Option ${opt.label}` : 'Angebot';
      const optParts: string[] = [];

      if (opt.packageName && opt.packageName !== 'Individuell' && opt.offerMode !== 'menu') {
        optParts.push(`Paket: ${opt.packageName}`);
      }
      if (opt.guestCount > 0) optParts.push(`${opt.guestCount} Gäste`);
      if (opt.totalAmount > 0 && opt.guestCount > 0) {
        optParts.push(`${(opt.totalAmount / opt.guestCount).toFixed(2)} € pro Person`);
      }

      parts.push(`\n--- ${label} ---`);
      if (optParts.length > 0) parts.push(optParts.join(', '));

      const courses = opt.menuSelection?.courses?.filter(c => c.itemName) || [];
      if (courses.length > 0) {
        parts.push('Menü:');
        for (const c of courses) {
          parts.push(`  ${c.courseLabel}: ${c.itemName}`);
        }
      }

      const drinks = opt.menuSelection?.drinks?.filter(d => d.selectedChoice || d.quantityLabel) || [];
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
      }
    }
  }

  // Inhalts-Status für den Prompt
  if (!hasMenu && !hasPackage) {
    parts.push('\nHINWEIS: Es sind noch KEINE Menüs oder Pakete konfiguriert. Schreibe ein einfaches, allgemeines Anschreiben.');
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
        .select('contact_name, company_name, email, preferred_date, guest_count, event_type, time_slot, room_selection, message')
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

      isMultiOption = true;
      isProposal = rawBody.phase === 'proposal';
      const opts = optionsData || [];
      optionCount = opts.length;

      const multiOpts: MultiOfferOption[] = (optionsWithPkg || []).map(o => ({
        label: o.option_label,
        offerMode: o.offer_mode || undefined,
        packageName: (o.offer_mode === 'menu') ? 'Individuell' : (pkgNames[o.package_id] || 'Individuell'),
        guestCount: o.guest_count,
        totalAmount: Number(o.total_amount),
        menuSelection: o.menu_selection as MenuSelection | undefined,
      }));

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
    } else if (isMultiOfferRequest(rawBody)) {
      isMultiOption = true;
      optionCount = rawBody.options.length;
      context = buildMultiOfferContext(rawBody.inquiry, rawBody.options);
    } else {
      context = buildLegacyContext(rawBody);
    }

    // Build system prompt
    const systemPrompt = isMultiOption
      ? `Du bist ein professioneller Mitarbeiter von STORIA München.

ABSOLUTE REGEL: Du darfst NUR Informationen verwenden die in den Daten stehen.
ERFINDE NICHTS! Kein Paketname, kein Eventtyp, kein Datum, keine Gerichte die nicht in den Daten vorkommen.
Wenn eine Information fehlt (z.B. kein Menü konfiguriert), erwähne sie NICHT.

STIL:
- Freundlich, aber geschäftsmäßig und auf den Punkt
- Kurz und prägnant (maximal 200 Wörter)
- Keine überschwänglichen Floskeln wie "wunderbar", "fantastisch", "herausragend"
- KEIN Markdown (keine **, keine #, keine Listen mit -)
- Normaler E-Mail-Fließtext mit kurzen Absätzen

ABSATZ-REGELN (wichtig!):
- Zwischen jedem Absatz GENAU eine Leerzeile (= zwei Newlines \n\n)
- Niemals Absätze ohne Leerzeile aneinanderhängen
- Jeder inhaltliche Block ist ein eigener Absatz

ANREDE (WICHTIG!):
- IMMER Sie-Form verwenden, niemals duzen
- Format: "Liebe Frau [Nachname]," oder "Lieber Herr [Nachname],"
- Bei unklarem Geschlecht (nur Vorname der mehrdeutig ist, oder Firmenname): "Hallo [Vorname Nachname],"
- Wenn kein Name bekannt ist (Kunde = "kein Name bekannt"): Schreibe nur "Guten Tag," ohne Namen
- NIEMALS "Hallo [Vorname]," bei bekanntem vollständigen Namen verwenden
- NIEMALS "Sehr geehrte/r" verwenden
- Den Nachnamen aus dem Feld "Kunde: [Vorname Nachname] (...)" extrahieren — also den ZWEITEN (oder letzten) Teil

ABKÜRZUNGEN & RECHTSCHREIBUNG:
- NIEMALS "inkl." schreiben — immer "inklusive" ausschreiben
- Keine abgekürzten Floskeln ohne Kontext (z.B. "Getränke inkl." ist verboten — entweder "Getränke inklusive" oder "Getränke sind inklusive")
- "Paket" mit einem k und einem t (nicht "Packet" oder "Pakät")
- Korrekte deutsche Rechtschreibung, insbesondere bei Fachwörtern

VOLLSTÄNDIGKEIT (sehr wichtig!):
- ZÄHLE ALLE Menügänge vollständig auf, nicht mit "oder" kürzen:
  FALSCH: "Vorspeise mit Vitello Tonnato oder Kräuterseitlingen"
  RICHTIG: "als Vorspeise Vitello Tonnato oder wahlweise Kräuterseitlinge mit frischen Artischocken und grünem Spargel"
- ZÄHLE ALLE Getränke vollständig auf, insbesondere die inklusiven Positionen:
  "Dazu ein Aperitif Spritz, 4 × 0,1 l Wein oder Bier pro Person sowie Wasser und Kaffee-Spezialitäten inklusive."
- Inklusiv-Getränke (Wasser, Kaffee, Aperitif) NIE auslassen — sie sind Teil der Leistung
- Wenn Menügänge beschreibende Details haben (z.B. "Vitello Tonnato, fein geschnittenes rosa Kalbfleisch, ..."), kannst du 1-2 Details auswählen, aber den Hauptbestandteil (Vitello Tonnato) immer nennen

${isProposal ? `STRUKTUR für Vorschlag (Proposal):
1. Anrede: "Liebe Frau [Nachname]," / "Lieber Herr [Nachname]," (siehe ANREDE-Regeln)
2. Kurzer Dank für die Anfrage — beziehe dich NUR auf tatsächlich vorhandene Daten (Datum, Uhrzeit, Gästezahl). NICHT den Event-Typ als Titel verwenden!
3. Vorstellen des Angebots mit Preis pro Person
4. VOLLSTÄNDIGE Auflistung aller Speisen (siehe VOLLSTÄNDIGKEIT)
5. VOLLSTÄNDIGE Auflistung aller Getränke inklusive der Inklusiv-Positionen (siehe VOLLSTÄNDIGKEIT)
${optionCount > 1
  ? `6. Erwähne dass du ${optionCount} Optionen zusammengestellt hast und der Kunde seinen Favoriten über den Link wählen kann
7. Schreibe EXAKT diesen Satz als eigenen Absatz: "Wählen Sie Ihren Favoriten über diesen Link: [ANGEBOT_LINK]" — [ANGEBOT_LINK] wird automatisch durch den echten Link ersetzt, nicht ändern!`
  : `6. Schreibe EXAKT diesen Satz als eigenen Absatz: "Das Angebot mit allen Details finden Sie hier: [ANGEBOT_LINK]" — [ANGEBOT_LINK] wird automatisch durch den echten Link ersetzt, nicht ändern!`}
8. Schlusssatz: "Wir freuen uns auf Ihre Rückmeldung."
9. Signatur

WICHTIG: Dies ist ein VORSCHLAG, KEINE finale Buchung. KEIN Hinweis auf Vorauszahlung oder Zahlung!

Wenn KEIN Menü oder Paket konfiguriert ist:
- Schreibe ein einfaches, kurzes Anschreiben
- Erwähne nur Datum, Uhrzeit, Gästezahl (sofern vorhanden)
- "Wir haben basierend auf Ihrer Anfrage ein erstes Angebot zusammengestellt."
- Schreibe den Link-Satz aus der Struktur oben.`
: `STRUKTUR für finales Angebot:
1. Anrede: "Liebe Frau [Nachname]," / "Lieber Herr [Nachname]," (siehe ANREDE-Regeln)
2. Bezug auf vorherige Abstimmung: "wie besprochen haben wir Ihr Menü finalisiert."
3. Zusammenfassung der finalen Option — Preis pro Person (NICHT Gesamtpreis)
4. VOLLSTÄNDIGE Auflistung aller Speisen und Getränke (inkl. Inklusiv-Positionen)
5. Eigener Absatz mit dem Link-Satz: "Das finale Angebot mit Zahlungsmöglichkeit finden Sie über den folgenden Link."
6. Info zur Vorauszahlung
7. Schlusssatz mit Kontaktangebot
8. Signatur`}

VERBOTEN:
- "Sehr geehrte/r" als Anrede
- "Hallo [Vorname]," bei bekannten Kunden (immer Sie-Form)
- Duzen in jeder Form
- "inkl." als Abkürzung (immer "inklusive" ausschreiben)
- Fettdruck oder andere Formatierung
- Übertrieben blumige Sprache
- Menü-Kurzformen wie "A oder B oder C" ohne Beschreibung — immer vollständig auflisten
- Inklusiv-Getränke weglassen
- Absätze ohne Leerzeile aneinander hängen
- Erfundene Paketnamen, Gerichte, oder Events die nicht in den Daten stehen
- Gesamtpreise (immer nur Preis pro Person nennen!)
- Den Event-Typ als Titel im Text verwenden (z.B. NICHT "Ihr Network-Aperitivo" — stattdessen neutral "Ihre Veranstaltung" oder "Ihr Event")

SIGNATUR (exakt so verwenden - NICHT ändern!):
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
4. Info zur Vorauszahlung (100% erforderlich)
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
    if (isOfferBuilderRequest(rawBody)) {
      const offerUrl = `https://events-storia.de/offer/${rawBody.inquiryId}`;
      if (generatedEmail.includes('[ANGEBOT_LINK]')) {
        generatedEmail = generatedEmail.replaceAll('[ANGEBOT_LINK]', offerUrl);
      } else {
        // Fallback: URL vor der Signatur einfügen
        const signatureMarker = '\n\nViele Grüße';
        const sigIdx = generatedEmail.indexOf(signatureMarker);
        if (sigIdx !== -1) {
          generatedEmail =
            generatedEmail.slice(0, sigIdx) +
            `\n\n${offerUrl}` +
            generatedEmail.slice(sigIdx);
        } else {
          generatedEmail += `\n\n${offerUrl}`;
        }
      }
    }

    // Company Footer aus DB laden und an die E-Mail anhängen
    const footerAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const companyFooter = await loadCompanyFooter(footerAdmin);
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
