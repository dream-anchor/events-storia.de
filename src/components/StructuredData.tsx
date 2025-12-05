import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';

interface StructuredDataProps {
  type?: 'restaurant' | 'menu' | 'faq' | 'breadcrumb' | 'event';
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqItems?: Array<{ question: string; answer: string }>;
  eventData?: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
  };
}

const StructuredData = ({ type = 'restaurant', breadcrumbs, faqItems, eventData }: StructuredDataProps) => {
  const { language } = useLanguage();

  const restaurantSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': 'https://ristorantestoria.de/#restaurant',
    name: 'STORIA - Ristorante • Pizzeria • Bar',
    alternateName: 'Ristorante STORIA',
    description: language === 'de' 
      ? 'Authentisches italienisches Restaurant in München mit frischer Pasta, Pizza aus dem Holzofen und erlesenen Weinen.'
      : 'Authentic Italian restaurant in Munich with fresh pasta, wood-fired pizza, and fine wines.',
    url: 'https://ristorantestoria.de',
    telephone: '+49-89-515196',
    email: 'info@ristorantestoria.de',
    image: [
      'https://iieethejhwfsyzhbweps.supabase.co/storage/v1/object/public/menu-pdfs/og-image.jpg',
    ],
    logo: 'https://ristorantestoria.de/storia-logo.webp',
    priceRange: '€€',
    servesCuisine: ['Italian', 'Pizza', 'Pasta', 'Mediterranean'],
    acceptsReservations: 'True',
    hasMenu: 'https://ristorantestoria.de/speisekarte',
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
    sameAs: [
      'https://www.instagram.com/ristorante_storia/',
      'https://www.opentable.de/r/storia-ristorante-pizzeria-bar-munchen',
    ],
    founder: [
      {
        '@type': 'Person',
        name: 'Domenico Speranza',
        alternateName: 'Mimmo',
      },
      {
        '@type': 'Person',
        name: 'Nicola Speranza',
      },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: '250',
      bestRating: '5',
      worstRating: '1',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://ristorantestoria.de/#website',
    name: 'STORIA - Ristorante • Pizzeria • Bar',
    url: 'https://ristorantestoria.de',
    publisher: {
      '@id': 'https://ristorantestoria.de/#restaurant',
    },
    inLanguage: ['de-DE', 'en-US'],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://ristorantestoria.de/#organization',
    name: 'Speranza GmbH',
    url: 'https://ristorantestoria.de',
    logo: 'https://ristorantestoria.de/storia-logo.webp',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+49-89-515196',
      contactType: 'reservations',
      availableLanguage: ['German', 'English', 'Italian'],
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Karlstraße 47a',
      addressLocality: 'München',
      postalCode: '80333',
      addressRegion: 'Bayern',
      addressCountry: 'DE',
    },
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

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://ristorantestoria.de/#localbusiness',
    name: 'STORIA - Ristorante • Pizzeria • Bar',
    image: 'https://iieethejhwfsyzhbweps.supabase.co/storage/v1/object/public/menu-pdfs/og-image.jpg',
    telephone: '+49-89-515196',
    email: 'info@ristorantestoria.de',
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
    url: 'https://ristorantestoria.de',
    openingHoursSpecification: restaurantSchema.openingHoursSpecification,
    priceRange: '€€',
  };

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
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Karlstraße 47a',
        addressLocality: 'München',
        postalCode: '80333',
        addressCountry: 'DE',
      },
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
