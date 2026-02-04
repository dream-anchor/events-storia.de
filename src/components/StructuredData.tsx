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

interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

interface ServiceData {
  name: string;
  description: string;
  serviceType: string;
  areaServed?: string;
}

interface StructuredDataProps {
  type?: 'restaurant' | 'menu' | 'faq' | 'breadcrumb' | 'event' | 'product' | 'localbusiness' | 'service' | 'itemlist' | 'howto';
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqItems?: Array<{ question: string; answer: string }>;
  eventData?: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
  };
  products?: ProductData[];
  // NEW: Service schema for catering categories
  serviceData?: ServiceData;
  // NEW: HowTo schema for booking process
  howToSteps?: HowToStep[];
  howToName?: string;
  // NEW: ItemList name for menu categories
  itemListName?: string;
}

const StructuredData = ({
  type = 'restaurant',
  breadcrumbs,
  faqItems,
  eventData,
  products,
  serviceData,
  howToSteps,
  howToName,
  itemListName,
}: StructuredDataProps) => {
  const { language } = useLanguage();

  const baseBusinessInfo = {
    name: 'STORIA Catering & Events München',
    alternateName: ['STORIA Catering', 'STORIA Events', 'Ristorante STORIA'],
    telephone: '+49-89-54043770',
    email: 'info@events-storia.de',
    url: 'https://events-storia.de',
    logo: 'https://events-storia.de/storia-logo.webp',
    image: 'https://events-storia.de/og-image.jpg',
    priceRange: '€€-€€€',
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
      latitude: 48.1459,
      longitude: 11.5660,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '20:00',
        description: language === 'de' ? 'Catering-Bestellungen' : 'Catering orders',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday', 'Sunday'],
        opens: '10:00',
        closes: '18:00',
        description: language === 'de' ? 'Auf Anfrage' : 'On request',
      },
    ],
  };

  // Updated AggregateRating with current review data
  const aggregateRating = {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '890',
    bestRating: '5',
    worstRating: '1',
  };

  const restaurantSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': 'https://events-storia.de/#restaurant',
    ...baseBusinessInfo,
    description: language === 'de'
      ? 'STORIA Catering & Events München: Italienisches Fingerfood, Pizza, Buffets für Firmenfeiern, Weihnachtsfeiern und private Events. Frisch zubereitet aus der Maxvorstadt.'
      : 'STORIA Catering & Events Munich: Italian finger food, pizza, buffets for corporate parties, Christmas parties and private events. Freshly prepared from Maxvorstadt.',
    servesCuisine: ['Italian', 'Pizza Napoletana', 'Pasta', 'Mediterranean', 'Fingerfood'],
    acceptsReservations: 'True',
    hasMenu: 'https://events-storia.de/catering/buffet-fingerfood',
    sameAs: [
      'https://www.instagram.com/storia_ristorante/',
      'https://www.facebook.com/STORIAMunich',
    ],
    founder: [
      { '@type': 'Person', name: 'Domenico Speranza', alternateName: 'Mimmo' },
      { '@type': 'Person', name: 'Nicola Speranza' },
    ],
    aggregateRating,
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://events-storia.de/catering/buffet-fingerfood',
        actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'],
      },
      deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://events-storia.de/#website',
    name: 'STORIA Catering & Events München',
    url: 'https://events-storia.de',
    publisher: { '@id': 'https://events-storia.de/#organization' },
    inLanguage: ['de-DE', 'en-US'],
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://events-storia.de/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://events-storia.de/#organization',
    name: 'Speranza GmbH',
    legalName: 'Speranza GmbH',
    alternateName: ['STORIA Catering München', 'STORIA Events', 'STORIA Catering'],
    description: language === 'de'
      ? 'Italienisches Catering & Eventservice aus München Maxvorstadt. Seit 2008 servieren wir Fingerfood, Pizza, Buffets für Firmenfeiern, Weihnachtsfeiern und private Events.'
      : 'Italian catering & event service from Munich Maxvorstadt. Since 2008, we have been serving finger food, pizza, buffets for corporate parties, Christmas parties and private events.',
    url: 'https://events-storia.de',
    logo: {
      '@type': 'ImageObject',
      url: 'https://events-storia.de/storia-logo.webp',
      width: 512,
      height: 256,
    },
    image: 'https://events-storia.de/og-image.jpg',
    foundingDate: '2008',
    foundingLocation: {
      '@type': 'Place',
      name: 'München, Bayern, Deutschland',
    },
    founders: [
      { '@type': 'Person', name: 'Domenico Speranza', alternateName: 'Mimmo' },
      { '@type': 'Person', name: 'Nicola Speranza' },
    ],
    sameAs: [
      'https://www.instagram.com/storia_ristorante/',
      'https://www.facebook.com/STORIAMunich',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+49-89-54043770',
        contactType: 'customer service',
        availableLanguage: ['German', 'English', 'Italian'],
        areaServed: 'DE',
      },
      {
        '@type': 'ContactPoint',
        email: 'info@events-storia.de',
        contactType: 'sales',
        availableLanguage: ['German', 'English', 'Italian'],
      },
    ],
    address: baseBusinessInfo.address,
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: baseBusinessInfo.geo,
      geoRadius: '50000',
    },
    knowsAbout: [
      'Italian catering',
      'Corporate events',
      'Christmas party catering',
      'Pizza Napoletana',
      'Fingerfood',
      'Business catering Munich',
      'Event location Munich',
    ],
    slogan: language === 'de' ? 'Italienisches Catering mit Leidenschaft' : 'Italian catering with passion',
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://events-storia.de/#localbusiness',
    ...baseBusinessInfo,
    aggregateRating,
  };

  // Enhanced LocalBusiness/CateringBusiness schema for location pages
  const cateringBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'CateringBusiness',
    '@id': 'https://events-storia.de/#cateringbusiness',
    name: 'STORIA Catering München',
    alternateName: 'STORIA Events',
    description: language === 'de'
      ? 'Italienisches Catering für Firmenfeiern, Weihnachtsfeiern und Events in München. Fingerfood, Pizza, Buffets – frisch zubereitet und flexibel geliefert. Kapazität: bis zu 200 Gäste.'
      : 'Italian catering for corporate parties, Christmas parties and events in Munich. Finger food, pizza, buffets – freshly prepared and flexibly delivered. Capacity: up to 200 guests.',
    ...baseBusinessInfo,
    servesCuisine: ['Italian', 'Pizza Napoletana', 'Pasta', 'Mediterranean', 'Fingerfood'],
    aggregateRating,
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: baseBusinessInfo.geo,
      geoRadius: '50000',
      description: language === 'de' ? 'München und 50km Umkreis' : 'Munich and 50km radius',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: language === 'de' ? 'Catering Angebote' : 'Catering Offers',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'Fingerfood Catering', description: language === 'de' ? 'Italienische Häppchen für Empfänge' : 'Italian finger food for receptions' },
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'Pizza Catering', description: language === 'de' ? 'Neapolitanische Pizza für Events' : 'Neapolitan pizza for events' },
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'Buffet Catering', description: language === 'de' ? 'Warme Gerichte und Platten' : 'Hot dishes and platters' },
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'Event Catering', description: language === 'de' ? 'Komplettservice für Firmenfeiern' : 'Full service for corporate events' },
        },
      ],
    },
    paymentAccepted: ['Cash', 'Credit Card', 'Debit Card', 'Invoice', 'Bank Transfer'],
    currenciesAccepted: 'EUR',
    priceRange: '€€-€€€',
    deliveryChargeSpecification: {
      '@type': 'DeliveryChargeSpecification',
      appliesToDeliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
      eligibleRegion: {
        '@type': 'GeoCircle',
        geoMidpoint: baseBusinessInfo.geo,
        geoRadius: '1000',
      },
      price: '0',
      priceCurrency: 'EUR',
      description: language === 'de' ? 'Kostenlose Lieferung innerhalb 1km ab 50€' : 'Free delivery within 1km from €50',
    },
  };

  // NEW: Service schema for catering categories
  const serviceSchema = serviceData ? {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `https://events-storia.de/#service-${serviceData.serviceType.toLowerCase().replace(/\s+/g, '-')}`,
    name: serviceData.name,
    description: serviceData.description,
    serviceType: serviceData.serviceType,
    provider: { '@id': 'https://events-storia.de/#organization' },
    areaServed: {
      '@type': 'City',
      name: serviceData.areaServed || 'München',
    },
    brand: {
      '@type': 'Brand',
      name: 'STORIA Catering',
    },
    aggregateRating,
  } : null;

  // NEW: HowTo schema for booking process
  const howToSchema = howToSteps && howToSteps.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': 'https://events-storia.de/#howto-booking',
    name: howToName || (language === 'de' ? 'Event bei STORIA buchen' : 'Book an event at STORIA'),
    description: language === 'de'
      ? 'So einfach buchen Sie Ihr Catering oder Event bei STORIA München'
      : 'How to easily book your catering or event at STORIA Munich',
    totalTime: 'P1D',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'EUR',
      minValue: 50,
      description: language === 'de' ? 'Mindestbestellwert' : 'Minimum order value',
    },
    step: howToSteps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
    })),
  } : null;

  // NEW: ItemList schema for menu categories
  const itemListSchema = products && products.length > 0 && (type === 'itemlist' || type === 'product') ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `https://events-storia.de/#itemlist-${(itemListName || 'products').toLowerCase().replace(/\s+/g, '-')}`,
    name: itemListName || (language === 'de' ? 'Catering Auswahl' : 'Catering Selection'),
    description: language === 'de'
      ? 'Unsere Auswahl an italienischen Catering-Gerichten'
      : 'Our selection of Italian catering dishes',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        '@id': `https://events-storia.de/#product-${product.sku || index}`,
        name: language === 'en' && product.name_en ? product.name_en : product.name,
        description: language === 'en' && product.description_en ? product.description_en : product.description,
        image: product.image || 'https://events-storia.de/og-image.jpg',
        brand: { '@type': 'Brand', name: 'STORIA Catering' },
        offers: {
          '@type': 'Offer',
          price: product.price.toFixed(2),
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          seller: { '@id': 'https://events-storia.de/#organization' },
        },
      },
    })),
  } : null;

  const breadcrumbSchema = breadcrumbs ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://events-storia.de${item.url}`,
    })),
  } : null;

  // Generate FAQPage schema when faqItems are provided
  // Now supports multiple FAQ schemas per page (unique @id per page)
  const faqSchema = faqItems && faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `https://events-storia.de/#faq-${type}`,
    mainEntity: faqItems.map((item, index) => ({
      '@type': 'Question',
      '@id': `https://events-storia.de/#faq-${type}-q${index + 1}`,
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
      name: 'STORIA Catering & Events München',
      address: baseBusinessInfo.address,
      geo: baseBusinessInfo.geo,
    },
    organizer: {
      '@type': 'Organization',
      name: 'Speranza GmbH',
      url: 'https://events-storia.de',
    },
    offers: {
      '@type': 'Offer',
      url: 'https://events-storia.de/events',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'EUR',
    },
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  } : null;

  // Product schema for catering items (individual products)
  const productSchemas = products?.map((product, index) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `https://events-storia.de/#product-${product.sku || index}`,
    name: language === 'en' && product.name_en ? product.name_en : product.name,
    description: language === 'en' && product.description_en ? product.description_en : product.description,
    image: product.image || 'https://events-storia.de/og-image.jpg',
    brand: {
      '@type': 'Brand',
      name: 'STORIA Catering',
    },
    category: language === 'de' ? 'Italienisches Catering' : 'Italian Catering',
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      seller: { '@id': 'https://events-storia.de/#organization' },
      priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      deliveryLeadTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 3,
        unitCode: 'DAY',
      },
    },
    aggregateRating,
    ...(product.servingInfo && { additionalProperty: { '@type': 'PropertyValue', name: 'Serving Info', value: product.servingInfo } }),
  })) || [];

  // Build a single @graph array to prevent duplicate schema issues
  const buildSchemaGraph = () => {
    const schemas: object[] = [];

    if (type === 'restaurant') {
      // Remove @context from individual schemas when using @graph
      const { '@context': _rc, ...restaurantWithoutContext } = restaurantSchema;
      const { '@context': _lc, ...localBusinessWithoutContext } = localBusinessSchema;
      const { '@context': _wc, ...websiteWithoutContext } = websiteSchema;
      const { '@context': _oc, ...organizationWithoutContext } = organizationSchema;

      schemas.push(restaurantWithoutContext, localBusinessWithoutContext, websiteWithoutContext, organizationWithoutContext);
    }

    if (type === 'localbusiness') {
      const { '@context': _cc, ...cateringWithoutContext } = cateringBusinessSchema;
      const { '@context': _oc, ...organizationWithoutContext } = organizationSchema;
      schemas.push(cateringWithoutContext, organizationWithoutContext);
    }

    // NEW: Service schema
    if (type === 'service' && serviceSchema) {
      const { '@context': _sc, ...serviceWithoutContext } = serviceSchema;
      const { '@context': _oc, ...organizationWithoutContext } = organizationSchema;
      schemas.push(serviceWithoutContext, organizationWithoutContext);
    }

    // NEW: HowTo schema
    if (howToSchema) {
      const { '@context': _hc, ...howToWithoutContext } = howToSchema;
      schemas.push(howToWithoutContext);
    }

    // NEW: ItemList schema
    if (itemListSchema) {
      const { '@context': _ilc, ...itemListWithoutContext } = itemListSchema;
      schemas.push(itemListWithoutContext);
    }

    if (breadcrumbSchema) {
      const { '@context': _bc, ...breadcrumbWithoutContext } = breadcrumbSchema;
      schemas.push(breadcrumbWithoutContext);
    }

    // Add FAQPage when faqSchema exists
    if (faqSchema) {
      const { '@context': _fc, ...faqWithoutContext } = faqSchema;
      schemas.push(faqWithoutContext);
    }

    if (eventSchema) {
      const { '@context': _ec, ...eventWithoutContext } = eventSchema;
      schemas.push(eventWithoutContext);
    }

    return schemas;
  };

  const graphSchemas = buildSchemaGraph();

  // Create single consolidated schema with @graph
  const consolidatedSchema = graphSchemas.length > 0 ? {
    '@context': 'https://schema.org',
    '@graph': graphSchemas,
  } : null;

  return (
    <Helmet>
      {/* Single consolidated schema for restaurant, localbusiness, service, howto, itemlist, faq, breadcrumb, event */}
      {consolidatedSchema && (
        <script type="application/ld+json">
          {JSON.stringify(consolidatedSchema)}
        </script>
      )}
      {/* Product schemas remain separate as they may be numerous (only when type is explicitly 'product') */}
      {type === 'product' && productSchemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default StructuredData;
