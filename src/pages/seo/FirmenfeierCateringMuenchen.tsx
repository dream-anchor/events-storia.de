import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import InternalLinks from "@/components/InternalLinks";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Users, ChefHat, Truck, ClipboardCheck, Star, Building2 } from "lucide-react";

const FirmenfeierCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Firmenfeier Catering München" : "Corporate Event Catering Munich",
      url: language === "de" ? "/firmenfeier-catering-muenchen" : "/en/corporate-event-catering-munich",
    },
  ];

  const faqItems = t.seo.firmenfeier.faq;

  return (
    <>
      <SEO
        title={t.seo.firmenfeier.title}
        description={t.seo.firmenfeier.description}
        keywords={
          language === "de"
            ? "Firmenfeier Catering München, Catering Firmenfeier, Business Event Catering, Firmenevent München, Team Event Catering"
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

          {/* Hero */}
          <section className="relative py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4 text-center">
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <Badge variant="secondary" className="text-sm">Business Events</Badge>
                <Badge variant="secondary" className="text-sm">5–200+ Gäste</Badge>
                <Badge variant="secondary" className="text-sm">München & Umland</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de" ? "Firmenfeier Catering in München" : "Corporate Event Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Italienisches Catering für unvergessliche Firmenfeiern – professionell geplant, frisch geliefert."
                  : "Italian catering for unforgettable corporate events – professionally planned, freshly delivered."}
              </p>
            </div>
          </section>

          {/* Main Content */}
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto">
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
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong><LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">Fingerfood & Häppchen</LocalizedLink></strong>{" "}
                        – Perfekt für Stehempfänge, Networking-Events und After-Work-Feiern</li>
                      <li><strong><LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">Platten & Sharing</LocalizedLink></strong>{" "}
                        – Ideal für Team-Meetings, Workshops und gesellige Runden</li>
                      <li><strong><LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">Warme Buffets</LocalizedLink></strong>{" "}
                        – Für Jubiläen, Sommerfeste und große Firmenevents</li>
                      <li><strong><LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">Pizza Catering</LocalizedLink></strong>{" "}
                        – Der Klassiker für lockere Team-Events und After-Work-Partys</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Beliebte Anlässe für Firmen-Catering
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Firmenjubiläen und Mitarbeiter-Events</li>
                      <li>Sommerfeste und Gartenfeiern</li>
                      <li>Kundenevents und Produktpräsentationen</li>
                      <li>Team-Building und Workshops</li>
                      <li><LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">Weihnachtsfeiern</LocalizedLink>{" "}und Jahresabschluss-Feiern</li>
                      <li>After-Work-Events und Empfänge</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Rundum-Sorglos-Service für Ihr Firmenevent
                    </h2>
                    <p>
                      STORIA Catering übernimmt auf Wunsch die komplette Organisation: Von der individuellen
                      Menüplanung über die Lieferung bis zum Aufbau am Veranstaltungsort. Auch Service-Personal
                      für Betreuung und Abbau stellen wir gerne bereit. So können Sie sich voll und ganz
                      auf Ihre Gäste konzentrieren.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Auch als Event im Restaurant
                    </h2>
                    <p>
                      Sie möchten Ihre Firmenfeier direkt in unserem Restaurant in der Maxvorstadt feiern? Unser{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">Ristorante STORIA</LocalizedLink>{" "}
                      bietet Platz für bis zu 70 Gäste im Innenbereich und bis zu 180 mit Terrasse – perfekt
                      für exklusive Firmenevents mit individuellem Menü.
                    </p>

                    <p>
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">Kontaktieren Sie uns</LocalizedLink>{" "}
                      für ein unverbindliches Angebot – wir beraten Sie gerne persönlich.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      A successful <strong>corporate event</strong> stands and falls with the catering. STORIA
                      offers professional <strong>catering for corporate events in Munich</strong> – from small
                      team events to large corporate functions with several hundred guests.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Catering Formats for Corporate Events
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong><LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">Finger Food & Canapés</LocalizedLink></strong>{" "}
                        – Perfect for standing receptions and networking events</li>
                      <li><strong><LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">Platters & Sharing</LocalizedLink></strong>{" "}
                        – Ideal for team meetings, workshops and social gatherings</li>
                      <li><strong><LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">Hot Buffets</LocalizedLink></strong>{" "}
                        – For anniversaries, summer parties and large corporate events</li>
                      <li><strong><LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">Pizza Catering</LocalizedLink></strong>{" "}
                        – The classic choice for casual team events</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Popular Occasions for Corporate Catering
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Company anniversaries and employee events</li>
                      <li>Summer parties and garden celebrations</li>
                      <li>Client events and product presentations</li>
                      <li>Team building and workshops</li>
                      <li><LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">Christmas parties</LocalizedLink>{" "}and year-end celebrations</li>
                      <li>After-work events and receptions</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Full-Service for Your Corporate Event
                    </h2>
                    <p>
                      On request, STORIA Catering takes care of the complete organisation: from menu planning
                      to delivery and setup. We also provide service staff for attendance and cleanup.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Events at Our Restaurant
                    </h2>
                    <p>
                      Host your corporate event at our{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">Ristorante STORIA</LocalizedLink>{" "}
                      in Maxvorstadt – up to 70 guests indoors, 180 with terrace.
                    </p>

                    <p>
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">Contact us</LocalizedLink>{" "}
                      for a non-binding quote.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* USP Grid */}
          <section className="py-16 md:py-20 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Warum STORIA für Ihre Firmenfeier?" : "Why STORIA for Your Corporate Event?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Star, title: language === "de" ? "15+ Jahre Erfahrung" : "15+ years experience", desc: language === "de" ? "Über 15 Jahre Erfahrung mit Firmenfeiern in München." : "Over 15 years of experience with corporate events in Munich." },
                  { icon: Users, title: language === "de" ? "5 bis 200+ Gäste" : "5 to 200+ guests", desc: language === "de" ? "Flexible Menüzusammenstellung für jede Gruppengröße." : "Flexible menu composition for any group size." },
                  { icon: ChefHat, title: language === "de" ? "Individuelle Menüs" : "Custom menus", desc: language === "de" ? "Persönliche Beratung und maßgeschneiderte Angebote." : "Personal consultation and tailored offers." },
                  { icon: ClipboardCheck, title: language === "de" ? "Komplett-Service" : "Full service", desc: language === "de" ? "Aufbau, Betreuung und Abbau — alles aus einer Hand." : "Setup, service and cleanup — all from one source." },
                  { icon: Truck, title: language === "de" ? "Lieferung überall hin" : "Delivery anywhere", desc: language === "de" ? "Ganz München und Umgebung — auch zu Ihrem Veranstaltungsort." : "Throughout Munich — including your event venue." },
                  { icon: Building2, title: language === "de" ? "Auch im Restaurant" : "Also at the restaurant", desc: language === "de" ? "Exklusive Events im Ristorante STORIA für bis zu 180 Gäste." : "Exclusive events at Ristorante STORIA for up to 180 guests." },
                ].map((usp, i) => (
                  <div key={i} className="text-center p-6">
                    <usp.icon className="h-8 w-8 mx-auto mb-4 text-primary" />
                    <h3 className="font-medium text-lg mb-2">{usp.title}</h3>
                    <p className="text-sm text-muted-foreground">{usp.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Perfekt für... */}
          <section className="py-16 md:py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Weitere Catering-Anlässe" : "More Catering Occasions"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Weihnachtsfeier" : "Christmas Party", desc: language === "de" ? "Festliche Menüs für den Jahresausklang" : "Festive menus to end the year", to: "seo.weihnachtsfeier" as const },
                  { title: language === "de" ? "Büro-Catering" : "Office Catering", desc: language === "de" ? "Regelmäßiger Business Lunch" : "Regular business lunch", to: "seo.bueroCatering" as const },
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Lockerer Klassiker für Team-Events" : "Casual classic for team events", to: "seo.pizzaCatering" as const },
                  { title: language === "de" ? "Alle Catering-Optionen" : "All Catering Options", desc: language === "de" ? "Unser komplettes Angebot" : "Our complete offering", to: "seo.italienischesCatering" as const },
                ].map((item, i) => (
                  <LocalizedLink key={i} to={item.to} className="group block p-6 rounded-2xl border bg-card hover:shadow-lg transition-all">
                    <h3 className="font-medium text-lg mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </LocalizedLink>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-8 text-center">
                {t.seo.firmenfeier.faqTitle}
              </h2>
              <div className="space-y-6">
                {faqItems.map((faq, i) => (
                  <div key={i} className="border-b border-border pb-6">
                    <h3 className="text-lg font-medium mb-2">{faq.question}</h3>
                    <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Ristorante Link */}
          <section className="bg-muted/50 border rounded-xl p-8 mb-8 text-center">
            <h2 className="text-xl font-semibold mb-3">
              {language === "de" ? "Oder lieber direkt im Restaurant feiern?" : "Or celebrate directly at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA in München Maxvorstadt bietet Firmenfeiern direkt im Restaurant – für 10 bis 180 Gäste, mit persönlichem Service der Familie Speranza."
                : "Ristorante STORIA in Munich Maxvorstadt offers corporate events at the restaurant – for 10 to 180 guests, with personal service."}
            </p>
            <a
              href="https://www.ristorantestoria.de/firmenfeier-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Firmenfeier im STORIA reservieren" : "→ Reserve a corporate event at STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <InternalLinks />
        <Footer />
      </div>
    </>
  );
};

export default FirmenfeierCateringMuenchen;
