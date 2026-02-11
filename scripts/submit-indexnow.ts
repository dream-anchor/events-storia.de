/**
 * IndexNow URL Submission Script
 * Submit specific URLs or all public URLs to IndexNow for instant indexing.
 *
 * Usage:
 *   npx tsx scripts/submit-indexnow.ts                        # Submit all public URLs
 *   npx tsx scripts/submit-indexnow.ts /kontakt /events       # Submit specific paths
 */

import { ROUTES } from '../src/config/routes';

const DOMAIN = 'https://events-storia.de';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'f439da44854a4800a154906041c53b06';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

// Collect all prerenderable URLs
const getAllPublicUrls = (): string[] => {
  const urls: string[] = [];
  for (const route of ROUTES) {
    if (!route.prerender) continue;
    urls.push(`${DOMAIN}${route.de}`);
    const enPath = route.en === '/' ? '/en' : `/en${route.en}`;
    urls.push(`${DOMAIN}${enPath}`);
  }
  return urls;
};

// Submit to IndexNow API
const submitToIndexNow = async (urls: string[]): Promise<void> => {
  const payload = {
    host: 'events-storia.de',
    key: INDEXNOW_KEY,
    keyLocation: `${DOMAIN}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  console.log(`⚡ Submitting ${urls.length} URLs to IndexNow...\n`);
  urls.forEach(url => console.log(`  → ${url}`));

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const statusCode = response.status;
    const body = await response.text();

    const statusMessages: Record<number, string> = {
      200: 'OK — URLs submitted successfully',
      202: 'Accepted — URLs received, will be processed later',
      400: 'Bad Request — invalid format',
      403: 'Forbidden — key not valid or does not match',
      422: 'Unprocessable Entity — URLs don\'t belong to host or key not found',
      429: 'Too Many Requests — rate limited',
    };

    const message = statusMessages[statusCode] || `Unknown status: ${statusCode}`;
    const icon = statusCode === 200 || statusCode === 202 ? '✓' : '✗';
    console.log(`\n${icon} IndexNow response: ${statusCode} — ${message}`);
    if (body) console.log(`  Response body: ${body}`);
  } catch (error: any) {
    console.error(`\n✗ IndexNow submission failed: ${error.message}`);
  }
};

// --- Main ---
const args = process.argv.slice(2);

let urls: string[];

if (args.length > 0) {
  // Submit specific paths
  urls = args.map(path => path.startsWith('http') ? path : `${DOMAIN}${path}`);
} else {
  // Submit all public URLs
  urls = getAllPublicUrls();
}

submitToIndexNow(urls);
