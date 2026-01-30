import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Sender mapping for personalized signatures
const SENDER_INFO: Record<string, { firstName: string; mobile: string }> = {
  'mimmo2905@yahoo.de': { firstName: 'Domenico', mobile: '+49 163 6033912' },
  'madi@events-storia.de': { firstName: 'Madina', mobile: '+49 179 2200921' },
  'madina.khader@gmail.com': { firstName: 'Madina', mobile: '+49 179 2200921' },
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

interface InquiryEmailRequest {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      inquiryType,
      contactName,
      companyName,
      eventType,
      guestCount,
      preferredDate,
      timeSlot,
      items,
      packages,
      deliveryAddress,
      deliveryTime,
      totalAmount,
      notes,
      menuSelection,
      packageName,
      senderEmail,
    }: InquiryEmailRequest = await req.json();

    console.log('Generating email for inquiry type:', inquiryType);
    console.log('Sender email:', senderEmail);

    // Get sender info for personalized signature
    const senderInfo = SENDER_INFO[senderEmail?.toLowerCase() || ''] || { firstName: 'STORIA Team', mobile: '' };

    // Build personalized signature
    const personalizedSignature = `Viele Grüße
${senderInfo.firstName}${senderInfo.mobile ? `\n${senderInfo.mobile}` : ''}

${COMPANY_FOOTER}`;

    // Format menu selection for prompt
    let menuContext = '';
    if (menuSelection) {
      if (menuSelection.courses && menuSelection.courses.length > 0) {
        menuContext += 'Ausgewähltes Menü: ';
        menuContext += menuSelection.courses.map(c => c.itemName).join(', ');
        menuContext += '\n';
      }
      
      if (menuSelection.drinks && menuSelection.drinks.length > 0) {
        menuContext += 'Getränke: ';
        menuContext += menuSelection.drinks.map(d => d.selectedChoice || d.drinkLabel).join(', ');
        menuContext += '\n';
      }
    }

    // Build context for AI
    let context = '';
    
    if (inquiryType === 'event') {
      context = `
Kunde: ${contactName}${companyName ? ` (${companyName})` : ''}
Event: ${eventType || 'Feier'}
Datum: ${preferredDate || 'nach Absprache'}${timeSlot ? ` um ${timeSlot} Uhr` : ''}
Gäste: ${guestCount || 'n.a.'}
${packageName ? `Paket: ${packageName}` : ''}
${menuContext}
${notes ? `Bemerkung: ${notes}` : ''}
      `.trim();
    } else {
      context = `
Kunde: ${contactName}${companyName ? ` (${companyName})` : ''}
Lieferung: ${deliveryAddress || 'n.a.'}
Datum/Zeit: ${preferredDate || ''} ${deliveryTime || ''}
${menuContext}
${notes ? `Bemerkung: ${notes}` : ''}
      `.trim();
    }

    // Optimized system prompt for short, professional emails
    const systemPrompt = `Du bist ein professioneller Mitarbeiter von STORIA München.

STIL:
- Freundlich, aber geschäftsmäßig und auf den Punkt
- Kurz und prägnant (maximal 100-150 Wörter)
- Keine überschwänglichen Floskeln wie "wunderbar", "fantastisch", "herausragend", "Es ist uns eine große Ehre"
- KEIN Markdown (keine **, keine #, keine Listen mit -)
- Normaler E-Mail-Fließtext mit kurzen Absätzen

STRUKTUR (genau einhalten):
1. Kurze Anrede (1 Satz)
2. Bestätigung der wichtigsten Fakten (Datum, Gästeanzahl, ggf. Paket) in einem Fließtext-Satz
3. Hinweis: "Das detaillierte Angebot finden Sie im Anhang."
4. Info zur Vorauszahlung (100% erforderlich)
5. Schlusssatz mit Kontaktangebot
6. Signatur

VERBOTEN:
- Aufzählungslisten
- Fettdruck oder andere Formatierung
- Übertrieben blumige Sprache
- Mehr als 3 kurze Absätze vor der Signatur
- Phrasen wie "Wir freuen uns außerordentlich", "Ihr exklusives Event wird unvergesslich"

BEISPIEL-TON:
"Sehr geehrte Frau Schmidt,

vielen Dank für Ihre Anfrage. Gerne bestätigen wir Ihnen folgende Details: Business Dinner für 45 Personen am 15.03.2026 mit unserem Exclusive-Paket.

Das detaillierte Angebot mit allen Konditionen finden Sie im Anhang. Für Ihr gewähltes Paket ist eine Vorauszahlung von 100% erforderlich.

Bei Fragen stehe ich Ihnen gerne zur Verfügung.

${personalizedSignature}"

SIGNATUR (exakt so verwenden):
${personalizedSignature}`;

    const userPrompt = inquiryType === 'event' 
      ? `Schreibe eine kurze, professionelle Bestätigungs-E-Mail (max. 150 Wörter, keine Markdown-Formatierung) für diese Event-Anfrage:

${context}`
      : `Schreibe eine kurze Bestätigungs-E-Mail (max. 150 Wörter, keine Markdown-Formatierung) für diese Catering-Bestellung:

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
        max_tokens: 600,
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

    console.log('Email generated successfully');

    return new Response(
      JSON.stringify({ success: true, email: generatedEmail }),
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
