import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TranslateRequest {
  texts: {
    name?: string;
    description?: string;
  };
  sourceLang?: string;
  targetLang?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TranslateRequest = await req.json();
    const { texts, sourceLang = 'de', targetLang = 'en' } = body;

    if (!texts || (!texts.name && !texts.description)) {
      return new Response(
        JSON.stringify({ error: 'No texts to translate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt
    const langNames: Record<string, string> = { de: 'Deutsch', en: 'Englisch', it: 'Italienisch', fr: 'Französisch' };
    const fromLang = langNames[sourceLang] || sourceLang;
    const toLang = langNames[targetLang] || targetLang;

    const parts: string[] = [];
    if (texts.name) parts.push(`Name: "${texts.name}"`);
    if (texts.description) parts.push(`Beschreibung: "${texts.description}"`);

    const systemPrompt = `Du bist ein professioneller Übersetzer für Speisekarten und Gastronomie.
Übersetze die folgenden Texte von ${fromLang} nach ${toLang}.

REGELN:
- Behalte kulinarische Fachbegriffe bei, wenn sie international verständlich sind (z.B. "Bruschetta", "Risotto", "Carpaccio")
- Übersetze natürlich und appetitlich
- Keine Erklärungen, nur die Übersetzung
- Antworte NUR im JSON-Format: {"name_translated": "...", "description_translated": "..."}
- Wenn ein Feld nicht gegeben wurde, setze es auf null`;

    const userPrompt = `Übersetze:\n${parts.join('\n')}`;

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
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit erreicht, bitte später erneut versuchen.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI-Guthaben aufgebraucht.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `KI-Service Fehler (HTTP ${response.status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let parsed: { name_translated?: string; description_translated?: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      console.error('Failed to parse AI response:', content);
      parsed = {};
    }

    const result: Record<string, string | null> = {};
    if (texts.name) {
      result[`name_${targetLang}`] = parsed.name_translated || null;
    }
    if (texts.description) {
      result[`description_${targetLang}`] = parsed.description_translated || null;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in translate-menu-text:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
