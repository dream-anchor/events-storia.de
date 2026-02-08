import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";

const FirmenfeierCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Firmenfeier Catering München" : "Corporate Event Catering Munich",
      url: language === "de" ? "/firmenfeier-catering-muenchen" : "/en/corporate-event-catering-munich",
    },
  ];

  const faqItems =
    language === "de"
      ? [
          {
            question: "Ab wie vielen Personen kann ich Firmen-Catering bestellen?",
            answer:
              "Unser Catering für Firmenfeiern ist ab 5 Personen verfügbar. Für größere Events mit bis zu 200+ Gästen bieten wir spezielle Buffet- und Full-Service-Pakete an.",
          },
          {
            question: "Bietet STORIA auch Service-Personal für Firmenfeiern?",
            answer:
              "Ja, auf Wunsch stellen wir Service-Personal für den Aufbau, die Betreuung und den Abbau bereit. Sprechen Sie uns einfach bei Ihrer Anfrage darauf an.",
          },
          {
            question: "Kann ich das Menü für unsere Firmenfeier individuell zusammenstellen?",
            answer:
              "Selbstverständlich! Wir beraten Sie persönlich und stellen ein Menü zusammen, das perfekt zu Ihrem Event, Ihren Gästen und Ihrem Budget passt.",
          },
        ]
      : [
          {
            question: "From how many people can I order corporate catering?",
            answer:
              "Our corporate event catering is available from 5 people. For larger events with up to 200+ guests, we offer special buffet and full-service packages.",
          },
          {
            question: "Does STORIA also provide service staff for corporate events?",
            answer:
              "Yes, on request we provide service staff for setup, service and cleanup. Simply mention this when making your inquiry.",
          },
          {
            question: "Can I customise the menu for our corporate event?",
            answer:
              "Of course! We consult with you personally and put together a menu that perfectly suits your event, your guests and your budget.",
          },
        ];

  return (
    <>
      <SEO
        title={t.seo.firmenfeier.title}
        description={t.seo.firmenfeier.description}
        keywords={
          language === "de"
            ? "Firmenfeier Catering München, Catering Firmenfeier, Business Event Catering, Firmenevent München"
            : "corporate event catering Munich, business event catering, corporate party catering Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Firmenfeier Catering München" : "Corporate Event Catering Munich",
          description:
            language === "de"
              ? "Professionelles italienisches Catering für Firmenfeiern, Team-Events und Business-Veranstaltungen in München."
              : "Professional Italian catering for corporate events, team events and business functions in Munich.",
          serviceType: "Corporate Event Catering",
          areaServed: "München",
        }}
      />
      <Header />
      <Navigation />
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6 text-center">
                {language === "de"
                  ? "Firmenfeier Catering in München"
                  : "Corporate Event Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                {language === "de"
                  ? "Italienisches Catering für unvergessliche Firmenfeiern – professionell geplant, frisch geliefert."
                  : "Italian catering for unforgettable corporate events – professionally planned, freshly delivered."}
              </p>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <p>
                      Eine gelungene <strong>Firmenfeier</strong> steht und fällt mit dem Catering. STORIA
                      bietet Ihnen professionelles <strong>Catering für Firmenfeiern in München</strong> –
                      von kleinen Team-Events bis hin zu großen Firmenveranstaltungen mit mehreren hundert
                      Gästen. Unsere authentische italienische Küche sorgt für ein kulinarisches Erlebnis,
                      das Ihre Mitarbeiter und Geschäftspartner begeistert.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Unsere Catering-Formate für Firmenfeiern
                    </h2>
                    <p>
                      Je nach Art Ihres Events bieten wir verschiedene Catering-Formate an:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <strong>
                          <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                            Fingerfood & Häppchen
                          </LocalizedLink>
                        </strong>{" "}
                        – Perfekt für Stehempfänge, Networking-Events und After-Work-Feiern
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                            Platten & Sharing
                          </LocalizedLink>
                        </strong>{" "}
                        – Ideal für Team-Meetings, Workshops und gesellige Runden
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                            Warme Buffets
                          </LocalizedLink>
                        </strong>{" "}
                        – Für Jubiläen, Sommerfeste und große Firmenevents
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                            Pizza Catering
                          </LocalizedLink>
                        </strong>{" "}
                        – Der Klassiker für lockere Team-Events und After-Work-Partys
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Beliebte Anlässe für Firmen-Catering
                    </h2>
                    <p>
                      Unsere Münchner Geschäftskunden bestellen unser Catering für verschiedenste
                      Firmenanlässe:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Firmenjubiläen und Mitarbeiter-Events</li>
                      <li>Sommerfeste und Gartenfeiern</li>
                      <li>Kundenevents und Produktpräsentationen</li>
                      <li>Team-Building und Workshops</li>
                      <li>
                        <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">
                          Weihnachtsfeiern
                        </LocalizedLink>{" "}
                        und Jahresabschluss-Feiern
                      </li>
                      <li>After-Work-Events und Empfänge</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Rundum-Sorglos-Service für Ihr Firmenevent
                    </h2>
                    <p>
                      STORIA Catering übernimmt auf Wunsch die komplette Organisation Ihres
                      Firmen-Caterings: Von der individuellen Menüplanung über die Lieferung bis zum
                      Aufbau am Veranstaltungsort. So können Sie sich voll und ganz auf Ihre Gäste
                      konzentrieren.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Auch als Event im Restaurant
                    </h2>
                    <p>
                      Sie möchten Ihre Firmenfeier direkt in unserem Restaurant in der Maxvorstadt
                      feiern? Unser{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">
                        Ristorante STORIA
                      </LocalizedLink>{" "}
                      bietet Platz für bis zu 70 Gäste und eignet sich perfekt für exklusive
                      Firmenevents mit individuellem Menü.
                    </p>

                    <p>
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        Kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      für ein unverbindliches Angebot – wir beraten Sie gerne persönlich.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      A successful <strong>corporate event</strong> stands and falls with the catering. STORIA
                      offers professional <strong>catering for corporate events in Munich</strong> – from small
                      team events to large corporate functions with several hundred guests. Our authentic
                      Italian cuisine ensures a culinary experience that will delight your employees and
                      business partners.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Catering Formats for Corporate Events
                    </h2>
                    <p>
                      Depending on the type of your event, we offer various catering formats:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <strong>
                          <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                            Finger Food & Canapés
                          </LocalizedLink>
                        </strong>{" "}
                        – Perfect for standing receptions, networking events and after-work celebrations
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                            Platters & Sharing
                          </LocalizedLink>
                        </strong>{" "}
                        – Ideal for team meetings, workshops and social gatherings
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                            Hot Buffets
                          </LocalizedLink>
                        </strong>{" "}
                        – For anniversaries, summer parties and large corporate events
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                            Pizza Catering
                          </LocalizedLink>
                        </strong>{" "}
                        – The classic choice for casual team events and after-work parties
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Popular Occasions for Corporate Catering
                    </h2>
                    <p>
                      Our Munich business clients order our catering for a wide variety of corporate
                      occasions:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Company anniversaries and employee events</li>
                      <li>Summer parties and garden celebrations</li>
                      <li>Client events and product presentations</li>
                      <li>Team building and workshops</li>
                      <li>
                        <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">
                          Christmas parties
                        </LocalizedLink>{" "}
                        and year-end celebrations
                      </li>
                      <li>After-work events and receptions</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Full-Service for Your Corporate Event
                    </h2>
                    <p>
                      On request, STORIA Catering takes care of the complete organisation of your
                      corporate catering: from individual menu planning to delivery and setup at the
                      venue. So you can focus entirely on your guests.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Events at Our Restaurant
                    </h2>
                    <p>
                      Would you like to host your corporate event directly at our restaurant in
                      Maxvorstadt? Our{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">
                        Ristorante STORIA
                      </LocalizedLink>{" "}
                      accommodates up to 70 guests and is perfect for exclusive corporate events with
                      an individual menu.
                    </p>

                    <p>
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        Contact us
                      </LocalizedLink>{" "}
                      for a non-binding quote – we are happy to advise you personally.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default FirmenfeierCateringMuenchen;
