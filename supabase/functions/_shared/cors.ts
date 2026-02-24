/**
 * Shared CORS-Helper — erlaubt nur bekannte Origins.
 * Server-to-Server-Calls (kein Origin-Header) werden durchgelassen.
 */
const ALLOWED_ORIGINS = [
  'https://events-storia.de',
  'https://www.events-storia.de',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';

  // Localhost für Entwicklung erlauben
  const isLocalhost = origin.startsWith('http://localhost:');
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLocalhost;

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}
