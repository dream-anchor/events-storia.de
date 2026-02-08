import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import prerender from "@prerenderer/rollup-plugin";

// SSG: Routes to prerender for SEO (DE + EN)
const PRERENDER_ROUTES = [
  // DE routes (no prefix)
  '/',
  '/kontakt',
  '/events',
  '/catering/buffet-fingerfood',
  '/catering/buffet-platten',
  '/catering/buffet-auflauf',
  '/catering/pizze-napoletane',
  '/catering/desserts',
  '/faq-catering-muenchen',
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
  // SEO Landing Pages DE
  '/italienisches-catering-muenchen',
  '/firmenfeier-catering-muenchen',
  '/weihnachtsfeier-catering-muenchen',
  '/pizza-catering-muenchen',
  '/buero-catering-muenchen',
  // EN routes (/en prefix)
  '/en',
  '/en/contact',
  '/en/events',
  '/en/catering/finger-food-buffet',
  '/en/catering/platters-sharing',
  '/en/catering/hot-dishes',
  '/en/catering/pizza-napoletana',
  '/en/catering/desserts',
  '/en/catering-faq-munich',
  '/en/imprint',
  '/en/privacy',
  '/en/cookie-policy',
  '/en/catering-terms',
  '/en/restaurant-terms',
  '/en/voucher-terms',
  '/en/cancellation-policy',
  '/en/payment-information',
  '/en/food-information',
  '/en/disclaimer',
  // SEO Landing Pages EN
  '/en/italian-catering-munich',
  '/en/corporate-event-catering-munich',
  '/en/christmas-party-catering-munich',
  '/en/pizza-catering-munich',
  '/en/office-catering-munich',
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
