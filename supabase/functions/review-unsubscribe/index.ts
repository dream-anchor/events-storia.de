// Unsubscribe handler for review-request emails (GET = HTML confirmation).
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

function page(message: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>STORIA – Abmeldung</title>
<style>body{margin:0;padding:60px 20px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;background:#efe7d6;color:#2a2520;}
.card{max-width:520px;margin:0 auto;background:#f8f1e4;border-radius:12px;padding:48px 32px;text-align:center;box-shadow:0 8px 32px rgba(107,31,42,0.08);}
h1{font-family:Georgia,serif;color:#6b1f2a;font-size:28px;margin:0 0 16px;}
p{font-size:16px;line-height:24px;}
a{color:#6b1f2a;}</style></head>
<body><div class="card"><h1>STORIA Catering &amp; Events</h1><p>${message}</p><p style="margin-top:32px;font-size:14px;color:#9a9388;">Bei Fragen erreichen Sie uns unter <a href="mailto:info@events-storia.de">info@events-storia.de</a>.</p></div></body></html>`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(page('Der Abmelde-Link ist ungültig oder unvollständig.'), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await supabase.from('review_request_unsubscribes').upsert({ email, source: 'footer_link' });

  if (error) {
    return new Response(page('Es ist ein Fehler aufgetreten. Bitte schreiben Sie uns kurz an info@events-storia.de.'), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(page(`Sie sind abgemeldet.<br/><br/><strong>${email.replace(/</g,'')}</strong> erhält keine weiteren Bewertungsanfragen mehr von STORIA Catering &amp; Events.`), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
});
