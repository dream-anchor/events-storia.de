import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import prerender from "@prerenderer/rollup-plugin";

// SSG: Routes to prerender for SEO
const PRERENDER_ROUTES = [
  '/',
  '/kontakt',
  '/catering/buffet-fingerfood',
  '/catering/buffet-platten',
  '/catering/buffet-auflauf',
  '/catering/pizze-napoletane',
  '/catering/desserts',
  '/events',
  '/impressum',
  '/datenschutz',
  '/cookie-richtlinie',
  '/agb-catering',
  '/agb-restaurant',
  '/agb-gutscheine',
  '/widerrufsbelehrung',
  '/zahlungsinformationen',
  '/lebensmittelhinweise',
  '/haftungsausschluss',
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // IMPORTANT: Refine v5 routerProvider uses `react-router`.
      // Ensure the app does not load a second router context via `react-router-dom` imports.
      "react-router-dom": "react-router",
    },
  },
  // SSG: Prerender configuration for static HTML generation
  build: {
    rollupOptions: {
      plugins: mode === 'production' ? [
        prerender({
          routes: PRERENDER_ROUTES,
          renderer: '@prerenderer/renderer-puppeteer',
          rendererOptions: {
            renderAfterDocumentEvent: 'prerender-ready',
            headless: true,
          },
          postProcess(renderedRoute) {
            // Add prerendered marker for debugging
            renderedRoute.html = renderedRoute.html.replace(
              '</head>',
              '<meta name="prerendered" content="true"></head>'
            );
            return renderedRoute;
          },
        })
      ] : []
    }
  },
  // Export routes for sitemap generation
  define: {
    __PRERENDER_ROUTES__: JSON.stringify(PRERENDER_ROUTES),
  },
}));
