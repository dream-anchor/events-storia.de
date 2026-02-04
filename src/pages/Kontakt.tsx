import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ConsentGoogleMaps from "@/components/ConsentGoogleMaps";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";

import { Phone, Mail, MapPin, Clock, Navigation as NavIcon, Car, Train } from "lucide-react";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Kontakt = () => {
  const { t, language } = useLanguage();

  // Local SEO FAQ items
  const localFaqItems = language === 'de' ? [
    {
      question: 'Wo liegt STORIA Catering in München?',
      answer: 'STORIA Catering befindet sich in der Karlstraße 47a, 80333 München, im Stadtteil Maxvorstadt. Der Standort ist 5 Minuten zu Fuß vom Königsplatz und 8 Minuten vom Hauptbahnhof München entfernt.'
    },
    {
      question: 'Wie erreiche ich STORIA mit öffentlichen Verkehrsmitteln?',
      answer: 'Mit der U-Bahn: U2/U8 Königsplatz (5 Min. Fußweg) oder U1/U2/U4/U5 Hauptbahnhof (8 Min. Fußweg). Mit der S-Bahn: Alle S-Bahn-Linien zum Hauptbahnhof München.'
    },
    {
      question: 'Gibt es Parkmöglichkeiten bei STORIA?',
      answer: 'Kostenpflichtige Parkplätze sind im Parkhaus Königsplatz (Luisenstraße) und in der Tiefgarage am Hauptbahnhof verfügbar. Straßenparkplätze sind in der Maxvorstadt begrenzt.'
    },
    {
      question: 'Kann ich Catering-Bestellungen abholen?',
      answer: 'Ja, Selbstabholung ist täglich während unserer Öffnungszeiten (Mo-Fr 9-1 Uhr, Sa-So 12-1 Uhr) in der Karlstraße 47a möglich. Bitte 30 Minuten vorher telefonisch bestätigen: +49 89 54043770.'
    }
  ] : [
    {
      question: 'Where is STORIA Catering located in Munich?',
      answer: 'STORIA Catering is located at Karlstraße 47a, 80333 Munich, in the Maxvorstadt district. The location is 5 minutes walk from Königsplatz and 8 minutes from Munich Central Station.'
    },
    {
      question: 'How can I reach STORIA by public transport?',
      answer: 'By subway: U2/U8 Königsplatz (5 min walk) or U1/U2/U4/U5 Central Station (8 min walk). By S-Bahn: All S-Bahn lines to Munich Central Station.'
    },
    {
      question: 'Is there parking available at STORIA?',
      answer: 'Paid parking is available at Königsplatz parking garage (Luisenstraße) and at the Central Station underground parking. Street parking in Maxvorstadt is limited.'
    },
    {
      question: 'Can I pick up catering orders myself?',
      answer: 'Yes, self-pickup is available daily during our opening hours (Mon-Fri 9am-1am, Sat-Sun 12pm-1am) at Karlstraße 47a. Please confirm by phone 30 minutes in advance: +49 89 54043770.'
    }
  ];

  return (
    <>
      <SEO
        title={language === 'de' ? 'Kontakt & Anfahrt – Catering München Maxvorstadt' : 'Contact & Directions – Catering Munich Maxvorstadt'}
        description={language === 'de'
          ? 'STORIA Catering München: Karlstraße 47a, Maxvorstadt. Nähe Hauptbahnhof, Königsplatz & TU München. Öffnungszeiten Mo-Fr 9-1 Uhr, Sa-So 12-1 Uhr. Jetzt anrufen: +49 89 54043770!'
          : 'STORIA Catering Munich: Karlstraße 47a, Maxvorstadt. Near main station, Königsplatz & TU Munich. Open Mon-Fri 9am-1am, Sat-Sun 12pm-1am. Call now: +49 89 54043770!'}
        canonical="/kontakt"
      />
      <StructuredData type="localbusiness" />
      <StructuredData
        type="breadcrumb"
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Kontakt' : 'Contact', url: '/kontakt' }
        ]}
      />
      <StructuredData type="faq" faqItems={localFaqItems} />

      <Header />
      <div className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-8 text-center">
          <Link to="/">
            <img src={storiaLogo} alt="STORIA – Italienisches Catering München Maxvorstadt" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
          </Link>
          <p className="text-lg text-muted-foreground tracking-wide">
            {t.hero.subtitle}
          </p>
        </div>
      </div>
      <Navigation />

      <div className="min-h-screen bg-background flex flex-col">
        <main className="container mx-auto px-4 py-12 flex-grow">

          {/* H1 with Local SEO Keywords */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">
            {language === 'de' ? 'Kontakt & Anfahrt – Catering München Maxvorstadt' : 'Contact & Directions – Catering Munich Maxvorstadt'}
          </h1>

          {/* Local Entity GEO-Clustering Intro */}
          <section
            aria-label={language === 'de' ? 'STORIA Catering Standort München Maxvorstadt' : 'STORIA Catering Location Munich Maxvorstadt'}
            data-geo-context="local-business-intro"
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <p className="text-lg text-muted-foreground" data-speakable="true">
              {language === 'de'
                ? 'STORIA Catering befindet sich in der Karlstraße 47a, im Herzen der Münchner Maxvorstadt. Nur 5 Gehminuten vom Königsplatz, 8 Minuten vom Hauptbahnhof München und direkt in der Nähe der TU München und LMU München. Ideale Lage für Business-Lunch, Firmen-Events und Catering-Abholung.'
                : 'STORIA Catering is located at Karlstraße 47a, in the heart of Munich\'s Maxvorstadt. Just 5 minutes walk from Königsplatz, 8 minutes from Munich Central Station and close to TU Munich and LMU Munich. Ideal location for business lunch, corporate events and catering pickup.'}
            </p>
          </section>

          {/* Contact Cards with Glassmorphism */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">

            {/* Contact Information Card - Glassmorphism */}
            <div
              className="relative backdrop-blur-md bg-card/80 dark:bg-card/60 border border-white/20 dark:border-white/10 rounded-2xl p-8 shadow-xl overflow-hidden"
              itemScope
              itemType="https://schema.org/LocalBusiness"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-2xl font-serif font-bold mb-6">{t.contact.contactUs}</h2>

                <div className="space-y-5">
                  {/* Phone - Consistent NAP */}
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{t.contact.phone}</p>
                      <a
                        href="tel:+498954043770"
                        itemProp="telephone"
                        aria-label={language === 'de' ? 'STORIA Catering München anrufen: +49 89 54043770' : 'Call STORIA Catering Munich: +49 89 54043770'}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        +49 89 54043770
                      </a>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{t.contact.email}</p>
                      <a
                        href="mailto:info@events-storia.de"
                        itemProp="email"
                        aria-label={language === 'de' ? 'E-Mail an STORIA Catering senden' : 'Send email to STORIA Catering'}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        info@events-storia.de
                      </a>
                    </div>
                  </div>

                  {/* Address - Semantic HTML */}
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{t.contact.address}</p>
                      <address
                        className="not-italic text-muted-foreground"
                        itemProp="address"
                        itemScope
                        itemType="https://schema.org/PostalAddress"
                      >
                        <span itemProp="streetAddress">Karlstraße 47a</span><br />
                        <span itemProp="postalCode">80333</span>{' '}
                        <span itemProp="addressLocality">München</span>
                        <meta itemProp="addressRegion" content="Bayern" />
                        <meta itemProp="addressCountry" content="DE" />
                      </address>
                      <p className="text-sm text-muted-foreground/70 mt-1 italic">
                        {language === 'de' ? 'Maxvorstadt – nahe Königsplatz & Hauptbahnhof' : 'Maxvorstadt – near Königsplatz & Central Station'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Opening Hours Card - Glassmorphism */}
            <div className="relative backdrop-blur-md bg-card/80 dark:bg-card/60 border border-white/20 dark:border-white/10 rounded-2xl p-8 shadow-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-2xl font-serif font-bold mb-6">{t.contact.openingHours}</h2>

                {/* Opening Hours as Definition List */}
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                  <dl
                    className="flex-1 space-y-2"
                    aria-label={language === 'de' ? 'Öffnungszeiten STORIA Catering München' : 'Opening hours STORIA Catering Munich'}
                  >
                    <div className="flex justify-between">
                      <dt className="font-medium">{t.contact.monFri}</dt>
                      <dd className="text-muted-foreground">09:00 – 01:00</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="font-medium">{t.contact.satSun}</dt>
                      <dd className="text-muted-foreground">12:00 – 01:00</dd>
                    </div>
                  </dl>
                </div>

                {/* Special Hours Info */}
                <div className="mt-6 space-y-3">
                  <div className="p-4 bg-secondary/50 backdrop-blur-sm rounded-xl">
                    <h3 className="font-semibold mb-1">{t.contact.breakfast}</h3>
                    <p className="text-sm text-muted-foreground">{t.contact.breakfastHours}</p>
                  </div>

                  <div className="p-4 bg-secondary/50 backdrop-blur-sm rounded-xl">
                    <h3 className="font-semibold mb-1">{t.contact.notturno}</h3>
                    <p className="text-sm text-muted-foreground">{t.contact.notturnoDesc}</p>
                    <p className="text-sm text-muted-foreground">{t.contact.notturnoHours}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transportation Info Section - Local SEO */}
          <section
            aria-label={language === 'de' ? 'Anfahrt zu STORIA München' : 'How to reach STORIA Munich'}
            data-geo-context="local-transportation"
            className="max-w-4xl mx-auto mb-12"
          >
            <h2 className="text-2xl font-serif font-bold mb-6 text-center">
              {language === 'de' ? 'Anfahrt & Parken' : 'Directions & Parking'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* U-Bahn */}
              <div className="relative backdrop-blur-md bg-card/60 border border-white/10 rounded-xl p-5 text-center">
                <Train className="h-8 w-8 text-primary mx-auto mb-3" aria-hidden="true" />
                <h3 className="font-semibold mb-2">{language === 'de' ? 'U-Bahn' : 'Subway'}</h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'de'
                    ? 'U2/U8 Königsplatz (5 Min.)\nU1/U2/U4/U5 Hauptbahnhof (8 Min.)'
                    : 'U2/U8 Königsplatz (5 min)\nU1/U2/U4/U5 Central Station (8 min)'}
                </p>
              </div>

              {/* S-Bahn */}
              <div className="relative backdrop-blur-md bg-card/60 border border-white/10 rounded-xl p-5 text-center">
                <NavIcon className="h-8 w-8 text-primary mx-auto mb-3" aria-hidden="true" />
                <h3 className="font-semibold mb-2">S-Bahn</h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'de'
                    ? 'Alle Linien zum Hauptbahnhof München'
                    : 'All lines to Munich Central Station'}
                </p>
              </div>

              {/* Parking */}
              <div className="relative backdrop-blur-md bg-card/60 border border-white/10 rounded-xl p-5 text-center">
                <Car className="h-8 w-8 text-primary mx-auto mb-3" aria-hidden="true" />
                <h3 className="font-semibold mb-2">{language === 'de' ? 'Parken' : 'Parking'}</h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'de'
                    ? 'Parkhaus Königsplatz\nTiefgarage Hauptbahnhof'
                    : 'Königsplatz Parking Garage\nCentral Station Underground'}
                </p>
              </div>
            </div>
          </section>

          {/* Google Maps */}
          <section
            id="map"
            className="max-w-4xl mx-auto mb-12"
            aria-label={language === 'de' ? 'STORIA Catering Standort auf Google Maps' : 'STORIA Catering location on Google Maps'}
          >
            <div className="relative backdrop-blur-md bg-card/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <ConsentGoogleMaps
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2662.063!2d11.5628!3d48.1447!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x479e75f0a0c3c6e7%3A0x8c0b2b0b0b0b0b0b!2sKarlstra%C3%9Fe%2047a%2C%2080333%20M%C3%BCnchen!5e0!3m2!1sde!2sde!4v1700000000000!5m2!1sde!2sde"
                height={400}
                title={language === 'de' ? 'STORIA Catering Standort München Maxvorstadt' : 'STORIA Catering Location Munich Maxvorstadt'}
                className="w-full"
              />
            </div>
          </section>

          {/* FAQ Section - Problem-Solution-Local Pattern */}
          <section
            aria-label={language === 'de' ? 'Häufige Fragen zu STORIA München' : 'Frequently Asked Questions about STORIA Munich'}
            data-geo-context="local-faq"
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-2xl font-serif font-bold mb-6 text-center">
              {language === 'de' ? 'Häufige Fragen zu STORIA München' : 'FAQ about STORIA Munich'}
            </h2>

            <div className="space-y-4">
              {localFaqItems.map((faq, index) => (
                <div
                  key={index}
                  className="relative backdrop-blur-md bg-card/60 border border-white/10 rounded-xl p-5"
                >
                  <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

        </main>

        <Footer />
      </div>
    </>
  );
};

export default Kontakt;
