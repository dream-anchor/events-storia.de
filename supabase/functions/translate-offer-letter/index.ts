import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * translate-offer-letter
 * Übersetzt das Anschreiben (email_content) eines Angebots in eine Zielsprache (en/it/fr).
 * Cached das Ergebnis in v2_events.email_content_translations (jsonb { en, it, fr }).
 * Public-callable (kein Auth nötig — wird von der öffentlichen Angebotsseite genutzt).
 */

interface ReqBody {
  inquiry_id: string;
  target_lang: 'en' | 'it' | 'fr';
  source_text?: string; // optional: client kann den bereits geladenen Text mitschicken
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  it: 'Italian',
  fr: 'French',
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as ReqBody;
    const { inquiry_id, target_lang } = body;

    if (!inquiry_id || !['en', 'it', 'fr'].includes(target_lang)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Aktuelles Anschreiben laden (latest version aus history, sonst draft)
    const { data: ev } = await supabase
      .from('v2_events')
      .select('id, email_draft, email_content_translations')
      .eq('id', inquiry_id)
      .maybeSingle();

    if (!ev) {
      return new Response(JSON.stringify({ error: 'Inquiry not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cached = (ev.email_content_translations ?? {}) as Record<string, string>;
    if (cached[target_lang]) {
      return new Response(JSON.stringify({ translated: cached[target_lang], cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Source: aus history (latest version) oder body.source_text oder draft
    let sourceText = body.source_text || '';
    if (!sourceText) {
      const { data: hist } = await supabase
        .from('inquiry_offer_history')
        .select('email_content')
        .eq('inquiry_id', inquiry_id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      sourceText = hist?.email_content || ev.email_draft || '';
    }

    if (!sourceText) {
      return new Response(JSON.stringify({ error: 'No source text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator for premium hospitality and event catering correspondence. Translate the German cover letter to ${LANG_NAMES[target_lang]}. Preserve formatting (line breaks, paragraphs, greeting, signature). Keep proper names, dates, prices, addresses unchanged. Use a warm, polite, professional tone. Do NOT add explanations — return only the translated letter.`,
          },
          { role: 'user', content: sourceText },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error('AI error', aiRes.status, errorText);
      const status = aiRes.status === 429 ? 429 : aiRes.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}` }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const translated = (aiJson.choices?.[0]?.message?.content || '').trim();

    if (!translated) {
      return new Response(JSON.stringify({ error: 'Empty translation' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cachen
    const updated = { ...cached, [target_lang]: translated };
    await supabase
      .from('v2_events')
      .update({ email_content_translations: updated })
      .eq('id', inquiry_id);

    return new Response(JSON.stringify({ translated, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('translate-offer-letter error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});