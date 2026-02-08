/**
 * Central route configuration for i18n URL routing.
 * DE routes have no prefix, EN routes get /en/ prefix.
 * This file is the single source of truth for all route mappings.
 */

export type RouteKey =
  | 'home'
  | 'contact'
  | 'events'
  | 'catering.fingerfood'
  | 'catering.platters'
  | 'catering.casseroles'
  | 'catering.pizza'
  | 'catering.desserts'
  | 'checkout'
  | 'login'
  | 'account'
  | 'account.passwordReset'
  | 'account.orderSuccess'
  | 'faq'
  | 'legal.imprint'
  | 'legal.privacy'
  | 'legal.cookies'
  | 'legal.termsRestaurant'
  | 'legal.termsVouchers'
  | 'legal.termsCatering'
  | 'legal.withdrawal'
  | 'legal.payment'
  | 'legal.foodInfo'
  | 'legal.disclaimer';

export interface RouteConfig {
  key: RouteKey;
  /** German path (no prefix) */
  de: string;
  /** English path slug (without /en prefix — prefix is added by helpers) */
  en: string;
  languages: ('de' | 'en')[];
  prerender?: boolean;
  priority?: number;
  changefreq?: 'weekly' | 'monthly' | 'yearly';
}

export const ROUTES: RouteConfig[] = [
  // Main pages
  { key: 'home', de: '/', en: '/', languages: ['de', 'en'], prerender: true, priority: 1.0, changefreq: 'weekly' },
  { key: 'contact', de: '/kontakt', en: '/contact', languages: ['de', 'en'], prerender: true, priority: 0.8, changefreq: 'monthly' },
  { key: 'events', de: '/events', en: '/events', languages: ['de', 'en'], prerender: true, priority: 0.9, changefreq: 'weekly' },

  // Catering pages
  { key: 'catering.fingerfood', de: '/catering/buffet-fingerfood', en: '/catering/finger-food-buffet', languages: ['de', 'en'], prerender: true, priority: 0.8, changefreq: 'weekly' },
  { key: 'catering.platters', de: '/catering/buffet-platten', en: '/catering/platters-sharing', languages: ['de', 'en'], prerender: true, priority: 0.8, changefreq: 'weekly' },
  { key: 'catering.casseroles', de: '/catering/buffet-auflauf', en: '/catering/hot-dishes', languages: ['de', 'en'], prerender: true, priority: 0.8, changefreq: 'weekly' },
  { key: 'catering.pizza', de: '/catering/pizze-napoletane', en: '/catering/pizza-napoletana', languages: ['de', 'en'], prerender: true, priority: 0.8, changefreq: 'weekly' },
  { key: 'catering.desserts', de: '/catering/desserts', en: '/catering/desserts', languages: ['de', 'en'], prerender: true, priority: 0.8, changefreq: 'weekly' },

  // FAQ
  { key: 'faq', de: '/faq-catering-muenchen', en: '/catering-faq-munich', languages: ['de', 'en'], prerender: true, priority: 0.7, changefreq: 'monthly' },

  // Checkout & Account (no prerender — dynamic/auth)
  { key: 'checkout', de: '/checkout', en: '/checkout', languages: ['de', 'en'], prerender: false },
  { key: 'login', de: '/login', en: '/login', languages: ['de', 'en'], prerender: false },
  { key: 'account', de: '/konto', en: '/account', languages: ['de', 'en'], prerender: false },
  { key: 'account.passwordReset', de: '/konto/passwort-reset', en: '/account/password-reset', languages: ['de', 'en'], prerender: false },
  { key: 'account.orderSuccess', de: '/konto/bestellung-erfolgreich', en: '/account/order-success', languages: ['de', 'en'], prerender: false },

  // Legal pages
  { key: 'legal.imprint', de: '/impressum', en: '/imprint', languages: ['de', 'en'], prerender: true, priority: 0.3, changefreq: 'yearly' },
  { key: 'legal.privacy', de: '/datenschutz', en: '/privacy', languages: ['de', 'en'], prerender: true, priority: 0.3, changefreq: 'yearly' },
  { key: 'legal.cookies', de: '/cookie-richtlinie', en: '/cookie-policy', languages: ['de', 'en'], prerender: true, priority: 0.2, changefreq: 'yearly' },
  { key: 'legal.termsCatering', de: '/agb-catering', en: '/catering-terms', languages: ['de', 'en'], prerender: true, priority: 0.3, changefreq: 'yearly' },
  { key: 'legal.termsRestaurant', de: '/agb-restaurant', en: '/restaurant-terms', languages: ['de', 'en'], prerender: true, priority: 0.3, changefreq: 'yearly' },
  { key: 'legal.termsVouchers', de: '/agb-gutscheine', en: '/voucher-terms', languages: ['de', 'en'], prerender: true, priority: 0.2, changefreq: 'yearly' },
  { key: 'legal.withdrawal', de: '/widerrufsbelehrung', en: '/cancellation-policy', languages: ['de', 'en'], prerender: true, priority: 0.3, changefreq: 'yearly' },
  { key: 'legal.payment', de: '/zahlungsinformationen', en: '/payment-information', languages: ['de', 'en'], prerender: true, priority: 0.2, changefreq: 'yearly' },
  { key: 'legal.foodInfo', de: '/lebensmittelhinweise', en: '/food-information', languages: ['de', 'en'], prerender: true, priority: 0.2, changefreq: 'yearly' },
  { key: 'legal.disclaimer', de: '/haftungsausschluss', en: '/disclaimer', languages: ['de', 'en'], prerender: true, priority: 0.2, changefreq: 'yearly' },
];

