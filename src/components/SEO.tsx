import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAlternatePath, getRouteByDePath, getRouteByEnPath } from '@/config/routes';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'restaurant' | 'product';
  image?: string;
  noIndex?: boolean;
  // Content freshness signals for SEO
  publishedTime?: string;
  modifiedTime?: string;
  // Product/Service page enhancements
  price?: number;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  // Additional SEO fields
  keywords?: string;
  // i18n: Path to the alternate language version — auto-detected from route config if omitted
  alternateUrl?: string;
}

const SEO = ({
  title,
  description,
  canonical,
  type = 'website',
  image = 'https://events-storia.de/og-image.jpg',
  noIndex = false,
  publishedTime,
  modifiedTime,
  price,
  availability = 'InStock',
  keywords,
  alternateUrl,
}: SEOProps) => {
  const { language } = useLanguage();
  const location = useLocation();
  const baseUrl = 'https://events-storia.de';

  const siteTitle = 'STORIA – Italienisches Catering & Events München';
  const fullTitle = title ? `${title} | STORIA München` : siteTitle;

  const defaultDescription = language === 'de'
    ? 'STORIA Catering München: Italienisches Fingerfood, Pizza, Buffets & Events. Frisch zubereitet aus der Maxvorstadt. Firmenfeiern, Weihnachtsfeiern, Business-Events. Jetzt anfragen!'
    : 'STORIA Catering Munich: Italian finger food, pizza, buffets & events. Freshly prepared from Maxvorstadt. Corporate parties, Christmas parties, business events. Inquire now!';

  const defaultKeywords = language === 'de'
    ? 'Catering München, italienisches Catering, Fingerfood München, Pizza Catering, Firmenfeier München, Eventlocation Maxvorstadt'
    : 'Catering Munich, Italian catering, finger food Munich, pizza catering, corporate events Munich, event location Maxvorstadt';

  const metaDescription = description || defaultDescription;
  const metaKeywords = keywords || defaultKeywords;

  // Auto-detect canonical from current path if not explicitly provided
  const effectiveCanonical = canonical ?? location.pathname;
  const canonicalUrl = `${baseUrl}${effectiveCanonical}`;

  // Auto-detect alternateUrl from route config if not explicitly provided
  const effectiveAlternateUrl = alternateUrl ?? (() => {
    const pathOnly = location.pathname;
    if (language === 'en') {
      const enSlug = pathOnly === '/en' ? '/' : pathOnly.replace(/^\/en/, '');
      const route = getRouteByEnPath(enSlug);
      return route ? route.de : undefined;
    } else {
      const route = getRouteByDePath(pathOnly);
      if (!route) return undefined;
      return route.en === '/' ? '/en' : `/en${route.en}`;
    }
  })();

  const alternateLanguage = language === 'de' ? 'en' : 'de';
  // x-default always points to DE version
  const xDefaultUrl = language === 'de' ? canonicalUrl : (effectiveAlternateUrl ? `${baseUrl}${effectiveAlternateUrl}` : canonicalUrl);

  // Default to current date if no modifiedTime provided (signals fresh content)
  const effectiveModifiedTime = modifiedTime || new Date().toISOString().split('T')[0];

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <html lang={language} />
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      <meta name="author" content="STORIA Catering München" />
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}

      {/* Canonical & Language Alternates */}
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang={language} href={canonicalUrl} />
      {effectiveAlternateUrl && (
        <link rel="alternate" hrefLang={alternateLanguage} href={`${baseUrl}${effectiveAlternateUrl}`} />
      )}
      <link rel="alternate" hrefLang="x-default" href={xDefaultUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type === 'product' ? 'product' : type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:locale" content={language === 'de' ? 'de_DE' : 'en_US'} />
      <meta property="og:locale:alternate" content={language === 'de' ? 'en_US' : 'de_DE'} />
      <meta property="og:site_name" content="STORIA Catering" />

      {/* Content Freshness Signals (important for SEO & GEO) */}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      <meta property="article:modified_time" content={effectiveModifiedTime} />
      <meta property="og:updated_time" content={effectiveModifiedTime} />

      {/* Product Meta Tags (for catering service pages) */}
      {type === 'product' && price && (
        <>
          <meta property="product:price:amount" content={price.toString()} />
          <meta property="product:price:currency" content="EUR" />
          <meta property="product:availability" content={availability.toLowerCase()} />
          <meta property="product:brand" content="STORIA Catering" />
        </>
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={fullTitle} />
      <meta name="twitter:site" content="@STORIAMunich" />

      {/* Geo Tags (Local SEO) - Corrected coordinates */}
      <meta name="geo.region" content="DE-BY" />
      <meta name="geo.placename" content="München, Maxvorstadt" />
      <meta name="geo.position" content="48.1447;11.5628" />
      <meta name="ICBM" content="48.1447, 11.5628" />

      {/* Additional SEO Tags */}
      <meta name="rating" content="general" />
      <meta name="distribution" content="global" />
      <meta name="revisit-after" content="7 days" />
    </Helmet>
  );
};

export default SEO;
