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
import { ChefHat, Truck, Users, Leaf, Flame, HandPlatter, Clock, MessageSquare } from "lucide-react";

const FingerfoodCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Fingerfood Catering München" : "Finger Food Catering Munich",
      url: language === "de" ? "/fingerfood-catering-muenchen" : "/en/fingerfood-catering-munich",
    },
  ];

  const faqItems = t.seo.fingerfoodCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.fingerfoodCatering.title}
        description={t.seo.fingerfoodCatering.description}
        keywords={
          language === "de"
            ? "Fingerfood Catering München, italienisches Fingerfood München, Häppchen Catering, Bruschette München, Fingerfood bestellen München, Stehempfang Catering"
            : "finger food catering Munich, Italian finger food Munich, canapé catering, bruschetta Munich, standing reception catering"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Fingerfood Catering München" : "Finger Food Catering Munich",
          description:
            language === "de"
              ? "Handgemachtes italienisches Fingerfood-Catering für Events, Empfänge und Feiern in München."
              : "Handmade Italian finger food catering for events, receptions and celebrations in Munich.",
          serviceType: "Finger Food Catering",
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
                <Badge variant="secondary" className="text-sm">Handgemachtes Fingerfood</Badge>
                <Badge variant="secondary" className="text-sm">Ab 5 Personen</Badge>
                <Badge variant="secondary" className="text-sm">Lieferung & Abholung</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de" ? "Fingerfood Catering München — Italienische Häppchen von STORIA" : "Finger Food Catering Munich — Italian Bites by STORIA"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Handgemachte italienische Häppchen für Empfänge, Events und Feiern — frisch aus unserer Küche in der Maxvorstadt."
                  : "Handmade Italian bites for receptions, events and celebrations — freshly prepared from our kitchen in Maxvorstadt."}
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
                      <strong>Fingerfood-Catering</strong> ist die ideale Lösung für Stehempfänge,
                      Networking-Events und festliche Anlässe, bei denen Ihre Gäste sich frei
                      bewegen sollen. STORIA liefert Ihnen{" "}
                      <strong>handgemachte italienische Häppchen in München</strong> —
                      von klassischen Bruschette über Oktopus-Häppchen bis hin zu Burrata-Variationen.
                    </p>
                    <p>
                      Ob Firmenempfang, Vernissage, Hochzeitsempfang oder Geburtstagsfeier:
                      Unser Fingerfood verbindet italienische Tradition mit kreativer Präsentation
                      und eignet sich für Gruppen ab 5 Personen.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Unsere beliebtesten Fingerfood-Optionen
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Bruschette</strong> – Klassisch mit Tomate & Basilikum, Trüffel-Pilz, Nduja oder
                        saisonalen Variationen</li>
                      <li><strong>Oktopus-Häppchen</strong> – Gegrillter Oktopus auf Kartoffelcreme,
                        mediterraner Klassiker</li>
                      <li><strong>Burrata</strong> – Cremige Burrata mit Pesto, Kirschtomaten oder Parmaschinken</li>
                      <li><strong>Frittata & Arancini</strong> – Warme italienische Klassiker, perfekt für
                        winterliche Events</li>
                      <li><strong>Avocado-Garnelen</strong> – Frische Garnelen auf Avocado-Creme,
                        leicht und elegant</li>
                      <li><strong>Antipasti-Mini-Portionen</strong> – Parmigiana, Caponata, Vitello Tonnato
                        als Fingerfood</li>
                    </ul>

                    <p>
                      Entdecken Sie unser komplettes{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        Fingerfood-Sortiment im Online-Shop
                      </LocalizedLink>{" "}
                      und bestellen Sie direkt — oder{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      für ein individuelles Angebot.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Perfekt für jeden Anlass
                    </h2>
                    <p>
                      Fingerfood eignet sich besonders für Events, bei denen Flexibilität und
                      Eleganz gefragt sind: <strong>Firmenempfänge</strong> und Networking-Events,{" "}
                      <strong>Vernissagen</strong> und Ausstellungseröffnungen,{" "}
                      <strong>Hochzeitsempfänge</strong> als Aperitivo vor dem Dinner,{" "}
                      <strong>Stehempfänge</strong> und After-Work-Events. Auch als Ergänzung zu einem{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        warmen Buffet
                      </LocalizedLink>{" "}
                      oder{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Antipasti-Platten
                      </LocalizedLink>{" "}
                      sind unsere Häppchen ideal.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Preisübersicht Fingerfood
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Fingerfood ab ca. 8 € p.P.</strong> – Einfache Auswahl mit Bruschette und kalten Häppchen</li>
                      <li><strong>Premium-Fingerfood ab ca. 15 € p.P.</strong> – Kalte und warme Häppchen, größere Auswahl</li>
                      <li><strong>Flying Buffet ab ca. 20 € p.P.</strong> – Komplett betreuter Service mit Fingerfood und kleinen Gängen</li>
                    </ul>
                    <p>
                      Detaillierte Preisinformationen finden Sie auf unserer{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        Catering-Preise-Seite
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Selbstabholung möglich
                    </h2>
                    <p>
                      Sie möchten Lieferkosten sparen? Kein Problem — holen Sie Ihr Fingerfood
                      einfach in unserem Restaurant in der <strong>Karlstraße 47a</strong> ab.
                      Alles frisch zubereitet und servierfertig verpackt.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>Finger food catering</strong> is the ideal solution for standing receptions,
                      networking events and festive occasions where your guests need to move freely.
                      STORIA delivers{" "}
                      <strong>handmade Italian bites in Munich</strong> —
                      from classic bruschetta to octopus canapés and burrata variations.
                    </p>
                    <p>
                      Whether corporate reception, vernissage, wedding reception or birthday party:
                      our finger food combines Italian tradition with creative presentation
                      and is available for groups from 5 people.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Most Popular Finger Food Options
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Bruschetta</strong> – Classic with tomato & basil, truffle mushroom, nduja or seasonal variations</li>
                      <li><strong>Octopus Bites</strong> – Grilled octopus on potato cream, Mediterranean classic</li>
                      <li><strong>Burrata</strong> – Creamy burrata with pesto, cherry tomatoes or Parma ham</li>
                      <li><strong>Frittata & Arancini</strong> – Warm Italian classics, perfect for winter events</li>
                      <li><strong>Avocado Prawns</strong> – Fresh prawns on avocado cream, light and elegant</li>
                      <li><strong>Antipasti Mini Portions</strong> – Parmigiana, caponata, vitello tonnato as finger food</li>
                    </ul>

                    <p>
                      Explore our complete{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        finger food selection in our online shop
                      </LocalizedLink>{" "}
                      and order directly — or{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        contact us
                      </LocalizedLink>{" "}
                      for a customised quote.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Perfect for Every Occasion
                    </h2>
                    <p>
                      Finger food is particularly suited for events where flexibility and
                      elegance are key: <strong>corporate receptions</strong> and networking events,{" "}
                      <strong>vernissages</strong> and exhibition openings,{" "}
                      <strong>wedding receptions</strong> as an aperitivo before dinner,{" "}
                      <strong>standing receptions</strong> and after-work events. Also ideal as a complement to a{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        hot buffet
                      </LocalizedLink>{" "}
                      or{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        antipasti platters
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Finger Food Pricing
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Finger food from approx. €8 p.p.</strong> – Simple selection with bruschetta and cold bites</li>
                      <li><strong>Premium finger food from approx. €15 p.p.</strong> – Cold and warm bites, wider selection</li>
                      <li><strong>Flying buffet from approx. €20 p.p.</strong> – Full attended service with finger food and small courses</li>
                    </ul>
                    <p>
                      Find detailed pricing on our{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        catering prices page
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Self-Pickup Available
                    </h2>
                    <p>
                      Want to save on delivery costs? No problem — pick up your finger food
                      from our restaurant at <strong>Karlstraße 47a</strong>.
                      Everything freshly prepared and packed ready to serve.
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
                {language === "de" ? "Warum Fingerfood von STORIA?" : "Why Finger Food from STORIA?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: ChefHat, title: language === "de" ? "Handgemacht" : "Handmade", desc: language === "de" ? "Jedes Häppchen wird frisch in unserer Küche zubereitet — keine Massenware." : "Every bite freshly prepared in our kitchen — no mass production." },
                  { icon: Truck, title: language === "de" ? "Lieferung & Aufbau" : "Delivery & setup", desc: language === "de" ? "Wir liefern, bauen auf und räumen auf Wunsch auch wieder ab." : "We deliver, set up and optionally clear away." },
                  { icon: Users, title: language === "de" ? "Flexible Mengen" : "Flexible quantities", desc: language === "de" ? "Ab 5 Personen bis 200+ Gäste — für jede Gruppengröße." : "From 5 people to 200+ guests — for any group size." },
                  { icon: Leaf, title: language === "de" ? "Vegetarisch & vegan" : "Vegetarian & vegan", desc: language === "de" ? "Große Auswahl an vegetarischem Fingerfood, vegane Optionen auf Anfrage." : "Wide selection of vegetarian finger food, vegan options on request." },
                  { icon: Flame, title: language === "de" ? "Kalt & warm" : "Cold & warm", desc: language === "de" ? "Kalte Häppchen servierfertig, warme Optionen in Chafing Dishes." : "Cold bites ready to serve, warm options in chafing dishes." },
                  { icon: MessageSquare, title: language === "de" ? "Persönliche Beratung" : "Personal consultation", desc: language === "de" ? "Wir beraten Sie individuell und stellen Ihr Wunsch-Menü zusammen." : "We consult individually and put together your ideal menu." },
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

          {/* Anlass-Section */}
          <section className="py-16 md:py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Weitere Catering-Angebote" : "More Catering Options"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Neapolitanische Pizza für lockere Events" : "Neapolitan pizza for casual events", to: "seo.pizzaCatering" as const },
                  { title: language === "de" ? "Italienisches Catering" : "Italian Catering", desc: language === "de" ? "Unser komplettes Angebot" : "Our full offering", to: "seo.italienischesCatering" as const },
                  { title: language === "de" ? "Catering-Preise" : "Catering Prices", desc: language === "de" ? "Transparente Preisübersicht" : "Transparent pricing overview", to: "seo.cateringPreise" as const },
                  { title: language === "de" ? "Events im STORIA" : "Events at STORIA", desc: language === "de" ? "Feiern im Restaurant" : "Celebrate at the restaurant", to: "events" as const },
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
                {t.seo.fingerfoodCatering.faqTitle}
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

          {/* Cross-Domain Link */}
          <section className="bg-muted/50 border rounded-xl p-8 mb-8 text-center">
            <h2 className="text-xl font-semibold mb-3">
              {language === "de" ? "Aperitivo direkt im STORIA?" : "Aperitivo at STORIA?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Genießen Sie italienische Häppchen und Aperitivo direkt in unserem Ristorante STORIA in München Maxvorstadt — mit stimmungsvollem Ambiente und persönlichem Service."
                : "Enjoy Italian bites and aperitivo directly at our Ristorante STORIA in Munich Maxvorstadt — with atmospheric ambience and personal service."}
            </p>
            <a
              href="https://www.ristorantestoria.de/aperitivo-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Aperitivo im STORIA entdecken" : "→ Discover Aperitivo at STORIA"}
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

export default FingerfoodCateringMuenchen;
