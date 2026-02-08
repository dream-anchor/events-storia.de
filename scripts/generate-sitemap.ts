/**
 * Sitemap Generator for events-storia.de
 * Generates sitemap.xml with hreflang for DE + EN routes
 * Run: npx tsx scripts/generate-sitemap.ts
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { ROUTES } from '../src/config/routes';

const DOMAIN = 'https://events-storia.de';

// Generate lastmod date (today's date in YYYY-MM-DD format)
const today = new Date().toISOString().split('T')[0];

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

// Write sitemap to public directory
const outputPath = resolve(process.cwd(), 'public', 'sitemap.xml');
const sitemap = generateSitemap();

writeFileSync(outputPath, sitemap, 'utf-8');
const routeCount = ROUTES.filter(r => r.prerender).length;
console.log(`✓ Sitemap generated at: ${outputPath}`);
console.log(`  - ${routeCount} routes × 2 languages = ${routeCount * 2} URLs`);
console.log(`  - hreflang: de, en, x-default`);
console.log(`  - Last modified: ${today}`);
