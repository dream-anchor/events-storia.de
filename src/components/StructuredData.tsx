import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProductData {
  name: string;
  name_en?: string;
  description: string;
  description_en?: string;
  price: number;
  image?: string;
  sku?: string;
  servingInfo?: string;
}

interface StructuredDataProps {
  type?: 'restaurant' | 'menu' | 'faq' | 'breadcrumb' | 'event' | 'product' | 'localbusiness';
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqItems?: Array<{ question: string; answer: string }>;
  eventData?: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
  };
  products?: ProductData[];
}

const StructuredData = ({ type = 'restaurant', breadcrumbs, faqItems, eventData, products }: StructuredDataProps) => {
  const { language } = useLanguage();

  const baseBusinessInfo = {
    name: 'STORIA - Ristorante • Pizzeria • Bar',
    telephone: '+49-89-515196',
    email: 'info@events-storia.de',
    url: 'https://ristorantestoria.de',
    logo: 'https://ristorantestoria.de/storia-logo.webp',
    image: 'https://iieethejhwfsyzhbweps.supabase.co/storage/v1/object/public/menu-pdfs/og-image.jpg',
    priceRange: '€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Karlstraße 47a',
      addressLocality: 'München',
      postalCode: '80333',
      addressRegion: 'Bayern',
      addressCountry: 'DE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 48.1456,
      longitude: 11.5656,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '01:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday'],
        opens: '12:00',
        closes: '01:00',
      },
    ],
  };

  const aggregateRating = {
    '@type': 'AggregateRating',
    ratingValue: '4.5',
    reviewCount: '250',
    bestRating: '5',
    worstRating: '1',
  };

  const restaurantSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': 'https://ristorantestoria.de/#restaurant',
    ...baseBusinessInfo,
    alternateName: 'Ristorante STORIA',
    description: language === 'de' 
      ? 'Authentisches italienisches Restaurant in München mit frischer Pasta, Pizza aus dem Holzofen und erlesenen Weinen.'
      : 'Authentic Italian restaurant in Munich with fresh pasta, wood-fired pizza, and fine wines.',
    servesCuisine: ['Italian', 'Pizza', 'Pasta', 'Mediterranean'],
    acceptsReservations: 'True',
    hasMenu: 'https://ristorantestoria.de/speisekarte',
    sameAs: [
      'https://www.instagram.com/ristorante_storia/',
      'https://www.opentable.de/r/storia-ristorante-pizzeria-bar-munchen',
    ],
    founder: [
      { '@type': 'Person', name: 'Domenico Speranza', alternateName: 'Mimmo' },
      { '@type': 'Person', name: 'Nicola Speranza' },
    ],
    aggregateRating,
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://ristorantestoria.de/#website',
    name: 'STORIA - Ristorante • Pizzeria • Bar',
    url: 'https://ristorantestoria.de',
    publisher: { '@id': 'https://ristorantestoria.de/#restaurant' },
    inLanguage: ['de-DE', 'en-US'],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://ristorantestoria.de/#organization',
    name: 'Speranza GmbH',
    alternateName: ['STORIA Catering München', 'STORIA Events', 'Ristorante STORIA'],
    description: language === 'de'
      ? 'Authentisches italienisches Restaurant und Catering-Service in München. Seit über 15 Jahren servieren wir frische Pasta, Pizza aus dem Holzofen und erlesene Weine.'
      : 'Authentic Italian restaurant and catering service in Munich. For over 15 years, we have been serving fresh pasta, wood-fired pizza, and fine wines.',
    url: 'https://ristorantestoria.de',
    logo: {
      '@type': 'ImageObject',
      url: 'https://ristorantestoria.de/storia-logo.webp',
      width: 512,
      height: 256,
    },
    image: 'https://ristorantestoria.de/og-image.jpg',
    foundingDate: '2008',
    founders: [
      { '@type': 'Person', name: 'Domenico Speranza', alternateName: 'Mimmo' },
      { '@type': 'Person', name: 'Nicola Speranza' },
    ],
    sameAs: [
      'https://www.instagram.com/ristorante_storia/',
      'https://www.opentable.de/r/storia-ristorante-pizzeria-bar-munchen',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+49-89-515196',
        contactType: 'reservations',
        availableLanguage: ['German', 'English', 'Italian'],
      },
      {
        '@type': 'ContactPoint',
        telephone: '+49-89-51519696',
        contactType: 'customer service',
        availableLanguage: ['German', 'English', 'Italian'],
      },
    ],
    address: baseBusinessInfo.address,
    areaServed: {
      '@type': 'City',
      name: 'München',
    },
    knowsAbout: ['Italian cuisine', 'Catering', 'Pizza Napoletana', 'Corporate events', 'Private celebrations'],
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://ristorantestoria.de/#localbusiness',
    ...baseBusinessInfo,
  };

  // Enhanced LocalBusiness/CateringBusiness schema for location pages
  const cateringBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'CateringBusiness',
    '@id': 'https://ristorantestoria.de/#cateringbusiness',
    name: 'STORIA Catering München',
    alternateName: 'STORIA Events',
    description: language === 'de'
      ? 'Authentisches italienisches Catering für Events, Firmenveranstaltungen und private Feiern in München. Fingerfood, Platten, warme Gerichte und Pizza-Lieferservice.'
      : 'Authentic Italian catering for events, corporate functions and private celebrations in Munich. Finger food, platters, hot dishes and pizza delivery service.',
    ...baseBusinessInfo,
    servesCuisine: ['Italian', 'Pizza', 'Pasta', 'Mediterranean'],
    aggregateRating,
    areaServed: {
      '@type': 'City',
      name: 'München',
      '@id': 'https://www.wikidata.org/wiki/Q1726',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: language === 'de' ? 'Catering Angebote' : 'Catering Offers',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Fingerfood' },
        { '@type': 'OfferCatalog', name: 'Platten & Sharing' },
        { '@type': 'OfferCatalog', name: 'Warme Gerichte' },
        { '@type': 'OfferCatalog', name: 'Pizze Napoletane' },
      ],
    },
    paymentAccepted: ['Cash', 'Credit Card', 'Invoice'],
    currenciesAccepted: 'EUR',
  };

  const breadcrumbSchema = breadcrumbs ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://ristorantestoria.de${item.url}`,
    })),
  } : null;

  const faqSchema = faqItems ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null;

  const eventSchema = eventData ? {
    '@context': 'https://schema.org',
    '@type': 'FoodEvent',
    name: eventData.name,
    description: eventData.description,
    startDate: eventData.startDate,
    endDate: eventData.endDate,
    location: {
      '@type': 'Restaurant',
      name: 'STORIA - Ristorante • Pizzeria • Bar',
      address: baseBusinessInfo.address,
    },
    organizer: {
      '@type': 'Organization',
      name: 'Speranza GmbH',
      url: 'https://ristorantestoria.de',
    },
    offers: {
      '@type': 'Offer',
      url: 'https://ristorantestoria.de/reservierung',
      availability: 'https://schema.org/InStock',
    },
  } : null;

  // Product schema for catering items
  const productSchemas = products?.map((product, index) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `https://ristorantestoria.de/#product-${product.sku || index}`,
    name: language === 'en' && product.name_en ? product.name_en : product.name,
    description: language === 'en' && product.description_en ? product.description_en : product.description,
    image: product.image || 'https://ristorantestoria.de/og-image.jpg',
    brand: {
      '@type': 'Brand',
      name: 'STORIA Catering München',
    },
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'STORIA - Ristorante • Pizzeria • Bar',
      },
      priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    },
    aggregateRating,
  })) || [];

  return (
    <Helmet>
      {type === 'restaurant' && (
        <>
          <script type="application/ld+json">
            {JSON.stringify(restaurantSchema)}
          </script>
          <script type="application/ld+json">
            {JSON.stringify(localBusinessSchema)}
          </script>
          <script type="application/ld+json">
            {JSON.stringify(websiteSchema)}
          </script>
          <script type="application/ld+json">
            {JSON.stringify(organizationSchema)}
          </script>
        </>
      )}
      {type === 'localbusiness' && (
        <>
          <script type="application/ld+json">
            {JSON.stringify(cateringBusinessSchema)}
          </script>
          <script type="application/ld+json">
            {JSON.stringify(organizationSchema)}
          </script>
        </>
      )}
      {type === 'product' && productSchemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}
      {eventSchema && (
        <script type="application/ld+json">
          {JSON.stringify(eventSchema)}
        </script>
      )}
    </Helmet>
  );
};

export default StructuredData;
