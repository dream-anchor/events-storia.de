import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Sender mapping for personalized signatures
const SENDER_INFO: Record<string, { firstName: string; mobile?: string }> = {
  'monot@hey.com': { firstName: 'Antoine' },
  'mimmo2905@yahoo.de': { firstName: 'Domenico', mobile: '+49 163 6033912' },
  'nicola@storia.de': { firstName: 'Nicola' },
  'madi@events-storia.de': { firstName: 'Madina', mobile: '+49 179 2200921' },
  'madina.khader@gmail.com': { firstName: 'Madina', mobile: '+49 179 2200921' },
  'info@storia.de': { firstName: 'STORIA Team' },
};

const COMPANY_FOOTER = `Speranza GmbH
Karlstraße 47a
80333 München
Deutschland

Telefon: +49 89 51519696
E-Mail: info@events-storia.de

Vertreten durch die Geschäftsführerin:
Agnese Lettieri

Registereintrag
Eingetragen im Handelsregister des Amtsgerichts München
Handelsregisternummer: HRB 209637

Umsatzsteuer-ID
DE 296024880

Steuernummer
143/182/00980`;

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
  message?: string;
}

interface MultiOfferOption {
  label: string;
  packageName: string;
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
  let context = `Kunde: ${inquiry.contact_name}${inquiry.company_name ? ` (${inquiry.company_name})` : ''}
Event-Typ: ${inquiry.event_type || 'Feier'}
Datum: ${inquiry.preferred_date || 'nach Absprache'}
`;

  context += `\nAngebotene Optionen:\n`;
  
  for (const opt of options) {
    context += `\n--- Option ${opt.label} ---\n`;
    context += `Paket: ${opt.packageName}\n`;
    context += `Gäste: ${opt.guestCount}\n`;
    context += `Gesamtbetrag: ${opt.totalAmount.toFixed(2)} €\n`;
    
    if (opt.menuSelection?.courses && opt.menuSelection.courses.length > 0) {
      context += `Menü: ${opt.menuSelection.courses.map(c => c.itemName).join(', ')}\n`;
    }
    
    if (opt.menuSelection?.drinks && opt.menuSelection.drinks.length > 0) {
      context += `Getränke: ${opt.menuSelection.drinks.map(d => d.selectedChoice || d.drinkLabel).join(', ')}\n`;
    }
  }

  if (inquiry.message) {
    context += `\nKundenanmerkung: ${inquiry.message}`;
  }

  return context.trim();
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody: RequestBody = await req.json();

    console.log('Generating email, isOfferBuilder:', isOfferBuilderRequest(rawBody), 'isMultiOption:', isMultiOfferRequest(rawBody));

    // Determine sender email for personalized signature
    let senderEmail: string | undefined;

    if (isOfferBuilderRequest(rawBody)) {
      // Fetch sender from auth context (passed via Authorization header)
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
        );
        const { data: { user } } = await supabaseClient.auth.getUser();
        senderEmail = user?.email || undefined;
      } catch { /* fallback to no sender */ }
    } else {
      senderEmail = 'senderEmail' in rawBody ? rawBody.senderEmail : undefined;
    }

    const senderInfo = SENDER_INFO[senderEmail?.toLowerCase() || ''] || { firstName: 'STORIA Team', mobile: '' };

    // Build personalized signature
    const personalizedSignature = `Viele Grüße
${senderInfo.firstName}${senderInfo.mobile ? `\n${senderInfo.mobile}` : ''}

${COMPANY_FOOTER}`;

    // Build context based on request format
    let context: string;
    let isMultiOption = false;
    let optionCount = 0;
    let isProposal = false;

    if (isOfferBuilderRequest(rawBody)) {
      // New: Fetch data from DB
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: inquiryData } = await supabaseAdmin
        .from('event_inquiries')
        .select('contact_name, company_name, email, preferred_date, guest_count, event_type, message')
        .eq('id', rawBody.inquiryId)
        .single();

      const { data: optionsData } = await supabaseAdmin
        .from('inquiry_offer_options')
        .select('option_label, guest_count, total_amount, menu_selection, is_active')
        .eq('inquiry_id', rawBody.inquiryId)
        .eq('is_active', true)
        .order('sort_order');

      // Also try to get package names
      const { data: optionsWithPkg } = await supabaseAdmin
        .from('inquiry_offer_options')
        .select('option_label, guest_count, total_amount, menu_selection, package_id, is_active')
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
        packageName: pkgNames[o.package_id] || 'Individuell',
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

