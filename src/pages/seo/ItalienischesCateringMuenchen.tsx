import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Truck, Users, Clock, Leaf, MapPin } from "lucide-react";

const ItalienischesCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Italienisches Catering München" : "Italian Catering Munich",
      url: language === "de" ? "/italienisches-catering-muenchen" : "/en/italian-catering-munich",
    },
  ];

  const faqItems = t.seo.italienischesCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.italienischesCatering.title}
        description={t.seo.italienischesCatering.description}
        keywords={
          language === "de"
            ? "italienisches Catering München, Catering italienisch München, italienische Küche Catering, Catering Service München, catering vegan, hausgemacht catering, bio catering"
            : "Italian catering Munich, Italian cuisine catering, catering service Munich, vegan catering, homemade catering"
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

          {/* Hero Section mit Badges */}
          <section className="relative py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4 text-center">
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <Badge variant="secondary" className="text-sm">Authentisch italienisch</Badge>
                <Badge variant="secondary" className="text-sm">München & Umland</Badge>
                <Badge variant="secondary" className="text-sm">Lieferung & Abholung</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Italienisches Catering in München"
                  : "Italian Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Authentische italienische Küche – frisch zubereitet und flexibel geliefert für Events, Büro und Zuhause."
                  : "Authentic Italian cuisine – freshly prepared and flexibly delivered for events, office and home."}
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
                      Hausgemacht & frisch aus unserer Küche
                    </h2>
                    <p>
                      Alle unsere Gerichte werden täglich frisch und <strong>hausgemacht</strong> in unserer Küche in der
                      Münchner Maxvorstadt zubereitet. Wir verwenden hochwertige Zutaten, viele davon direkt aus
                      Italien importiert – von San-Marzano-Tomaten über Fior-di-Latte-Mozzarella bis zu nativem
                      Olivenöl aus Kampanien. Bei uns gibt es keine Fertigprodukte.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Vegetarisch, vegan & allergikerfreundlich
                    </h2>
                    <p>
                      Wir bieten eine große Auswahl an <strong>vegetarischem und veganem Catering</strong>:
                      von veganen Antipasti über Pasta mit saisonalem Gemüse bis zu Desserts ohne tierische Produkte.
                      Auch bei Allergien und Unverträglichkeiten beraten wir Sie gerne und passen
                      das Menü individuell an.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Catering für jeden Anlass in München
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
                      ,{" "}
                      <LocalizedLink to="seo.bueroCatering" className="underline hover:text-foreground transition-colors">
                        Business Lunch im Büro
                      </LocalizedLink>
                      , Geburtstagsparty oder entspanntes Dinner mit Freunden – unser italienisches Catering
                      passt sich Ihrem Anlass an. Für lockere Events ist unser{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        Pizza Catering
                      </LocalizedLink>{" "}
                      besonders beliebt.
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
                      Wir liefern in ganz München und im Umkreis von ca. 50 km – einschließlich Messe München/Riem.
                      Bestellen Sie bequem online oder{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      telefonisch für eine persönliche Beratung. Selbstabholung in unserem Restaurant
                      in der Karlstraße 47a ist ebenfalls jederzeit möglich.
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
                      Homemade & Fresh from Our Kitchen
                    </h2>
                    <p>
                      All our dishes are freshly <strong>homemade</strong> daily in our kitchen in Munich's Maxvorstadt.
                      We use high-quality ingredients, many imported directly from Italy – from San Marzano tomatoes
                      to fior di latte mozzarella to native olive oil from Campania. No ready-made products.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Vegetarian, Vegan & Allergy-Friendly
                    </h2>
                    <p>
                      We offer a wide selection of <strong>vegetarian and vegan catering</strong>:
                      from vegan antipasti to pasta with seasonal vegetables to desserts without animal products.
                      We are also happy to advise you on allergies and intolerances and customise the menu accordingly.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Catering for Every Occasion in Munich
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
                      ,{" "}
                      <LocalizedLink to="seo.bueroCatering" className="underline hover:text-foreground transition-colors">
                        business lunch at the office
                      </LocalizedLink>
                      , birthday celebration or relaxed dinner with friends – our Italian catering adapts to your
                      occasion. For casual events, our{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        pizza catering
                      </LocalizedLink>{" "}
                      is particularly popular.
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
                      We deliver throughout Munich and within a radius of approx. 50 km – including Messe München/Riem.
                      Order conveniently online or{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        contact us
                      </LocalizedLink>{" "}
                      by phone for personal consultation. Self-pickup from our restaurant at
                      Karlstraße 47a is also available at any time.
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
                {language === "de" ? "Warum STORIA Catering?" : "Why Choose STORIA Catering?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: ChefHat, title: language === "de" ? "Frisch & hausgemacht" : "Fresh & homemade", desc: language === "de" ? "Täglich frisch zubereitet in unserer Küche in der Maxvorstadt — keine Fertigprodukte." : "Freshly prepared daily in our Maxvorstadt kitchen — no ready-made products." },
                  { icon: MapPin, title: language === "de" ? "Authentisch süditalienisch" : "Authentically Southern Italian", desc: language === "de" ? "Traditionelle Rezepte aus Kampanien mit importierten Zutaten direkt aus Italien." : "Traditional recipes from Campania with ingredients imported directly from Italy." },
                  { icon: Users, title: language === "de" ? "5 bis 200+ Gäste" : "5 to 200+ guests", desc: language === "de" ? "Flexible Menüzusammenstellung für kleine Teams bis große Firmenfeiern." : "Flexible menu composition for small teams to large corporate events." },
                  { icon: Truck, title: language === "de" ? "Lieferung in ganz München" : "Delivery throughout Munich", desc: language === "de" ? "Zuverlässig, pünktlich und servierfertig — auch zur Messe München/Riem." : "Reliably, on time and ready to serve — including Messe München/Riem." },
                  { icon: Clock, title: language === "de" ? "Über 15 Jahre Erfahrung" : "Over 15 years of experience", desc: language === "de" ? "Seit über 15 Jahren vertrauen Münchner Unternehmen und Privatpersonen auf unseren Service." : "Munich businesses and private clients have trusted our service for over 15 years." },
                  { icon: Leaf, title: language === "de" ? "Vegetarisch & vegan" : "Vegetarian & vegan", desc: language === "de" ? "Umfangreiche vegetarische und vegane Optionen — individuell zusammengestellt." : "Extensive vegetarian and vegan options — individually composed." },
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

          {/* Perfekt für... Anlass-Section */}
          <section className="py-16 md:py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Perfekt für Ihren Anlass" : "Perfect for Your Occasion"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Team-Events, Jubiläen & Sommerfeste" : "Team events, anniversaries & summer parties", to: "seo.firmenfeier" as const },
                  { title: language === "de" ? "Weihnachtsfeier" : "Christmas Party", desc: language === "de" ? "Festliche Menüs & winterliche Buffets" : "Festive menus & winter buffets", to: "seo.weihnachtsfeier" as const },
                  { title: language === "de" ? "Büro-Catering" : "Office Catering", desc: language === "de" ? "Business Lunch & Meeting-Catering" : "Business lunch & meeting catering", to: "seo.bueroCatering" as const },
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Steinofen-Pizza für lockere Events" : "Stone-oven pizza for casual events", to: "seo.pizzaCatering" as const },
                ].map((item, i) => (
                  <LocalizedLink key={i} to={item.to} className="group block p-6 rounded-2xl border bg-card hover:shadow-lg transition-all">
                    <h3 className="font-medium text-lg mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </LocalizedLink>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section — sichtbar */}
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4 max-w-4xl">
              <h2 className="text-2xl md:text-3xl font-serif font-medium mb-8 text-center">
                {t.seo.italienischesCatering.faqTitle}
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

          {/* Oder lieber direkt im Restaurant? */}
          <section className="bg-muted/50 border rounded-xl p-8 mb-8 text-center">
            <h2 className="text-xl font-semibold mb-3">
              {language === "de" ? "Oder lieber italienisch im Restaurant speisen?" : "Or dine Italian at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA ist Ihr authentisches italienisches Restaurant in München Maxvorstadt – mit Steinofen-Pizza, hausgemachter Pasta und Meeresfrüchten direkt am Tisch."
                : "Ristorante STORIA is your authentic Italian restaurant in Munich Maxvorstadt – with stone-oven pizza, homemade pasta and seafood right at your table."}
            </p>
            <a
              href="https://www.ristorantestoria.de/italienisches-restaurant-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Tisch im STORIA reservieren" : "→ Reserve a table at STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ItalienischesCateringMuenchen;
