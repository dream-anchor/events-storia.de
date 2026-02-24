import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';



interface ParseInquiryRequest {
  rawText: string;
  existingPackageNames?: string[];
}

interface SuggestedPackage {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  matched_keywords: string[];
}

interface ParsedInquiry {
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  guest_count: string | null;
  event_type: string | null;
  suggested_packages: SuggestedPackage[];
  suggested_items: { search_term: string; context: string }[];
  original_message_summary: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rawText, existingPackageNames }: ParseInquiryRequest = await req.json();

    if (!rawText || rawText.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kein Text zum Analysieren' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing inquiry text, length:', rawText.length);
    console.log('Available packages:', existingPackageNames);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Du bist ein intelligenter Parser für Event- und Catering-Anfragen des italienischen Business-Event-Restaurants "STORIA" in München.

DEINE AUFGABE:
1. Extrahiere Kontaktdaten (Name, Firma, E-Mail, Telefon) aus dem Text
2. Erkenne Event-Details (Datum, Uhrzeit, Gästezahl, Art des Events)
3. Identifiziere gewünschte Produkte/Pakete basierend auf Schlüsselwörtern

PAKET-ERKENNUNG (WICHTIG):
Analysiere den Text auf folgende Schlüsselwörter und ordne sie unseren Paketen zu:

- "Aperitif", "Networking", "Standing", "Fingerfood", "Empfang" → Network Aperitivo (Confidence: high wenn 2+ Keywords)
- "Dinner", "Abendessen", "Menü", "3-Gang", "4-Gang", "Firmendinner", "Essen" → Business Dinner – Exclusive
- "ganze Location", "exklusiv", "Buyout", "nur für uns", "private" → Full Buyout
- "Buffet", "Catering", "Lieferung", "liefern", "außer Haus" → Catering-Anfrage (kein Paket, aber als Item erkannt)
- "Weihnachtsfeier", "Weihnachten" → Business Dinner – Exclusive mit Event-Typ "Weihnachtsfeier"
- "Sommerfest", "Sommer" → Network Aperitivo mit Event-Typ "Sommerfest"
- "Kundenevents", "Kundenveranstaltung" → Business Dinner – Exclusive
- "Team-Event", "Teambuilding" → Network Aperitivo

DATUM-ERKENNUNG:
- Erkenne verschiedene Formate: "15. März", "15.03.2026", "März 2026", "nächsten Freitag"
- Konvertiere zu ISO-Format (YYYY-MM-DD) wenn möglich, sonst als Freitext

GÄSTE-ERKENNUNG:
- Erkenne: "40 Personen", "für 40", "ca. 40 Gäste", "30-40 Teilnehmer"
- Extrahiere als Zahl oder Bereich

EVENT-TYP ERKENNUNG:
- Firmendinner, Kundenabend, Weihnachtsfeier, Sommerfest, Networking-Event, Produktpräsentation, Jubiläum, etc.

KONTAKT-ERKENNUNG:
- E-Mail: Suche nach @-Zeichen
- Telefon: Suche nach Nummernfolgen mit +49, 089, 0176 etc.
- Name: Oft nach "Mit freundlichen Grüßen", in E-Mail-Signatur, oder am Anfang

Antworte NUR mit dem strukturierten Tool-Call.`;

    const userPrompt = `Analysiere folgenden Text einer Kundenanfrage und extrahiere alle relevanten Informationen:

---
${rawText}
---

${existingPackageNames && existingPackageNames.length > 0 
  ? `Verfügbare Pakete im System: ${existingPackageNames.join(', ')}` 
  : ''}`;

    const tools = [{
      type: "function",
      function: {
        name: "extract_inquiry_data",
        description: "Extrahiert strukturierte Daten aus einer Kundenanfrage",
        parameters: {
          type: "object",
          properties: {
            contact_name: { 
              type: "string", 
              description: "Name des Ansprechpartners" 
            },
            company_name: { 
              type: "string", 
              description: "Firmenname, falls erkennbar" 
            },
            email: { 
              type: "string", 
              description: "E-Mail-Adresse des Kunden" 
            },
            phone: { 
              type: "string", 
              description: "Telefonnummer des Kunden" 
            },
            preferred_date: { 
              type: "string", 
              description: "Gewünschtes Datum im Format YYYY-MM-DD oder als Text" 
            },
            preferred_time: { 
              type: "string", 
              description: "Gewünschte Uhrzeit, z.B. '18:00' oder 'abends'" 
            },
            guest_count: { 
              type: "string", 
              description: "Anzahl der Gäste, z.B. '40' oder '30-40'" 
            },
            event_type: { 
              type: "string", 
              description: "Art des Events, z.B. 'Firmendinner', 'Weihnachtsfeier', 'Networking'" 
            },
            suggested_packages: {
              type: "array",
              description: "Liste der erkannten Paket-Vorschläge",
              items: {
                type: "object",
                properties: {
                  name: { 
                    type: "string", 
                    description: "Name des Pakets (exakt wie im System)" 
                  },
                  confidence: { 
                    type: "string", 
                    enum: ["high", "medium", "low"],
                    description: "Wie sicher ist die Zuordnung?" 
                  },
                  matched_keywords: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Welche Schlüsselwörter haben gematcht?" 
                  }
                },
                required: ["name", "confidence", "matched_keywords"]
              }
            },
            suggested_items: {
              type: "array",
              description: "Suchbegriffe für Menü-Items, falls erkannt",
              items: {
                type: "object",
                properties: {
                  search_term: { type: "string" },
                  context: { type: "string" }
                },
                required: ["search_term", "context"]
              }
            },
            original_message_summary: { 
              type: "string", 
              description: "Kurze Zusammenfassung der Anfrage (1-2 Sätze)" 
            }
          },
          required: ["suggested_packages", "original_message_summary"]
        }
      }
    }];

    console.log('Calling Lovable AI API with tool-calling...');

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
        tools,
        tool_choice: { type: "function", function: { name: "extract_inquiry_data" } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit erreicht. Bitte versuchen Sie es in einer Minute erneut.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Guthaben aufgebraucht. Bitte kontaktieren Sie den Administrator.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response received:', JSON.stringify(aiResponse, null, 2));

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_inquiry_data') {
      console.error('No valid tool call in response');
      throw new Error('KI konnte die Anfrage nicht analysieren');
    }

    let parsedData: ParsedInquiry;
    try {
      parsedData = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse tool arguments:', toolCall.function.arguments);
      throw new Error('Ungültige KI-Antwort');
    }

    // Ensure arrays are initialized
    parsedData.suggested_packages = parsedData.suggested_packages || [];
    parsedData.suggested_items = parsedData.suggested_items || [];

    console.log('Parsed inquiry data:', parsedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error parsing inquiry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
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
