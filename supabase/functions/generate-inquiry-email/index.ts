import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

type RequestBody = LegacyRequest | MultiOfferRequest;

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
    `.trim();
  } else {
    return `
Kunde: ${body.contactName}${body.companyName ? ` (${body.companyName})` : ''}
Lieferung: ${body.deliveryAddress || 'n.a.'}
Datum/Zeit: ${body.preferredDate || ''} ${body.deliveryTime || ''}
${menuContext}
${body.notes ? `Bemerkung: ${body.notes}` : ''}
    `.trim();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody: RequestBody = await req.json();

    console.log('Generating email, isMultiOption:', isMultiOfferRequest(rawBody));

    // Determine sender email for personalized signature
    const senderEmail = 'senderEmail' in rawBody ? rawBody.senderEmail : undefined;
    const senderInfo = SENDER_INFO[senderEmail?.toLowerCase() || ''] || { firstName: 'STORIA Team', mobile: '' };

    // Build personalized signature
    const personalizedSignature = `Viele Grüße
${senderInfo.firstName}${senderInfo.mobile ? `\n${senderInfo.mobile}` : ''}

${COMPANY_FOOTER}`;

    // Build context based on request format
    let context: string;
    let isMultiOption = false;
    let optionCount = 0;

    if (isMultiOfferRequest(rawBody)) {
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

STRUKTUR für Multi-Optionen-Angebot:
1. Anrede: "Hallo [Name],"
2. Kurzer Dank für die Anfrage
3. Erwähne, dass du ${optionCount} Optionen anbietest
4. Liste jede Option KURZ auf (1 Zeile pro Option: Option A/B/C: Paketname, X Gäste, Betrag €)
5. Hinweis: "Die detaillierten Angebote finden Sie im Anhang."
6. Info zur Vorauszahlung (100% erforderlich)
7. Schlusssatz mit Kontaktangebot
8. Signatur

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
      ? `Schreibe eine kurze, professionelle Bestätigungs-E-Mail (max. 200 Wörter, keine Markdown-Formatierung) für diese Event-Anfrage mit mehreren Paket-Optionen:

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
