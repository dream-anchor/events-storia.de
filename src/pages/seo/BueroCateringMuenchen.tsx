import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";

const BueroCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Büro Catering München" : "Office Catering Munich",
      url: language === "de" ? "/buero-catering-muenchen" : "/en/office-catering-munich",
    },
  ];

  const faqItems =
    language === "de"
      ? [
          {
            question: "Ab wie vielen Personen kann ich Büro-Catering bestellen?",
            answer:
              "Unser Büro-Catering ist ab 5 Personen verfügbar. Ideal für Team-Lunches, Meetings und Workshops. Sie können bequem online bestellen oder uns telefonisch kontaktieren.",
          },
          {
            question: "Wie kurzfristig kann ich Büro-Catering bestellen?",
            answer:
              "Für kleine Bestellungen (5–15 Personen) reicht oft ein Vorlauf von 1–2 Werktagen. Für größere Bestellungen empfehlen wir 3–5 Werktage Vorlaufzeit.",
          },
          {
            question: "Bietet STORIA auch regelmäßiges Büro-Catering an?",
            answer:
              "Ja, viele unserer Geschäftskunden bestellen regelmäßig – ob wöchentliches Team-Lunch oder monatliches Meeting-Catering. Sprechen Sie uns auf Sonderkonditionen für Stammkunden an.",
          },
        ]
      : [
          {
            question: "From how many people can I order office catering?",
            answer:
              "Our office catering is available from 5 people. Ideal for team lunches, meetings and workshops. You can order conveniently online or contact us by phone.",
          },
          {
            question: "How last-minute can I order office catering?",
            answer:
              "For small orders (5–15 people), 1–2 working days' notice is often sufficient. For larger orders, we recommend 3–5 working days' lead time.",
          },
          {
            question: "Does STORIA also offer regular office catering?",
            answer:
              "Yes, many of our business clients order regularly – whether weekly team lunch or monthly meeting catering. Ask us about special rates for regular customers.",
          },
        ];

  return (
    <>
      <SEO
        title={t.seo.bueroCatering.title}
        description={t.seo.bueroCatering.description}
        keywords={
          language === "de"
            ? "Büro Catering München, Office Catering München, Business Lunch München, Meeting Catering, Team Lunch München"
            : "office catering Munich, business lunch Munich, meeting catering Munich, team lunch Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Büro Catering München" : "Office Catering Munich",
          description:
            language === "de"
              ? "Italienisches Büro-Catering für Business Lunch, Team-Lunch und Meeting-Catering in München."
              : "Italian office catering for business lunch, team lunch and meeting catering in Munich.",
          serviceType: "Office Catering Service",
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
                  ? "Büro Catering in München"
                  : "Office Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                {language === "de"
                  ? "Italienischer Business Lunch, Team-Lunch und Meeting-Catering – frisch geliefert ins Büro."
                  : "Italian business lunch, team lunch and meeting catering – freshly delivered to your office."}
              </p>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <p>
                      Ein gutes Mittagessen stärkt das Team und macht den Arbeitstag produktiver. Mit
                      unserem <strong>Büro Catering in München</strong> bringen wir frische italienische
                      Küche direkt an Ihren Schreibtisch – unkompliziert, pünktlich und immer
                      servierbereit. Ob täglicher Business Lunch, wöchentlicher Team-Lunch oder Catering
                      für wichtige Meetings – STORIA ist Ihr zuverlässiger Partner.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Unsere Büro-Catering-Formate
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <strong>Team-Lunch</strong> –{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                          Sharing-Platten
                        </LocalizedLink>{" "}
                        mit Antipasti, Bruschette und Salaten für das gemeinsame Mittagessen
                      </li>
                      <li>
                        <strong>Meeting-Catering</strong> –{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                          Fingerfood und Häppchen
                        </LocalizedLink>{" "}
                        für Besprechungen, Workshops und Konferenzen
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                            Pizza-Lunch
                          </LocalizedLink>
                        </strong>{" "}
                        – Neapolitanische Steinofen-Pizza als beliebter Team-Klassiker
                      </li>
                      <li>
                        <strong>Warme Mahlzeiten</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                          Pasta, Aufläufe und warme Gerichte
                        </LocalizedLink>{" "}
                        für ein sättigendes Mittagessen
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Warum Büro-Catering von STORIA?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Frisch zubereitet in unserer Küche in der Maxvorstadt</li>
                      <li>Pünktliche Lieferung zur gewünschten Uhrzeit</li>
                      <li>Ab 5 Personen bestellbar – ideal für kleine Teams</li>
                      <li>Umweltfreundliche Verpackungen</li>
                      <li>Sonderkonditionen für regelmäßige Bestellungen</li>
                      <li>Vegetarische und auf Wunsch vegane Optionen</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Beliebt bei Münchner Unternehmen
                    </h2>
                    <p>
                      Zahlreiche Unternehmen in der Münchner Innenstadt, Maxvorstadt, Schwabing und
                      darüber hinaus vertrauen auf unser Büro-Catering. Ob Start-up, Agentur oder
                      Konzern – wir passen unser Angebot an Ihre Bedürfnisse an. Von der kleinen
                      Brainstorming-Runde bis zum großen All-Hands-Meeting.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Auch für besondere Büro-Anlässe
                    </h2>
                    <p>
                      Neben dem regulären Business Lunch bieten wir auch Catering für besondere
                      Büro-Events: Onboarding-Lunch für neue Mitarbeiter,{" "}
                      <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">
                        Firmenjubiläen
                      </LocalizedLink>
                      , Projektabschlüsse oder{" "}
                      <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">
                        die Weihnachtsfeier im Büro
                      </LocalizedLink>
                      . Mit{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        hausgemachtem Tiramisù
                      </LocalizedLink>{" "}
                      als Nachtisch wird jedes Büro-Essen zum Highlight.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Jetzt Büro-Catering bestellen
                    </h2>
                    <p>
                      Bestellen Sie bequem online oder{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      telefonisch. Wir beraten Sie gerne und erstellen Ihnen ein individuelles Angebot
                      für regelmäßiges oder einmaliges Büro-Catering.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      A good lunch strengthens the team and makes the working day more productive. With
                      our <strong>office catering in Munich</strong>, we bring fresh Italian cuisine
                      directly to your desk – uncomplicated, on time and always ready to serve. Whether
                      daily business lunch, weekly team lunch or catering for important meetings –
                      STORIA is your reliable partner.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Office Catering Formats
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <strong>Team Lunch</strong> –{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                          Sharing platters
                        </LocalizedLink>{" "}
                        with antipasti, bruschetta and salads for a shared lunch
                      </li>
                      <li>
                        <strong>Meeting Catering</strong> –{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                          Finger food and canapés
                        </LocalizedLink>{" "}
                        for meetings, workshops and conferences
                      </li>
                      <li>
                        <strong>
                          <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                            Pizza Lunch
                          </LocalizedLink>
                        </strong>{" "}
                        – Neapolitan stone-oven pizza as the popular team classic
                      </li>
                      <li>
                        <strong>Hot Meals</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                          Pasta, casseroles and hot dishes
                        </LocalizedLink>{" "}
                        for a filling lunch
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Why Office Catering from STORIA?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Freshly prepared in our kitchen in Maxvorstadt</li>
                      <li>Punctual delivery at your preferred time</li>
                      <li>Available from 5 people – ideal for small teams</li>
                      <li>Eco-friendly packaging</li>
                      <li>Special rates for regular orders</li>
                      <li>Vegetarian and vegan options available on request</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Popular with Munich Businesses
                    </h2>
                    <p>
                      Numerous companies in Munich's city centre, Maxvorstadt, Schwabing and beyond
                      trust our office catering. Whether start-up, agency or corporation – we adapt
                      our offering to your needs. From small brainstorming sessions to large all-hands
                      meetings.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Also for Special Office Occasions
                    </h2>
                    <p>
                      Besides regular business lunch, we also offer catering for special office events:
                      onboarding lunch for new employees,{" "}
                      <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">
                        company anniversaries
                      </LocalizedLink>
                      , project completions or{" "}
                      <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">
                        the Christmas party at the office
                      </LocalizedLink>
                      . With{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        homemade tiramisù
                      </LocalizedLink>{" "}
                      for dessert, every office meal becomes a highlight.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Order Office Catering Now
                    </h2>
                    <p>
                      Order conveniently online or{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        contact us
                      </LocalizedLink>{" "}
                      by phone. We are happy to advise you and create a customised offer for regular or
                      one-time office catering.
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

export default BueroCateringMuenchen;
