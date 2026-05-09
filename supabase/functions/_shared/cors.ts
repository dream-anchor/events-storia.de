/**
 * Shared CORS-Helper — erlaubt nur bekannte Origins.
 * Server-to-Server-Calls (kein Origin-Header) werden durchgelassen.
 */
const DEFAULT_ORIGIN = 'https://events-storia.de';

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/(www\.)?events-storia\.de$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  // Lovable preview / sandbox domains
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.sandbox\.lovable\.dev$/,
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : DEFAULT_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}