STIL:
- Freundlich, aber geschäftsmäßig und auf den Punkt
- Kurz und prägnant (maximal 150-200 Wörter)
- Keine überschwänglichen Floskeln wie "wunderbar", "fantastisch", "herausragend"
- KEIN Markdown (keine **, keine #, keine Listen mit -)
- Normaler E-Mail-Fließtext mit kurzen Absätzen

ANREDE:
- IMMER "Hallo [Vorname]," verwenden
- NIEMALS "Sehr geehrte/r" verwenden

${isProposal ? `STRUKTUR für Vorschlag (Proposal):
1. Anrede: "Hallo [Name],"
2. Kurzer Dank für die Anfrage
3. Erwähne, dass du ${optionCount} Optionen zusammengestellt hast
4. Liste jede Option KURZ auf (1 Zeile pro Option: Option A/B/C: Paketname, X Gäste, Betrag €)
5. Hinweis: "Wählen Sie Ihren Favoriten über den folgenden Link und teilen Sie uns eventuelle Wünsche mit."
6. Schlusssatz: Wir finalisieren das Angebot nach ihrer Rückmeldung
7. Signatur

WICHTIG: Dies ist ein VORSCHLAG, KEINE finale Buchung. Kein Hinweis auf Vorauszahlung oder Zahlung!`
: `STRUKTUR für finales Angebot:
1. Anrede: "Hallo [Name],"
2. Bezug auf vorherige Abstimmung: "Wie besprochen haben wir Ihr Menü finalisiert."
3. Kurze Zusammenfassung der finalen Option
4. Hinweis: "Das finale Angebot mit Zahlungsmöglichkeit finden Sie im Anhang."
5. Info zur Vorauszahlung (100% erforderlich)
6. Schlusssatz mit Kontaktangebot
7. Signatur`}

VERBOTEN:
- "Sehr geehrte/r" als Anrede
- Fettdruck oder andere Formatierung
- Übertrieben blumige Sprache
- Mehr als 4 kurze Absätze vor der Signatur

SIGNATUR (exakt so verwenden - NICHT ändern!):
${personalizedSignature}`
      : `Du bist ein professioneller Mitarbeiter von STORIA München.

STIL:
- Freundlich, aber geschäftsmäßig und auf den Punkt
- Kurz und prägnant (maximal 100-150 Wörter)
- Keine überschwänglichen Floskeln wie "wunderbar", "fantastisch", "herausragend", "Es ist uns eine große Ehre"
- KEIN Markdown (keine **, keine #, keine Listen mit -)
- Normaler E-Mail-Fließtext mit kurzen Absätzen

ANREDE:
- IMMER "Hallo [Vorname]," verwenden (z.B. "Hallo Max," oder "Hallo Frau Müller,")
- NIEMALS "Sehr geehrte/r" verwenden

STRUKTUR (genau einhalten):
1. Anrede: "Hallo [Name],"
2. Bestätigung der wichtigsten Fakten (Datum, Uhrzeit, Gästeanzahl, ggf. Paket) in einem Fließtext-Satz
3. Hinweis: "Das detaillierte Angebot finden Sie im Anhang."
4. Info zur Vorauszahlung (100% erforderlich)
5. Schlusssatz mit Kontaktangebot
6. Signatur

VERBOTEN:
- "Sehr geehrte/r" als Anrede
- Aufzählungslisten
- Fettdruck oder andere Formatierung
- Übertrieben blumige Sprache
- Mehr als 3 kurze Absätze vor der Signatur
- Phrasen wie "Wir freuen uns außerordentlich", "Ihr exklusives Event wird unvergesslich"

SIGNATUR (exakt so verwenden - NICHT ändern!):
${personalizedSignature}`;

    const userPrompt = isMultiOption
      ? isProposal
        ? `Schreibe eine kurze, professionelle Vorschlags-E-Mail (max. 200 Wörter, keine Markdown-Formatierung) für diese Event-Anfrage. Der Kunde soll über einen Link seine bevorzugte Option wählen:

${context}`
        : `Schreibe eine kurze, professionelle E-Mail für das finale Angebot (max. 200 Wörter, keine Markdown-Formatierung). Der Kunde hat bereits seine Wahl getroffen, das Menü ist finalisiert:

${context}`
      : `Schreibe eine kurze, professionelle Bestätigungs-E-Mail (max. 150 Wörter, keine Markdown-Formatierung) für diese Anfrage:

${context}`;

    // Use Lovable AI API
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI API...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
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
    const generatedEmail = aiResponse.choices?.[0]?.message?.content || '';

    console.log('Email generated successfully, length:', generatedEmail.length);

    // Return both `email` and `emailDraft` for compatibility with all callers
    return new Response(
      JSON.stringify({ success: true, email: generatedEmail, emailDraft: generatedEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, status: 500 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
