import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from '../_shared/cors.ts';



/**
 * Einmalige Edge Function: Parst price_display → price für alle
 * Ristorante menu_items wo price IS NULL AND price_display IS NOT NULL.
 *
 * POST body: { "dryRun": true }  → Zeigt betroffene Zeilen (kein Update)
 * POST body: { "dryRun": false } → Führt Updates durch
 *
 * WICHTIG: Braucht RISTORANTE_SUPABASE_SERVICE_KEY für Schreibzugriff.
 * Falls nicht vorhanden, nutzt anon key (funktioniert nur wenn RLS es erlaubt).
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ristoranteUrl = Deno.env.get('RISTORANTE_SUPABASE_URL');
    // Bevorzuge Service-Role-Key für Schreibzugriff, Fallback auf Anon-Key
    const ristoranteKey = Deno.env.get('RISTORANTE_SUPABASE_SERVICE_KEY')
      || Deno.env.get('RISTORANTE_SUPABASE_ANON_KEY');

    if (!ristoranteUrl || !ristoranteKey) {
      throw new Error('Ristorante DB Credentials fehlen');
    }

    let dryRun = true;
    try {
      const body = await req.json();
      dryRun = body.dryRun !== false;
    } catch {
      // Default: dry run
    }

    const client = createClient(ristoranteUrl, ristoranteKey);

    // Finde alle Items mit price IS NULL aber price_display vorhanden
    const { data: items, error: fetchError } = await client
      .from('menu_items')
      .select('id, name, price, price_display')
      .is('price', null)
      .not('price_display', 'is', null);

    if (fetchError) {
      throw new Error(`Fetch fehlgeschlagen: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Keine Items mit price=null + price_display gefunden', affected: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse price_display → number
    const updates = items.map(item => {
      const raw = (item.price_display || '').replace(/[€\s]/g, '').replace(',', '.').trim();
      const parsed = parseFloat(raw);
      return {
        id: item.id,
        name: item.name,
        price_display: item.price_display,
        parsed_price: isNaN(parsed) ? null : parsed,
      };
    });

    const valid = updates.filter(u => u.parsed_price !== null);
    const invalid = updates.filter(u => u.parsed_price === null);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          mode: 'DRY RUN — kein Update durchgeführt',
          total_null_price: items.length,
          parseable: valid.length,
          not_parseable: invalid.length,
          updates: valid.map(u => ({
            id: u.id,
            name: u.name,
            price_display: u.price_display,
            new_price: u.parsed_price,
          })),
          skipped: invalid.map(u => ({
            id: u.id,
            name: u.name,
            price_display: u.price_display,
            reason: 'Preis konnte nicht geparst werden',
          })),
        }, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Updates ausführen
    const results: { id: string; name: string; price: number; success: boolean; error?: string }[] = [];

    for (const u of valid) {
      const { error: updateError } = await client
        .from('menu_items')
        .update({ price: u.parsed_price })
        .eq('id', u.id);

      results.push({
        id: u.id,
        name: u.name,
        price: u.parsed_price!,
        success: !updateError,
        error: updateError?.message,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        mode: 'LIVE — Updates durchgeführt',
        total_updated: successCount,
        total_failed: failCount,
        skipped_unparseable: invalid.length,
        results,
        skipped: invalid.map(u => ({
          id: u.id,
          name: u.name,
          price_display: u.price_display,
        })),
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
