/**
 * Sitemap Generator for events-storia.de
 * Generates sitemap.xml with hreflang for DE + EN routes
 * Optionally submits all URLs to IndexNow for instant indexing
 *
 * Run: npx tsx scripts/generate-sitemap.ts
 * With IndexNow: npx tsx scripts/generate-sitemap.ts --indexnow
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { ROUTES } from '../src/config/routes';

const DOMAIN = 'https://events-storia.de';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'f439da44854a4800a154906041c53b06';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

// Generate lastmod date (today's date in YYYY-MM-DD format)
const today = new Date().toISOString().split('T')[0];

// Collect all public URLs (DE + EN)
const collectUrls = (): string[] => {
  const urls: string[] = [];
  for (const route of ROUTES) {
    if (!route.prerender) continue;
    urls.push(`${DOMAIN}${route.de}`);
    const enPath = route.en === '/' ? '/en' : `/en${route.en}`;
    urls.push(`${DOMAIN}${enPath}`);
  }
  return urls;
};

// Generate sitemap XML with hreflang
const generateSitemap = (): string => {
  const urlEntries: string[] = [];

  for (const route of ROUTES) {
    if (!route.prerender) continue;

    const dePath = route.de;
    const enPath = route.en === '/' ? '/en' : `/en${route.en}`;
    const priority = (route.priority ?? 0.5).toFixed(1);
    const changefreq = route.changefreq ?? 'monthly';

    // DE URL entry with hreflang
    urlEntries.push(`  <url>
    <loc>${DOMAIN}${dePath}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="de" href="${DOMAIN}${dePath}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${DOMAIN}${enPath}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${DOMAIN}${dePath}"/>
  </url>`);

    // EN URL entry with hreflang
    urlEntries.push(`  <url>
    <loc>${DOMAIN}${enPath}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="de" href="${DOMAIN}${dePath}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${DOMAIN}${enPath}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${DOMAIN}${dePath}"/>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join('\n')}
</urlset>`;
};

// Submit URLs to IndexNow API
const submitToIndexNow = async (urls: string[]): Promise<void> => {
  const payload = {
    host: 'events-storia.de',
    key: INDEXNOW_KEY,
    keyLocation: `${DOMAIN}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  console.log(`\n⚡ Submitting ${urls.length} URLs to IndexNow...`);

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
    console.log(`  ${icon} IndexNow response: ${statusCode} — ${message}`);
    if (body) console.log(`  Response body: ${body}`);
  } catch (error: any) {
    console.error(`  ✗ IndexNow submission failed: ${error.message}`);
  }
};

// --- Main ---

// Write sitemap to public directory
const outputPath = resolve(process.cwd(), 'public', 'sitemap.xml');
const sitemap = generateSitemap();

writeFileSync(outputPath, sitemap, 'utf-8');
const routeCount = ROUTES.filter(r => r.prerender).length;
console.log(`✓ Sitemap generated at: ${outputPath}`);
console.log(`  - ${routeCount} routes × 2 languages = ${routeCount * 2} URLs`);
console.log(`  - hreflang: de, en, x-default`);
console.log(`  - Last modified: ${today}`);

// Submit to IndexNow if --indexnow flag is passed
const shouldIndexNow = process.argv.includes('--indexnow');
if (shouldIndexNow) {
  const urls = collectUrls();
  submitToIndexNow(urls).then(() => {
    console.log('\n✓ IndexNow submission complete');
  });
} else {
  console.log(`\nTip: Run with --indexnow to submit URLs to search engines instantly`);
}
