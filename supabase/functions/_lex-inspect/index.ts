import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
serve(async (req) => {
  const { id, type } = await req.json();
  const r = await fetch(`https://api.lexoffice.io/v1/${type}/${id}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('LEXOFFICE_API_KEY')}`, Accept: 'application/json' },
  });
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
});
