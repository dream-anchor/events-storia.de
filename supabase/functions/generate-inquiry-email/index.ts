import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    }: InquiryEmailRequest = await req.json();

    console.log('Generating email for inquiry type:', inquiryType);

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
${items && items.length > 0 ? `Bestellte Speisen:\n${items.map(i => `- ${i.quantity}x ${i.name}`).join('\n')}` : ''}
${totalAmount ? `Gesamtbetrag: ${totalAmount.toFixed(2)}€` : ''}
${notes ? `Notizen: ${notes}` : ''}
      `.trim();
    }

    const systemPrompt = `Du bist ein freundlicher Mitarbeiter des italienischen Restaurants "Storia" in München. 
Schreibe professionelle, aber herzliche E-Mails an Kunden. 
Verwende "Sie" als Anrede.
Halte die E-Mail kurz und prägnant (maximal 150 Wörter).
Unterschreibe mit "Herzliche Grüße, Ihr Storia-Team".
Erwähne NICHT den genauen Preis in der E-Mail - das Angebot wird als PDF-Anhang mitgeschickt.`;

    const userPrompt = inquiryType === 'event' 
      ? `Schreibe eine freundliche Bestätigungs-E-Mail für folgende Event-Anfrage. Bestätige den Empfang, zeige Begeisterung für das Event, erwähne die gewählten Pakete kurz und weise auf das beigefügte Angebot hin.

${context}`
      : `Schreibe eine freundliche Bestätigungs-E-Mail für folgende Catering-Bestellung. Bestätige die Bestellung, erwähne den Liefertermin und weise auf das beigefügte Angebot hin.

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
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
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
