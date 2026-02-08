import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";

const ItalienischesCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Italienisches Catering München" : "Italian Catering Munich",
      url: language === "de" ? "/italienisches-catering-muenchen" : "/en/italian-catering-munich",
    },
  ];

  const faqItems =
    language === "de"
      ? [
          {
            question: "Was kostet italienisches Catering in München?",
            answer:
              "Die Kosten für italienisches Catering variieren je nach Menüauswahl, Personenzahl und Umfang des Services. Fingerfood beginnt ab ca. 8 € pro Person, komplette Buffets ab ca. 25 € pro Person. Kontaktieren Sie uns für ein individuelles Angebot.",
          },
          {
            question: "Wie weit im Voraus sollte ich italienisches Catering bestellen?",
            answer:
              "Wir empfehlen eine Vorlaufzeit von mindestens 5–7 Werktagen. Für große Events oder an Feiertagen buchen Sie am besten 2–4 Wochen im Voraus.",
          },
          {
            question: "Bietet STORIA auch vegetarisches und veganes Catering an?",
            answer:
              "Ja, wir bieten eine große Auswahl an vegetarischen Gerichten wie Parmigiana, Caprese und vegetarischer Pizza. Vegane Optionen sind auf Anfrage ebenfalls verfügbar.",
          },
        ]
      : [
          {
            question: "How much does Italian catering cost in Munich?",
            answer:
              "Italian catering costs vary depending on menu selection, number of guests and scope of service. Finger food starts from approx. €8 per person, complete buffets from approx. €25 per person. Contact us for a customised quote.",
          },
          {
            question: "How far in advance should I order Italian catering?",
            answer:
              "We recommend a lead time of at least 5–7 working days. For large events or holidays, it's best to book 2–4 weeks in advance.",
          },
          {
            question: "Does STORIA also offer vegetarian and vegan catering?",
            answer:
              "Yes, we offer a wide selection of vegetarian dishes such as parmigiana, caprese and vegetarian pizza. Vegan options are also available on request.",
          },
        ];

  return (
    <>
      <SEO
        title={t.seo.italienischesCatering.title}
        description={t.seo.italienischesCatering.description}
        keywords={
          language === "de"
            ? "italienisches Catering München, Catering italienisch München, italienische Küche Catering, Catering Service München"
            : "Italian catering Munich, Italian cuisine catering, catering service Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Italienisches Catering München" : "Italian Catering Munich",
          description:
            language === "de"
              ? "Authentisches italienisches Catering für Events, Büro und Zuhause in München und Umgebung."
              : "Authentic Italian catering for events, office and home in Munich and surrounding areas.",
          serviceType: "Italian Catering Service",
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
                  ? "Italienisches Catering in München"
                  : "Italian Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                {language === "de"
                  ? "Authentische italienische Küche – frisch zubereitet und flexibel geliefert für Events, Büro und Zuhause."
                  : "Authentic Italian cuisine – freshly prepared and flexibly delivered for events, office and home."}
              </p>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <p>
                      Wenn Sie <strong>italienisches Catering in München</strong> suchen, sind Sie bei STORIA genau richtig.
                      Aus unserem Ristorante in der Maxvorstadt liefern wir authentische italienische Küche direkt zu
                      Ihrem Event, ins Büro oder nach Hause. Unsere Gerichte werden täglich frisch zubereitet – mit
                      hochwertigen Zutaten und traditionellen Rezepten aus Süditalien.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Unser Catering-Angebot für München
                    </h2>
                    <p>
                      STORIA Catering bietet Ihnen eine vielseitige Auswahl an italienischen Spezialitäten.
                      Von elegantem{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        Fingerfood
                      </LocalizedLink>{" "}
                      für Empfänge über{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Antipasti-Platten
                      </LocalizedLink>{" "}
                      für gesellige Runden bis hin zu{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        warmen Aufläufen und Pasta-Gerichten
                      </LocalizedLink>{" "}
                      für große Gruppen – wir haben für jeden Anlass das passende Menü.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Warum STORIA Catering?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Frisch zubereitete Gerichte aus unserer Küche in der Münchner Maxvorstadt</li>
                      <li>Authentische Rezepte aus Kampanien und Süditalien</li>
                      <li>Flexible Menüzusammenstellung für 5 bis 200+ Gäste</li>
                      <li>Zuverlässige Lieferung in ganz München und Umgebung</li>
                      <li>Professionelle Beratung und individuelle Angebote</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Für jeden Anlass das richtige Catering
                    </h2>
                    <p>
                      Ob{" "}
                      <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">
                        Firmenfeier
                      </LocalizedLink>
                      ,{" "}
                      <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">
                        Weihnachtsfeier
                      </LocalizedLink>
                      , Geburtstagsparty oder entspanntes Dinner mit Freunden – unser italienisches Catering
                      passt sich Ihrem Anlass an. Wir berücksichtigen Ihre Wünsche bezüglich Personenanzahl,
                      Budget und Speisevorlieben und erstellen Ihnen ein maßgeschneidertes Angebot.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Pizza, Pasta & mehr – direkt zu Ihnen geliefert
                    </h2>
                    <p>
                      Unsere{" "}
                      <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                        neapolitanische Pizza aus dem Steinofen
                      </LocalizedLink>{" "}
                      ist ein Highlight bei jedem Event. Dazu servieren wir hausgemachte Pasta, frische
                      Antipasti und{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        italienische Desserts wie Tiramisù
                      </LocalizedLink>
                      . Alles wird heiß und servierfertig geliefert, damit Sie und Ihre Gäste den Abend
                      in vollen Zügen genießen können.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Liefergebiet & Bestellung
                    </h2>
                    <p>
                      Wir liefern in ganz München und im Umkreis von ca. 50 km. Bestellen Sie bequem
                      online oder{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      telefonisch für eine persönliche Beratung. Seit Jahren vertrauen Münchner Unternehmen und
                      Privatpersonen auf unseren Catering-Service – für Momente, die in Erinnerung bleiben.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Looking for <strong>Italian catering in Munich</strong>? You've come to the right place at STORIA.
                      From our ristorante in Maxvorstadt, we deliver authentic Italian cuisine directly to your event,
                      office or home. Our dishes are freshly prepared daily – with high-quality ingredients and
                      traditional recipes from Southern Italy.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Catering Selection for Munich
                    </h2>
                    <p>
                      STORIA Catering offers a versatile selection of Italian specialities. From elegant{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        finger food
                      </LocalizedLink>{" "}
                      for receptions to{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        antipasti platters
                      </LocalizedLink>{" "}
                      for social gatherings to{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        hot casseroles and pasta dishes
                      </LocalizedLink>{" "}
                      for large groups – we have the right menu for every occasion.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Why Choose STORIA Catering?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Freshly prepared dishes from our kitchen in Munich's Maxvorstadt</li>
                      <li>Authentic recipes from Campania and Southern Italy</li>
                      <li>Flexible menu composition for 5 to 200+ guests</li>
                      <li>Reliable delivery throughout Munich and surrounding areas</li>
                      <li>Professional consultation and individual offers</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      The Right Catering for Every Occasion
                    </h2>
                    <p>
                      Whether{" "}
                      <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">
                        corporate event
                      </LocalizedLink>
                      ,{" "}
                      <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">
                        Christmas party
                      </LocalizedLink>
                      , birthday celebration or relaxed dinner with friends – our Italian catering adapts to your
                      occasion. We consider your wishes regarding guest count, budget and food preferences and
                      create a tailored offer for you.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Pizza, Pasta & More – Delivered to You
                    </h2>
                    <p>
                      Our{" "}
                      <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                        Neapolitan stone-oven pizza
                      </LocalizedLink>{" "}
                      is a highlight at every event. We also serve homemade pasta, fresh antipasti and{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        Italian desserts like tiramisù
                      </LocalizedLink>
                      . Everything is delivered hot and ready to serve, so you and your guests can fully enjoy
                      the evening.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Delivery Area & Ordering
                    </h2>
                    <p>
                      We deliver throughout Munich and within a radius of approx. 50 km. Order conveniently
                      online or{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        contact us
                      </LocalizedLink>{" "}
                      by phone for personal consultation. For years, Munich businesses and private clients have
                      trusted our catering service – for moments that create lasting memories.
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

export default ItalienischesCateringMuenchen;
