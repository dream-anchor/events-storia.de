import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'restaurant';
  image?: string;
  noIndex?: boolean;
}

const SEO = ({
  title,
  description,
  canonical,
  type = 'website',
  image = 'https://ristorantestoria.de/og-image.jpg',
  noIndex = false,
}: SEOProps) => {
  const { language } = useLanguage();
  const baseUrl = 'https://ristorantestoria.de';
  
  const siteTitle = 'STORIA – Italienisches Restaurant München Maxvorstadt';
  const fullTitle = title ? `${title} | STORIA München` : siteTitle;
  
  const defaultDescription = language === 'de' 
    ? 'STORIA – Ihr Italiener in der Maxvorstadt München. Neapolitanische Pizza aus dem Steinofen, frische Pasta & Aperitivo. Nähe Königsplatz & Hauptbahnhof. Jetzt Tisch reservieren!'
    : 'STORIA – Your Italian restaurant in Maxvorstadt Munich. Neapolitan stone-oven pizza, fresh pasta & aperitivo. Near Königsplatz & main station. Book your table now!';
  
  const metaDescription = description || defaultDescription;
  const canonicalUrl = canonical ? `${baseUrl}${canonical}` : baseUrl;
  const alternateLanguage = language === 'de' ? 'en' : 'de';

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <html lang={language} />
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="author" content="Ristorante STORIA" />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical & Language Alternates */}
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang={language} href={canonicalUrl} />
      <link rel="alternate" hrefLang={alternateLanguage} href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={language === 'de' ? 'de_DE' : 'en_US'} />
      <meta property="og:locale:alternate" content={language === 'de' ? 'en_US' : 'de_DE'} />
      <meta property="og:site_name" content="STORIA Ristorante" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />
      
      {/* Geo Tags */}
      <meta name="geo.region" content="DE-BY" />
      <meta name="geo.placename" content="München" />
      <meta name="geo.position" content="48.1456;11.5656" />
      <meta name="ICBM" content="48.1456, 11.5656" />
    </Helmet>
  );
};

export default SEO;
