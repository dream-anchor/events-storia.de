/**
 * Sitemap Generator for events-storia.de
 * Generates sitemap.xml with all public routes and SEO metadata
 * Run: npx tsx scripts/generate-sitemap.ts
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const DOMAIN = 'https://events-storia.de';

interface SitemapRoute {
  path: string;
  priority: number;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  lastmod?: string;
}

// All public routes with SEO metadata
const routes: SitemapRoute[] = [
  // High priority - Main pages
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/events', priority: 0.9, changefreq: 'weekly' },
  { path: '/kontakt', priority: 0.8, changefreq: 'monthly' },

  // Service pages - Medium-high priority
  { path: '/faq-catering-muenchen', priority: 0.7, changefreq: 'monthly' },

  // Catering pages - Medium-high priority
  { path: '/catering/buffet-fingerfood', priority: 0.8, changefreq: 'weekly' },
  { path: '/catering/buffet-platten', priority: 0.8, changefreq: 'weekly' },
  { path: '/catering/buffet-auflauf', priority: 0.8, changefreq: 'weekly' },
  { path: '/catering/pizze-napoletane', priority: 0.8, changefreq: 'weekly' },
  { path: '/catering/desserts', priority: 0.8, changefreq: 'weekly' },

  // Legal pages - Low priority but necessary
  { path: '/impressum', priority: 0.3, changefreq: 'yearly' },
  { path: '/datenschutz', priority: 0.3, changefreq: 'yearly' },
  { path: '/cookie-richtlinie', priority: 0.2, changefreq: 'yearly' },
  { path: '/agb-catering', priority: 0.3, changefreq: 'yearly' },
  { path: '/agb-restaurant', priority: 0.3, changefreq: 'yearly' },
  { path: '/agb-gutscheine', priority: 0.2, changefreq: 'yearly' },
  { path: '/widerrufsbelehrung', priority: 0.3, changefreq: 'yearly' },
  { path: '/zahlungsinformationen', priority: 0.2, changefreq: 'yearly' },
  { path: '/lebensmittelhinweise', priority: 0.2, changefreq: 'yearly' },
  { path: '/haftungsausschluss', priority: 0.2, changefreq: 'yearly' },
];

// Generate lastmod date (today's date in YYYY-MM-DD format)
const today = new Date().toISOString().split('T')[0];

// Generate sitemap XML
const generateSitemap = (): string => {
  const urlEntries = routes
    .map(route => `  <url>
    <loc>${DOMAIN}${route.path}</loc>
    <lastmod>${route.lastmod || today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
};

// Write sitemap to public directory
const outputPath = resolve(process.cwd(), 'public', 'sitemap.xml');
const sitemap = generateSitemap();

writeFileSync(outputPath, sitemap, 'utf-8');
console.log(`✓ Sitemap generated at: ${outputPath}`);
console.log(`  - ${routes.length} URLs included`);
console.log(`  - Last modified: ${today}`);
