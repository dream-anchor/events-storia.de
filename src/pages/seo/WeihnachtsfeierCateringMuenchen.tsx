import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";

const WeihnachtsfeierCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Weihnachtsfeier Catering München" : "Christmas Party Catering Munich",
      url: language === "de" ? "/weihnachtsfeier-catering-muenchen" : "/en/christmas-party-catering-munich",
    },
  ];

  const faqItems =
    language === "de"
      ? [
          {
            question: "Wann sollte ich Weihnachtsfeier-Catering buchen?",
            answer:
              "Wir empfehlen, Weihnachtsfeier-Catering mindestens 3–4 Wochen im Voraus zu buchen. Beliebte Termine im Dezember sind schnell vergriffen – je früher Sie anfragen, desto besser können wir Ihren Wunschtermin garantieren.",
          },
          {
            question: "Gibt es spezielle Weihnachtsmenüs?",
            answer:
              "Ja, wir bieten spezielle festliche Menüs für die Weihnachtszeit: Von klassischem italienischem Weihnachtsessen mit Fisch und Meeresfrüchten bis zu winterlichen Buffets mit Trüffel, Steinpilzen und mehr.",
          },
          {
            question: "Kann die Weihnachtsfeier auch im Restaurant stattfinden?",
            answer:
              "Selbstverständlich! Unser Ristorante STORIA in der Maxvorstadt bietet Platz für bis zu 70 Gäste und lässt sich weihnachtlich dekorieren. Fragen Sie nach unseren Event-Paketen.",
          },
        ]
      : [
          {
            question: "When should I book Christmas party catering?",
            answer:
              "We recommend booking Christmas party catering at least 3–4 weeks in advance. Popular dates in December are quickly taken – the earlier you inquire, the better we can guarantee your preferred date.",
          },
          {
            question: "Are there special Christmas menus?",
            answer:
              "Yes, we offer special festive menus for the Christmas season: from classic Italian Christmas dinner with fish and seafood to winter buffets with truffle, porcini mushrooms and more.",
          },
          {
            question: "Can the Christmas party also take place at the restaurant?",
            answer:
              "Of course! Our Ristorante STORIA in Maxvorstadt accommodates up to 70 guests and can be decorated for Christmas. Ask about our event packages.",
          },
        ];

  return (
    <>
      <SEO
        title={t.seo.weihnachtsfeier.title}
        description={t.seo.weihnachtsfeier.description}
        keywords={
          language === "de"
            ? "Weihnachtsfeier Catering München, Weihnachtsessen Firma München, Firmen-Weihnachtsfeier Catering, Weihnachtsmenü München"
            : "Christmas party catering Munich, corporate Christmas dinner Munich, festive catering Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Weihnachtsfeier Catering München" : "Christmas Party Catering Munich",
          description:
            language === "de"
              ? "Festliches italienisches Catering für Weihnachtsfeiern und Jahresabschluss-Events in München."
              : "Festive Italian catering for Christmas parties and year-end events in Munich.",
          serviceType: "Christmas Party Catering",
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
                  ? "Weihnachtsfeier Catering in München"
                  : "Christmas Party Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                {language === "de"
                  ? "Festliche italienische Menüs für unvergessliche Weihnachtsfeiern – im Büro, zu Hause oder im Restaurant."
                  : "Festive Italian menus for unforgettable Christmas parties – at the office, at home or at the restaurant."}
              </p>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <p>
                      Die <strong>Weihnachtsfeier</strong> ist das Highlight des Jahres – und verdient ein
                      Catering, das genauso besonders ist. STORIA bietet Ihnen{" "}
                      <strong>festliches Catering für Weihnachtsfeiern in München</strong>: authentische
                      italienische Küche, sorgfältig zubereitet und stimmungsvoll serviert. Ob für das Team
                      im Büro oder die große Firmenfeier mit Kunden – wir machen Ihre Weihnachtsfeier
                      kulinarisch unvergesslich.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Festliche Menü-Optionen
                    </h2>
                    <p>
                      Für die Weihnachtszeit stellen wir spezielle Menüs zusammen, die die Magie der
                      italienischen Feiertags-Küche einfangen:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <strong>Festliches Fingerfood</strong> – Bruschette mit Trüffel, Garnelen-Häppchen
                        und winterliche Arancini als{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                          eleganter Stehempfang
                        </LocalizedLink>
                      </li>
                      <li>
                        <strong>Antipasti-Platten</strong> – Feierliche{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                          Sharing-Platten
                        </LocalizedLink>{" "}
                        mit Parmaschinken, Burrata, mariniertem Gemüse und Focaccia
                      </li>
                      <li>
                        <strong>Warmes Weihnachtsbuffet</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                          Lasagne, Ossobuco, Risotto mit Steinpilzen
                        </LocalizedLink>{" "}
                        und weitere Winterspezialitäten
                      </li>
                      <li>
                        <strong>Dessert-Highlights</strong> – Hausgemachtes{" "}
                        <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                          Tiramisù, Panna Cotta und Pistazien-Törtchen
                        </LocalizedLink>
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Weihnachtsfeier im Restaurant oder als Catering
                    </h2>
                    <p>
                      Sie haben die Wahl: Feiern Sie Ihre Weihnachtsfeier direkt in unserem{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">
                        Ristorante STORIA in der Maxvorstadt
                      </LocalizedLink>{" "}
                      mit bis zu 70 Gästen, oder wir liefern unser festliches Catering an Ihren
                      Wunschort – ins Büro, in eine Eventlocation oder nach Hause.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Warum STORIA für Ihre Weihnachtsfeier?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Über 15 Jahre Erfahrung mit Firmen-Weihnachtsfeiern in München</li>
                      <li>Individuelle Menüplanung passend zu Budget und Gästezahl</li>
                      <li>Spezielle winterliche und festliche Gerichte</li>
                      <li>Komplett-Service mit Aufbau, Betreuung und Abbau möglich</li>
                      <li>Flexible Termine auch kurzfristig (nach Verfügbarkeit)</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Jetzt frühzeitig buchen
                    </h2>
                    <p>
                      Die Weihnachtszeit ist unsere geschäftigste Saison. Sichern Sie sich Ihren
                      Wunschtermin und{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      frühzeitig für Ihre Weihnachtsfeier. Wir beraten Sie gerne und erstellen Ihnen
                      ein unverbindliches Angebot.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      The <strong>Christmas party</strong> is the highlight of the year – and deserves catering
                      that is just as special. STORIA offers{" "}
                      <strong>festive catering for Christmas parties in Munich</strong>: authentic Italian
                      cuisine, carefully prepared and atmospherically served. Whether for the team at the
                      office or a large corporate celebration with clients – we make your Christmas party
                      culinarily unforgettable.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Festive Menu Options
                    </h2>
                    <p>
                      For the Christmas season, we put together special menus that capture the magic of
                      Italian holiday cuisine:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <strong>Festive Finger Food</strong> – Truffle bruschetta, prawn canapés and winter
                        arancini as an{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                          elegant standing reception
                        </LocalizedLink>
                      </li>
                      <li>
                        <strong>Antipasti Platters</strong> – Festive{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                          sharing platters
                        </LocalizedLink>{" "}
                        with Parma ham, burrata, marinated vegetables and focaccia
                      </li>
                      <li>
                        <strong>Warm Christmas Buffet</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                          Lasagna, ossobuco, porcini risotto
                        </LocalizedLink>{" "}
                        and more winter specialities
                      </li>
                      <li>
                        <strong>Dessert Highlights</strong> – Homemade{" "}
                        <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                          tiramisù, panna cotta and pistachio tartlets
                        </LocalizedLink>
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Christmas Party at the Restaurant or as Catering
                    </h2>
                    <p>
                      You have the choice: celebrate your Christmas party directly at our{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">
                        Ristorante STORIA in Maxvorstadt
                      </LocalizedLink>{" "}
                      with up to 70 guests, or we deliver our festive catering to your preferred
                      location – to the office, an event venue or your home.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Why STORIA for Your Christmas Party?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Over 15 years of experience with corporate Christmas parties in Munich</li>
                      <li>Individual menu planning tailored to budget and guest count</li>
                      <li>Special winter and festive dishes</li>
                      <li>Full service with setup, attendance and cleanup available</li>
                      <li>Flexible dates, even at short notice (subject to availability)</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Book Early
                    </h2>
                    <p>
                      The Christmas season is our busiest time. Secure your preferred date and{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        contact us
                      </LocalizedLink>{" "}
                      early for your Christmas party. We are happy to advise you and create a
                      non-binding quote.
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

export default WeihnachtsfeierCateringMuenchen;
