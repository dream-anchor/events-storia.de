import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";

const PizzaCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Pizza Catering München" : "Pizza Catering Munich",
      url: language === "de" ? "/pizza-catering-muenchen" : "/en/pizza-catering-munich",
    },
  ];

  const faqItems =
    language === "de"
      ? [
          {
            question: "Wie viele Pizza-Sorten bietet STORIA für Catering an?",
            answer:
              "Wir bieten über 25 Sorten neapolitanische Pizza an – von Margherita und Diavola bis hin zu besonderen Kreationen mit Trüffel, Burrata oder saisonalen Zutaten. Alle Pizzen werden im Steinofen gebacken.",
          },
          {
            question: "Werden die Pizzen heiß geliefert?",
            answer:
              "Ja, unsere Pizzen werden in speziellen Thermoboxen geliefert und kommen heiß und knusprig bei Ihnen an. Für größere Events empfehlen wir unser Catering-Format mit Warmhaltung vor Ort.",
          },
          {
            question: "Ab wie vielen Pizzen kann ich bestellen?",
            answer:
              "Unser Pizza-Catering ist ab 10 Pizzen verfügbar. Für kleinere Bestellungen empfehlen wir unseren regulären Lieferservice.",
          },
        ]
      : [
          {
            question: "How many pizza varieties does STORIA offer for catering?",
            answer:
              "We offer over 25 varieties of Neapolitan pizza – from Margherita and Diavola to special creations with truffle, burrata or seasonal ingredients. All pizzas are baked in a stone oven.",
          },
          {
            question: "Are the pizzas delivered hot?",
            answer:
              "Yes, our pizzas are delivered in special thermal boxes and arrive hot and crispy. For larger events, we recommend our catering format with on-site warming.",
          },
          {
            question: "What is the minimum order for pizza catering?",
            answer:
              "Our pizza catering is available from 10 pizzas. For smaller orders, we recommend our regular delivery service.",
          },
        ];

  return (
    <>
      <SEO
        title={t.seo.pizzaCatering.title}
        description={t.seo.pizzaCatering.description}
        keywords={
          language === "de"
            ? "Pizza Catering München, Pizza bestellen Event, neapolitanische Pizza Catering, Pizza Party München"
            : "pizza catering Munich, pizza order event, Neapolitan pizza catering, pizza party Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Pizza Catering München" : "Pizza Catering Munich",
          description:
            language === "de"
              ? "Neapolitanische Steinofen-Pizza für Events, Firmenfeiern und private Feiern in München – heiß geliefert."
              : "Neapolitan stone-oven pizza for events, corporate parties and private celebrations in Munich – delivered hot.",
          serviceType: "Pizza Catering Service",
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
                  ? "Pizza Catering in München"
                  : "Pizza Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                {language === "de"
                  ? "Echte neapolitanische Steinofen-Pizza – heiß geliefert für Events, Feiern und Büro."
                  : "Authentic Neapolitan stone-oven pizza – delivered hot for events, celebrations and office."}
              </p>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <p>
                      Pizza gehört zu den beliebtesten Gerichten für Events und Feiern – und mit unserem{" "}
                      <strong>Pizza Catering in München</strong> bringen wir Ihnen echte neapolitanische
                      Steinofen-Pizza direkt an den Veranstaltungsort. STORIA steht seit über 15 Jahren
                      für authentische Pizza Napoletana, die jeden Gast begeistert.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Über 25 Sorten neapolitanische Pizza
                    </h2>
                    <p>
                      Unser{" "}
                      <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                        Pizza-Sortiment
                      </LocalizedLink>{" "}
                      umfasst über 25 Sorten – von der klassischen Margherita über die feurige Diavola
                      bis hin zu Gourmet-Varianten mit Trüffel, Burrata oder Parmaschinken. Jede Pizza
                      wird im Steinofen gebacken und mit handgezogenem Teig, San-Marzano-Tomaten und
                      Fior-di-Latte-Mozzarella zubereitet.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Für welche Anlässe eignet sich Pizza Catering?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">
                          Firmenfeiern
                        </LocalizedLink>{" "}
                        und Team-Events – der lockere Klassiker
                      </li>
                      <li>Geburtstagsfeiern und private Partys</li>
                      <li>Kindergeburtstage und Familienfeste</li>
                      <li>
                        <LocalizedLink to="seo.bueroCatering" className="underline hover:text-foreground transition-colors">
                          Büro-Lunch
                        </LocalizedLink>{" "}
                        und Meeting-Catering
                      </li>
                      <li>Sommerfeste und Gartenfeiern</li>
                      <li>After-Work-Events und informelle Runden</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Heiß und knusprig geliefert
                    </h2>
                    <p>
                      Wir liefern unsere Pizzen in speziellen Thermoboxen, damit sie heiß und knusprig
                      bei Ihnen ankommen. Für größere Events bieten wir auch Warmhaltung vor Ort an –
                      so genießen Ihre Gäste die Pizzen frisch wie direkt aus dem Ofen.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Pizza kombinieren mit mehr italienischem Genuss
                    </h2>
                    <p>
                      Kombinieren Sie unser Pizza Catering mit weiteren italienischen Spezialitäten:
                      Starten Sie mit{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        Fingerfood und Antipasti
                      </LocalizedLink>
                      , ergänzen Sie mit{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Sharing-Platten
                      </LocalizedLink>{" "}
                      und runden Sie das Menü mit{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        hausgemachtem Tiramisù
                      </LocalizedLink>{" "}
                      ab. So wird aus dem Pizza-Abend ein vollwertiges italienisches Fest.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Jetzt Pizza Catering bestellen
                    </h2>
                    <p>
                      Bestellen Sie Ihr Pizza Catering bequem online oder{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      für ein individuelles Angebot. Wir liefern in ganz München und Umgebung –
                      zuverlässig, pünktlich und immer heiß.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Pizza is one of the most popular dishes for events and celebrations – and with our{" "}
                      <strong>pizza catering in Munich</strong>, we bring authentic Neapolitan stone-oven
                      pizza directly to your venue. STORIA has stood for authentic Pizza Napoletana for
                      over 15 years, delighting every guest.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Over 25 Varieties of Neapolitan Pizza
                    </h2>
                    <p>
                      Our{" "}
                      <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                        pizza selection
                      </LocalizedLink>{" "}
                      includes over 25 varieties – from classic Margherita to fiery Diavola to gourmet
                      options with truffle, burrata or Parma ham. Every pizza is baked in a stone oven
                      with hand-pulled dough, San Marzano tomatoes and fior di latte mozzarella.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      What Occasions Suit Pizza Catering?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">
                          Corporate events
                        </LocalizedLink>{" "}
                        and team events – the casual classic
                      </li>
                      <li>Birthday parties and private celebrations</li>
                      <li>Children's birthdays and family gatherings</li>
                      <li>
                        <LocalizedLink to="seo.bueroCatering" className="underline hover:text-foreground transition-colors">
                          Office lunch
                        </LocalizedLink>{" "}
                        and meeting catering
                      </li>
                      <li>Summer parties and garden celebrations</li>
                      <li>After-work events and informal gatherings</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Delivered Hot and Crispy
                    </h2>
                    <p>
                      We deliver our pizzas in special thermal boxes to ensure they arrive hot and
                      crispy. For larger events, we also offer on-site warming – so your guests enjoy
                      pizzas as fresh as straight from the oven.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Combine Pizza with More Italian Flavours
                    </h2>
                    <p>
                      Combine our pizza catering with more Italian specialities: start with{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        finger food and antipasti
                      </LocalizedLink>
                      , add{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        sharing platters
                      </LocalizedLink>{" "}
                      and finish with{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        homemade tiramisù
                      </LocalizedLink>
                      . Turn your pizza evening into a complete Italian feast.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Order Pizza Catering Now
                    </h2>
                    <p>
                      Order your pizza catering conveniently online or{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        contact us
                      </LocalizedLink>{" "}
                      for a customised quote. We deliver throughout Munich and surrounding areas –
                      reliably, on time and always hot.
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

export default PizzaCateringMuenchen;
