import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
  items?: Array<{ name: string; quantity: number; price: number }>;
  packages?: Array<{ name: string; price: number }>;
  deliveryAddress?: string;
  deliveryTime?: string;
  totalAmount?: number;
  notes?: string;
  menuSelection?: MenuSelection;
  packageName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
      items,
      packages,
      deliveryAddress,
      deliveryTime,
      totalAmount,
      notes,
      menuSelection,
      packageName,
    }: InquiryEmailRequest = await req.json();

    console.log('Generating email for inquiry type:', inquiryType);
    console.log('Menu selection received:', menuSelection ? 'yes' : 'no');

    // Format menu selection for prompt
    let menuContext = '';
    if (menuSelection) {
      if (menuSelection.courses && menuSelection.courses.length > 0) {
        menuContext += '\nZusammengestelltes Menü:\n';
        menuSelection.courses.forEach((course, index) => {
          menuContext += `${index + 1}. ${course.courseLabel || course.courseType}: ${course.itemName}`;
          if (course.itemDescription) {
            menuContext += ` (${course.itemDescription})`;
          }
          menuContext += '\n';
        });
      }
      
      if (menuSelection.drinks && menuSelection.drinks.length > 0) {
        menuContext += '\nGetränke-Pauschale:\n';
        menuSelection.drinks.forEach(drink => {
          let drinkText = `- ${drink.drinkLabel || drink.drinkGroup}`;
          if (drink.selectedChoice) {
            drinkText += `: ${drink.selectedChoice}`;
          }
          if (drink.quantityLabel) {
            drinkText += ` (${drink.quantityLabel})`;
          }
          menuContext += drinkText + '\n';
        });
      }
    }

    // Build context for AI
    let context = '';
    
    if (inquiryType === 'event') {
      context = `
Art der Anfrage: Event/Feier im Restaurant Storia
Kunde: ${contactName}${companyName ? ` (${companyName})` : ''}
Art des Events: ${eventType || 'Feier'}
Anzahl Gäste: ${guestCount || 'nicht angegeben'}
Gewünschtes Datum: ${preferredDate || 'flexibel'}
${packages && packages.length > 0 ? `Gewählte Pakete:\n${packages.map(p => `- ${p.name} (${p.price.toFixed(2)}€)`).join('\n')}` : ''}
${menuContext}
${items && items.length > 0 ? `Zusätzliche Speisen:\n${items.map(i => `- ${i.quantity}x ${i.name}`).join('\n')}` : ''}
${totalAmount ? `Gesamtbetrag: ${totalAmount.toFixed(2)}€` : ''}
${notes ? `Notizen: ${notes}` : ''}
      `.trim();
    } else {
      context = `
Art der Anfrage: Catering-Lieferung außer Haus
Kunde: ${contactName}${companyName ? ` (${companyName})` : ''}
Lieferadresse: ${deliveryAddress || 'nicht angegeben'}
Lieferzeit: ${deliveryTime || 'nicht angegeben'}
Datum: ${preferredDate || 'nicht angegeben'}
${menuContext}
${items && items.length > 0 ? `Bestellte Speisen:\n${items.map(i => `- ${i.quantity}x ${i.name}`).join('\n')}` : ''}
${totalAmount ? `Gesamtbetrag: ${totalAmount.toFixed(2)}€` : ''}
${notes ? `Notizen: ${notes}` : ''}
      `.trim();
    }

    // Determine drink type based on package name for context-aware phrasing
    const isAperitivo = packageName?.toLowerCase().includes('aperitivo') || packageName?.toLowerCase().includes('network');
    const isDinner = packageName?.toLowerCase().includes('dinner') || packageName?.toLowerCase().includes('exclusive');
    const isFullBuyout = packageName?.toLowerCase().includes('location') || packageName?.toLowerCase().includes('buyout');
    
    // Package-specific drink terminology
    let drinkTerminology = 'Getränke-Pauschale';
    if (isAperitivo) {
      drinkTerminology = 'Getränke-Pauschale (Aperitif & Wein/Bier)';
    } else if (isDinner || isFullBuyout) {
      drinkTerminology = 'Weinbegleitung';
    }

    const systemPrompt = `Du bist ein freundlicher Mitarbeiter des italienischen Business-Event-Restaurants "STORIA" in München. 
Schreibe professionelle, aber herzliche E-Mails an Kunden. 
Verwende "Sie" als Anrede.
Halte die E-Mail strukturiert und angemessen lang (ca. 200-300 Wörter).
Unterschreibe mit "Herzliche Grüße, Ihr STORIA-Team".
Erwähne NICHT den genauen Preis in der E-Mail - das Angebot wird als PDF-Anhang mitgeschickt.

ÜBER STORIA:
- Moderne Eventlocation im Herzen Münchens für Business Events, Firmendinner und Kundenevents
- Exklusiver Private Room (bis 65 Personen), Bar- & Open-Kitchen-Bereich (bis 42 Personen)
- Kombinierbare Räume: bis 90-100 Personen sitzend, Flying Buffet bis 180 Gäste

UNSERE PAKETE:
1. Business Dinner – Exclusive (ab 99€ p.P., min. 30 Pers.): Welcome-Aperitivo, geteilte Vorspeisen, Zwei-Gang-Dinner, Wein/Wasser/Kaffee
2. Networking Aperitivo (ab 69€ p.P., min. 20 Pers.): Italienisches Fingerfood, Live-Pasta-Station, Wein & Cocktails
3. Full Buyout (ab 8.500€ pauschal): Exklusive Nutzung gesamte Location, individuelles Setup, Firmenbranding möglich

MENÜ-ERWÄHNUNG (WICHTIG):
${menuSelection && (menuSelection.courses?.length > 0 || menuSelection.drinks?.length > 0) ? `
- Das Menü wurde bereits zusammengestellt - beschreibe kurz und appetitanregend die Gänge
- Erwähne die ausgewählten Gerichte namentlich mit einer kurzen, einladenden Beschreibung
- Formuliere das Menü so, dass Vorfreude entsteht
` : `
- Kein spezifisches Menü ausgewählt - erwähne, dass Details im Angebot zu finden sind
`}

WICHTIGE HINWEISE (IMMER AM ENDE DER E-MAIL EINFÜGEN):
Füge am Ende der E-Mail folgende Hinweise ein und passe sie dem Paket an:

1. Getränke-Flexibilität (angepasst an Paket-Typ):
   - Für Dinner/Full Buyout: "Der Wert der Weinbegleitung kann auf Wunsch auch flexibel auf andere Getränke angerechnet werden."
   - Für Aperitivo: "Der Wert der Getränke-Pauschale kann auf Wunsch flexibel angepasst werden."

2. Menü-Individualität:
   "Die Menüs können innerhalb der Gruppe individuell gewählt werden. Allergien oder besondere Ernährungswünsche berücksichtigen wir selbstverständlich nach vorheriger Abstimmung."

3. Verbindliche Angaben (nur bei Dinner mit Fleisch/Fisch-Auswahl):
   "Für unsere Planung bitten wir um eine verbindliche Angabe der Anzahl der Fleisch- und Fisch-Menüs spätestens 3 Tage vor dem Termin."

Das gewählte Paket ist: ${packageName || 'nicht spezifiziert'}
Passe die Formulierungen entsprechend an (z.B. "${drinkTerminology}" statt generisch "Getränke").

SCHLÜSSELREGELN (STRIKT EINHALTEN):
- Wir arbeiten mit fixen Paketen und transparenten Festpreisen
- Es werden KEINE Rabatte gewährt - niemals!
- Falls der Kunde nach Rabatt gefragt hat, antworte höflich aber bestimmt:
  "Wir arbeiten mit transparenten Festpreisen, um Ihnen maximale Qualität und Planungssicherheit zu garantieren."
- Vorauszahlung von 100% ist verpflichtend für alle Pakete
- Erwähne bei Events: "Für Ihr gewähltes Paket ist eine Vorauszahlung von 100% erforderlich."
- Formate sind anpassbar, aber keine Preisnachlässe
- Betone stets die Exklusivität, zentrale Lage und schlüsselfertige Eventorganisation`;

    const userPrompt = inquiryType === 'event' 
      ? `Schreibe eine freundliche Bestätigungs-E-Mail für folgende Event-Anfrage. Bestätige den Empfang, zeige Begeisterung für das Event, erwähne die gewählten Pakete und das zusammengestellte Menü (falls vorhanden), und weise auf das beigefügte Angebot hin.

${context}`
      : `Schreibe eine freundliche Bestätigungs-E-Mail für folgende Catering-Bestellung. Bestätige die Bestellung, erwähne den Liefertermin und das zusammengestellte Menü (falls vorhanden), und weise auf das beigefügte Angebot hin.

${context}`;

    // Use Lovable AI API
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const generatedEmail = aiResponse.choices?.[0]?.message?.content || '';

    console.log('Email generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: generatedEmail 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Error generating email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