// --- Lookup Maps (built once) ---

const routeByKey = new Map<RouteKey, RouteConfig>();
const routeByDePath = new Map<string, RouteConfig>();
const routeByEnPath = new Map<string, RouteConfig>();

for (const route of ROUTES) {
  routeByKey.set(route.key, route);
  routeByDePath.set(route.de, route);
  routeByEnPath.set(route.en, route);
}

// --- Helper Functions ---

/** Get the full localized path for a route key */
export function getLocalizedPath(key: RouteKey, lang: 'de' | 'en'): string {
  const route = routeByKey.get(key);
  if (!route) return '/';
  if (lang === 'en') {
    return route.en === '/' ? '/en' : `/en${route.en}`;
  }
  return route.de;
}

/** Find route config by German path */
export function getRouteByDePath(dePath: string): RouteConfig | undefined {
  return routeByDePath.get(dePath);
}

/** Find route config by English path (without /en prefix) */
export function getRouteByEnPath(enPath: string): RouteConfig | undefined {
  return routeByEnPath.get(enPath);
}

/** Get the alternate language path for a given full path */
export function getAlternatePath(currentFullPath: string, currentLang: 'de' | 'en'): string {
  // Strip hash and query
  const [pathOnly] = currentFullPath.split(/[?#]/);

  if (currentLang === 'en') {
    // Remove /en prefix to get the EN slug, then find DE path
    const enSlug = pathOnly === '/en' ? '/' : pathOnly.replace(/^\/en/, '');
    const route = routeByEnPath.get(enSlug);
    return route ? route.de : '/';
  } else {
    // Find the EN path from DE path
    const route = routeByDePath.get(pathOnly);
    if (!route) return '/en';
    return route.en === '/' ? '/en' : `/en${route.en}`;
  }
}

/** Detect language from a pathname */
export function getLanguageFromPath(pathname: string): 'de' | 'en' {
  return pathname.startsWith('/en/') || pathname === '/en' ? 'en' : 'de';
}

/** Generate list of all prerender routes (DE + EN) */
export function getPrerenderRoutes(): string[] {
  const routes: string[] = [];
  for (const route of ROUTES) {
    if (!route.prerender) continue;
    if (route.languages.includes('de')) {
      routes.push(route.de);
    }
    if (route.languages.includes('en')) {
      routes.push(route.en === '/' ? '/en' : `/en${route.en}`);
    }
  }
  return routes;
}
