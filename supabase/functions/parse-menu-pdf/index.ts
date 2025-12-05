import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuItem {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number | null;
  price_display: string;
  sort_order: number;
}

interface MenuCategory {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  sort_order: number;
  items: MenuItem[];
}

interface ParsedMenu {
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  categories: MenuCategory[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, menuType } = await req.json();
    
    if (!pdfBase64) {
      throw new Error('PDF Base64 content is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Parsing menu PDF for type: ${menuType}, base64 length: ${pdfBase64.length}`);

    const systemPrompt = `Du bist ein präziser Menü-Parser für ein italienisches Restaurant. Deine Aufgabe ist es, den Inhalt eines Menü-PDFs EXAKT zu extrahieren UND automatisch ins Englische zu übersetzen.

WICHTIGE REGELN FÜR EXTRAKTION:
1. Übernimm ALLE deutschen Texte WÖRTLICH - keine Umformulierungen oder Korrekturen
2. Preise müssen EXAKT übernommen werden (z.B. "12,50" oder "€12,50")
3. Behalte die Kategorien-Struktur bei (z.B. "Vorspeisen", "Pasta", "Pizza", etc.)
4. Bei Unklarheiten: lieber original übernehmen als interpretieren
5. Erkenne Preise auch wenn sie in verschiedenen Formaten angegeben sind (€, EUR, ohne Währung)

AUTOMATISCHE ENGLISCHE ÜBERSETZUNG (PFLICHT):
6. Übersetze ALLE deutschen Texte automatisch ins Englische für die _en Felder:
   - name → name_en (z.B. "Vorspeisen" → "Starters", "Hauptgerichte" → "Main Courses")
   - description → description_en (vollständige Übersetzung der Beschreibung)
7. Bei italienischen Kategorie-Namen wie "Antipasti", "Primi Piatti", "Dolci":
   - Behalte sie im name Feld (Deutsch)
   - Für name_en: füge englische Übersetzung hinzu (z.B. "Antipasti - Starters", "Dolci - Desserts")
8. Bei Gerichten mit italienischen Namen (z.B. "Spaghetti Carbonara"):
   - name: Original beibehalten
   - name_en: Original beibehalten (italienische Gerichtnamen sind international)
   - description_en: Deutsche Beschreibung ins Englische übersetzen

Antworte NUR mit dem strukturierten Tool-Call, keine zusätzlichen Erklärungen.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              },
              {
                type: 'text',
                text: 'Extrahiere den kompletten Menü-Inhalt aus diesem PDF. Übernimm alle Gerichte, Beschreibungen und Preise EXAKT wie im Dokument.'
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_menu',
              description: 'Extrahiert strukturierte Menü-Daten aus dem PDF-Inhalt',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Titel des Menüs auf Deutsch (z.B. "Business Lunch", "Speisekarte")' },
                  title_en: { type: 'string', description: 'Titel des Menüs auf Englisch (z.B. "Business Lunch", "Menu")' },
                  subtitle: { type: 'string', description: 'Untertitel oder Zusatzinfo auf Deutsch (z.B. Öffnungszeiten)' },
                  subtitle_en: { type: 'string', description: 'Untertitel oder Zusatzinfo auf Englisch' },
                  categories: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Kategoriename auf Deutsch' },
                        name_en: { type: 'string', description: 'Kategoriename auf Englisch (falls vorhanden)' },
                        description: { type: 'string', description: 'Kategoriebeschreibung auf Deutsch' },
                        description_en: { type: 'string', description: 'Kategoriebeschreibung auf Englisch' },
                        sort_order: { type: 'number', description: 'Sortierreihenfolge' },
                        items: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string', description: 'Gerichtname auf Deutsch' },
                              name_en: { type: 'string', description: 'Gerichtname auf Englisch' },
                              description: { type: 'string', description: 'Beschreibung auf Deutsch' },
                              description_en: { type: 'string', description: 'Beschreibung auf Englisch' },
                              price: { type: 'number', description: 'Preis als Zahl (z.B. 12.50)' },
                              price_display: { type: 'string', description: 'Preis als formatierter String (z.B. "€12,50")' },
                              sort_order: { type: 'number', description: 'Sortierreihenfolge' }
                            },
                            required: ['name', 'price_display', 'sort_order']
                          }
                        }
                      },
                      required: ['name', 'sort_order', 'items']
                    }
                  }
                },
                required: ['title', 'title_en', 'categories']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_menu' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_menu') {
      throw new Error('Invalid AI response format');
    }

    const parsedMenu: ParsedMenu = JSON.parse(toolCall.function.arguments);
    console.log(`Parsed ${parsedMenu.categories.length} categories`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: parsedMenu 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error parsing menu PDF:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
