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
import { Flame, Truck, Pizza, Clock, ShoppingBag, UtensilsCrossed } from "lucide-react";

const PizzaCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Pizza Catering München" : "Pizza Catering Munich",
      url: language === "de" ? "/pizza-catering-muenchen" : "/en/pizza-catering-munich",
    },
  ];

  const faqItems = t.seo.pizzaCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.pizzaCatering.title}
        description={t.seo.pizzaCatering.description}
        keywords={
          language === "de"
            ? "Pizza Catering München, Pizza bestellen Event, neapolitanische Pizza Catering, Pizza Party München, pizza lieferservice speisekarte, pizza bestellen in der nähe, lieferservice pizza essen, pasta lieferservice"
            : "pizza catering Munich, pizza order event, Neapolitan pizza catering, pizza party Munich, pizza delivery service"
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

          {/* Hero Section mit Badges */}
          <section className="relative py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4 text-center">
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <Badge variant="secondary" className="text-sm">Steinofen-Pizza</Badge>
                <Badge variant="secondary" className="text-sm">25 Sorten</Badge>
                <Badge variant="secondary" className="text-sm">Heiß geliefert</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Pizza Catering in München"
                  : "Pizza Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Echte neapolitanische Steinofen-Pizza – heiß geliefert für Events, Feiern und Büro."
                  : "Authentic Neapolitan stone-oven pizza – delivered hot for events, celebrations and office."}
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
                      Pizza-Lieferservice München
                    </h2>
                    <p>
                      Sie möchten nur ein paar Pizzen bestellen? Kein Problem! Über <strong>Lieferando</strong> und{" "}
                      <strong>Wolt</strong> können Sie auch einzelne Pizzen und Pasta-Gerichte bestellen –
                      direkt aus unserem Steinofen zu Ihnen nach Hause oder ins Büro geliefert. Für
                      Catering-Bestellungen ab 10 Pizzen liefern wir direkt und bieten attraktive Gruppenpreise.
                      <strong> Selbstabholung</strong> in unserem Restaurant in der Karlstraße 47a ist
                      ebenfalls jederzeit möglich.
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
                      ab. Neben Pizza bieten wir auch frische <strong>Pasta</strong>, Salate und Desserts
                      zur Lieferung an.
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
                      Pizza Delivery Service Munich
                    </h2>
                    <p>
                      Want to order just a few pizzas? No problem! Via <strong>Lieferando</strong> and{" "}
                      <strong>Wolt</strong> you can also order individual pizzas and pasta dishes –
                      delivered directly from our stone oven to your home or office. For catering orders
                      of 10+ pizzas, we deliver directly with attractive group pricing.
                      <strong> Self-pickup</strong> from our restaurant at Karlstraße 47a is also available.
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
                      . Besides pizza, we also offer fresh <strong>pasta</strong>, salads and desserts
                      for delivery.
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

          {/* USP Grid */}
          <section className="py-16 md:py-20 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Warum Pizza von STORIA?" : "Why Pizza from STORIA?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Flame, title: language === "de" ? "Echter Steinofen" : "Real stone oven", desc: language === "de" ? "Jede Pizza wird bei über 450°C im Steinofen gebacken — wie in Neapel." : "Every pizza is baked at over 450°C in a stone oven — just like in Naples." },
                  { icon: Pizza, title: language === "de" ? "25+ Sorten" : "25+ varieties", desc: language === "de" ? "Von Margherita über Diavola bis zu Gourmet-Varianten mit Trüffel und Burrata." : "From Margherita to Diavola to gourmet options with truffle and burrata." },
                  { icon: Truck, title: language === "de" ? "Heiß geliefert" : "Delivered hot", desc: language === "de" ? "Spezielle Thermoboxen sorgen dafür, dass Ihre Pizza knusprig und heiß ankommt." : "Special thermal boxes ensure your pizza arrives crispy and hot." },
                  { icon: Clock, title: language === "de" ? "Auch kurzfristig" : "Also short notice", desc: language === "de" ? "Pizza-Catering ab 10 Pizzen, Einzelbestellung über Lieferando & Wolt." : "Pizza catering from 10 pizzas, individual orders via Lieferando & Wolt." },
                  { icon: ShoppingBag, title: language === "de" ? "Selbstabholung möglich" : "Self-pickup available", desc: language === "de" ? "Holen Sie Ihre Bestellung frisch aus dem Steinofen in der Karlstraße 47a ab." : "Pick up your order fresh from the stone oven at Karlstraße 47a." },
                  { icon: UtensilsCrossed, title: language === "de" ? "Mehr als nur Pizza" : "More than just pizza", desc: language === "de" ? "Ergänzen Sie mit Pasta, Antipasti, Salaten und hausgemachtem Tiramisù." : "Add pasta, antipasti, salads and homemade tiramisù." },
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
                {language === "de" ? "Perfekt für Ihren Anlass" : "Perfect for Your Occasion"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Pizza als lockerer Klassiker für Team-Events" : "Pizza as the casual classic for team events", to: "seo.firmenfeier" as const },
                  { title: language === "de" ? "Büro-Lunch" : "Office Lunch", desc: language === "de" ? "Pizza-Pause für das Team" : "Pizza break for the team", to: "seo.bueroCatering" as const },
                  { title: language === "de" ? "Kindergeburtstag" : "Kids' Party", desc: language === "de" ? "Der Hit bei jedem Kindergeburtstag" : "A hit at every children's party", to: "seo.italienischesCatering" as const },
                  { title: language === "de" ? "Weihnachtsfeier" : "Christmas Party", desc: language === "de" ? "Lockeres Pizza-Buffet zum Jahresausklang" : "Casual pizza buffet to end the year", to: "seo.weihnachtsfeier" as const },
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
                {t.seo.pizzaCatering.faqTitle}
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
              {language === "de" ? "Lieber Pizza direkt im Restaurant genießen?" : "Prefer to enjoy pizza at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Unsere neapolitanische Steinofen-Pizza schmeckt am besten frisch aus dem Ofen – im Ristorante STORIA in München Maxvorstadt, täglich geöffnet."
                : "Our Neapolitan stone-oven pizza tastes best fresh from the oven – at Ristorante STORIA in Munich Maxvorstadt, open daily."}
            </p>
            <a
              href="https://www.ristorantestoria.de/pizza-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Pizza im STORIA bestellen" : "→ Order pizza at STORIA"}
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

export default PizzaCateringMuenchen;
