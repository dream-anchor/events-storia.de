/**
 * Post-build script: Generates a minimal dist/admin/index.html
 *
 * The main dist/index.html contains pre-rendered frontend content (homepage).
 * When /admin/* is requested, the server would serve this pre-rendered homepage,
 * causing a visible flash of frontend content before React mounts.
 *
 * This script creates a clean admin shell HTML that:
 * - References the same bundled JS/CSS assets
 * - Has an empty <div id="root"> (no pre-rendered content)
 * - Shows the admin background color immediately
 * - Has noindex/nofollow for SEO
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');

// Read the built index.html to extract asset references
const indexHtml = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

// Extract CSS link tags
const cssMatches = indexHtml.match(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]*\.css"[^>]*>/g) || [];

// Extract JS script tags
const jsMatches = indexHtml.match(/<script type="module"[^>]*src="\/assets\/[^"]*\.js"[^>]*><\/script>/g) || [];

const adminHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StoriaMaestro</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" href="/maestro-favicon.svg" type="image/svg+xml" />
  ${cssMatches.join('\n  ')}
  ${jsMatches.join('\n  ')}
  <style>
    body { margin: 0; background: #f6f7f8; }
    @media (prefers-color-scheme: dark) { body { background: #101922; } }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

// Write to dist/admin/index.html
mkdirSync(resolve(distDir, 'admin'), { recursive: true });
writeFileSync(resolve(distDir, 'admin/index.html'), adminHtml, 'utf-8');

console.log('✓ Generated dist/admin/index.html (clean admin shell)');
