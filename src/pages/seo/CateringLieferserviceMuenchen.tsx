import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Truck, Clock, MapPin, ShoppingCart, Phone, ShoppingBag } from "lucide-react";

const CateringLieferserviceMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Catering Lieferservice München" : "Catering Delivery Service Munich",
      url: language === "de" ? "/catering-lieferservice-muenchen" : "/en/catering-delivery-service-munich",
    },
  ];

  const faqItems = t.seo.lieferservice.faq;

  return (
    <>
      <SEO
        title={t.seo.lieferservice.title}
        description={t.seo.lieferservice.description}
        keywords={
          language === "de"
            ? "Catering Lieferservice München, Pizza Lieferservice München, Pasta Lieferservice, Essen bestellen München, Pizza bestellen München, Lieferservice italienisch München"
            : "catering delivery service Munich, pizza delivery Munich, pasta delivery, order food Munich, Italian delivery service"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Catering Lieferservice München" : "Catering Delivery Service Munich",
          description:
            language === "de"
              ? "Italienischer Catering-Lieferservice in München: Pizza, Pasta, Fingerfood und Buffets frisch geliefert."
              : "Italian catering delivery service in Munich: pizza, pasta, finger food and buffets freshly delivered.",
          serviceType: "Delivery Service",
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
                <Badge variant="secondary" className="text-sm">Lieferservice München</Badge>
                <Badge variant="secondary" className="text-sm">Pünktliche Lieferung</Badge>
                <Badge variant="secondary" className="text-sm">München & Umland</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Catering Lieferservice München — Italienisch geliefert von STORIA"
                  : "Catering Delivery Service Munich — Italian Food Delivered by STORIA"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Pizza, Pasta, Fingerfood und Buffets — frisch zubereitet und pünktlich geliefert in ganz München und Umgebung."
                  : "Pizza, pasta, finger food and buffets — freshly prepared and punctually delivered throughout Munich and surrounding areas."}
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
                      Der <strong>Catering-Lieferservice von STORIA</strong> bringt frische
                      italienische Küche direkt zu Ihnen — ob ins Büro, nach Hause oder
                      an Ihre Event-Location. Wir liefern in{" "}
                      <strong>ganz München und Umgebung</strong>, einschließlich Messe München/Riem.
                    </p>
                    <p>
                      Bestellen Sie bequem über unseren Online-Shop, per Telefon, WhatsApp
                      oder E-Mail. Für Einzelbestellungen sind wir auch auf Lieferando und Wolt verfügbar.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Was können Sie bestellen?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                          <strong>Fingerfood & Häppchen</strong>
                        </LocalizedLink>{" "}
                        — Bruschette, Arancini, Burrata und mehr
                      </li>
                      <li>
                        <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                          <strong>Pizza Napoletana</strong>
                        </LocalizedLink>{" "}
                        — Über 25 Sorten aus dem Steinofen
                      </li>
                      <li>
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                          <strong>Antipasti-Platten</strong>
                        </LocalizedLink>{" "}
                        — Zum Teilen, servierfertig angerichtet
                      </li>
                      <li>
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                          <strong>Warme Gerichte & Buffets</strong>
                        </LocalizedLink>{" "}
                        — Lasagne, Ossobuco, Risotto und mehr
                      </li>
                      <li>
                        <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                          <strong>Desserts</strong>
                        </LocalizedLink>{" "}
                        — Tiramisù, Panna Cotta, Cannoli
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Pizza-Lieferservice München
                    </h2>
                    <p>
                      Sie möchten einfach <strong>Pizza bestellen</strong>? STORIA bietet echte
                      neapolitanische Steinofen-Pizza — geliefert oder zur Abholung.
                      Für Einzelbestellungen nutzen Sie <strong>Lieferando</strong> oder{" "}
                      <strong>Wolt</strong>. Für größere Bestellungen ab 10 Pizzen empfehlen
                      wir unseren{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        Pizza-Catering-Service
                      </LocalizedLink>.
                    </p>
                    <p>
                      Unsere{" "}
                      <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                        Pizza-Speisekarte
                      </LocalizedLink>{" "}
                      umfasst Klassiker wie Margherita, Diavola und Quattro Formaggi
                      sowie kreative Sorten mit Trüffel, Burrata oder saisonalen Zutaten.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Liefergebiet
                    </h2>
                    <p>
                      Wir liefern in <strong>ganz München</strong> und die umliegenden Gemeinden:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>München Innenstadt, Maxvorstadt, Schwabing, Lehel, Isarvorstadt</li>
                      <li>Bogenhausen, Haidhausen, Sendling, Pasing, Nymphenburg</li>
                      <li>Messe München / Riem, ICM, MOC</li>
                      <li>Grünwald, Pullach, Oberhaching und weitere auf Anfrage</li>
                    </ul>
                    <p>
                      Detaillierte Infos zu Lieferkosten und -zonen finden Sie auf unserer{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        Preise-Seite
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Bestellmöglichkeiten
                    </h2>
                    <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                      {[
                        { icon: "🛒", title: "Online-Shop", desc: "Direkt im STORIA Catering-Shop bestellen" },
                        { icon: "📞", title: "Telefon", desc: "089 / 54 32 89 00" },
                        { icon: "💬", title: "WhatsApp", desc: "Schnell und unkompliziert per Chat" },
                        { icon: "✉️", title: "E-Mail", desc: "info@events-storia.de" },
                      ].map((ch, i) => (
                        <div key={i} className="rounded-2xl border bg-card p-5">
                          <p className="text-2xl mb-2">{ch.icon}</p>
                          <p className="font-medium">{ch.title}</p>
                          <p className="text-sm text-muted-foreground">{ch.desc}</p>
                        </div>
                      ))}
                    </div>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Lieferbedingungen
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Mindestbestellwert</strong> — abhängig von der Lieferzone (im Shop hinterlegt)</li>
                      <li><strong>Lieferzeiten</strong> — Catering wird zum vereinbarten Termin geliefert</li>
                      <li><strong>Aufbau-Service</strong> — optional buchbar für größere Events</li>
                      <li><strong>Warmhaltung</strong> — Warme Gerichte in Thermoboxen oder Chafing Dishes</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Selbstabholung als Alternative
                    </h2>
                    <p>
                      Lieferkosten sparen? Holen Sie Ihre Bestellung in unserem Restaurant in der{" "}
                      <strong>Karlstraße 47a, München Maxvorstadt</strong> ab. Alles frisch
                      zubereitet und sorgfältig verpackt.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>STORIA's catering delivery service</strong> brings fresh Italian
                      cuisine directly to you — whether to the office, home or your event venue.
                      We deliver throughout{" "}
                      <strong>Munich and the surrounding area</strong>, including Messe München/Riem.
                    </p>
                    <p>
                      Order conveniently through our online shop, by phone, WhatsApp or email.
                      For individual orders, we're also available on Lieferando and Wolt.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      What Can You Order?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>
                        <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                          <strong>Finger food & bites</strong>
                        </LocalizedLink>{" "}
                        — Bruschetta, arancini, burrata and more
                      </li>
                      <li>
                        <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                          <strong>Pizza Napoletana</strong>
                        </LocalizedLink>{" "}
                        — Over 25 varieties from the stone oven
                      </li>
                      <li>
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                          <strong>Antipasti platters</strong>
                        </LocalizedLink>{" "}
                        — For sharing, served ready on platters
                      </li>
                      <li>
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                          <strong>Hot dishes & buffets</strong>
                        </LocalizedLink>{" "}
                        — Lasagna, ossobuco, risotto and more
                      </li>
                      <li>
                        <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                          <strong>Desserts</strong>
                        </LocalizedLink>{" "}
                        — Tiramisù, panna cotta, cannoli
                      </li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Pizza Delivery Service Munich
                    </h2>
                    <p>
                      Just want to <strong>order pizza</strong>? STORIA offers authentic
                      Neapolitan stone-oven pizza — delivered or for pickup.
                      For individual orders use <strong>Lieferando</strong> or{" "}
                      <strong>Wolt</strong>. For larger orders from 10 pizzas, we recommend
                      our{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        pizza catering service
                      </LocalizedLink>.
                    </p>
                    <p>
                      Our{" "}
                      <LocalizedLink to="catering.pizza" className="underline hover:text-foreground transition-colors">
                        pizza menu
                      </LocalizedLink>{" "}
                      includes classics like Margherita, Diavola and Quattro Formaggi
                      as well as creative varieties with truffle, burrata or seasonal ingredients.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Delivery Area
                    </h2>
                    <p>
                      We deliver throughout <strong>Munich</strong> and surrounding municipalities:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Munich city centre, Maxvorstadt, Schwabing, Lehel, Isarvorstadt</li>
                      <li>Bogenhausen, Haidhausen, Sendling, Pasing, Nymphenburg</li>
                      <li>Messe München / Riem, ICM, MOC</li>
                      <li>Grünwald, Pullach, Oberhaching and more on request</li>
                    </ul>
                    <p>
                      Detailed info on delivery costs and zones on our{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        prices page
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      How to Order
                    </h2>
                    <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                      {[
                        { icon: "🛒", title: "Online Shop", desc: "Order directly in the STORIA catering shop" },
                        { icon: "📞", title: "Phone", desc: "089 / 54 32 89 00" },
                        { icon: "💬", title: "WhatsApp", desc: "Quick and easy via chat" },
                        { icon: "✉️", title: "Email", desc: "info@events-storia.de" },
                      ].map((ch, i) => (
                        <div key={i} className="rounded-2xl border bg-card p-5">
                          <p className="text-2xl mb-2">{ch.icon}</p>
                          <p className="font-medium">{ch.title}</p>
                          <p className="text-sm text-muted-foreground">{ch.desc}</p>
                        </div>
                      ))}
                    </div>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Delivery Terms
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Minimum order</strong> — depends on delivery zone (listed in shop)</li>
                      <li><strong>Delivery times</strong> — catering delivered at the agreed time</li>
                      <li><strong>Setup service</strong> — optionally bookable for larger events</li>
                      <li><strong>Keeping warm</strong> — hot dishes in thermal boxes or chafing dishes</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Self-Pickup as an Alternative
                    </h2>
                    <p>
                      Save on delivery costs? Pick up your order from our restaurant at{" "}
                      <strong>Karlstraße 47a, Munich Maxvorstadt</strong>. Everything freshly
                      prepared and carefully packed.
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
                {language === "de" ? "Warum bei STORIA bestellen?" : "Why Order from STORIA?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Truck, title: language === "de" ? "Pünktliche Lieferung" : "Punctual delivery", desc: language === "de" ? "Zuverlässig zum vereinbarten Termin — in ganz München." : "Reliably at the agreed time — throughout Munich." },
                  { icon: Clock, title: language === "de" ? "Frisch zubereitet" : "Freshly prepared", desc: language === "de" ? "Alles wird am Liefertag frisch in unserer Küche gekocht." : "Everything freshly cooked in our kitchen on delivery day." },
                  { icon: MapPin, title: language === "de" ? "München & Umland" : "Munich & surroundings", desc: language === "de" ? "Lieferung in alle Münchner Stadtteile und Umgebung." : "Delivery to all Munich districts and surrounding areas." },
                  { icon: ShoppingCart, title: language === "de" ? "Online bestellen" : "Order online", desc: language === "de" ? "Bequem im Shop bestellen — oder per Telefon/WhatsApp." : "Order conveniently in the shop — or by phone/WhatsApp." },
                  { icon: Phone, title: language === "de" ? "Persönliche Beratung" : "Personal consultation", desc: language === "de" ? "Bei Fragen sind wir telefonisch und per WhatsApp erreichbar." : "For questions, we're available by phone and WhatsApp." },
                  { icon: ShoppingBag, title: language === "de" ? "Selbstabholung" : "Self-pickup", desc: language === "de" ? "Karlstraße 47a — abholen und Lieferkosten sparen." : "Karlstraße 47a — pick up and save on delivery costs." },
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
                {language === "de" ? "Alle Catering-Kategorien" : "All Catering Categories"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Steinofen-Pizza ab 12 € p.P." : "Stone-oven pizza from €12 p.p.", to: "seo.pizzaCatering" as const },
                  { title: language === "de" ? "Fingerfood" : "Finger Food", desc: language === "de" ? "Häppchen ab 8 € p.P." : "Bites from €8 p.p.", to: "seo.fingerfoodCatering" as const },
                  { title: language === "de" ? "Partyservice" : "Party Service", desc: language === "de" ? "Fertige Gerichte zum Liefern" : "Ready meals for delivery", to: "seo.partyservice" as const },
                  { title: language === "de" ? "Catering-Preise" : "Catering Prices", desc: language === "de" ? "Alle Preise im Überblick" : "All prices at a glance", to: "seo.cateringPreise" as const },
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
                {t.seo.lieferservice.faqTitle}
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
              {language === "de" ? "Pizza im Restaurant genießen?" : "Enjoy pizza at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Echte neapolitanische Pizza direkt aus dem Steinofen — genießen Sie im Ristorante STORIA in München Maxvorstadt, mit Terrasse und stimmungsvollem Ambiente."
                : "Authentic Neapolitan pizza straight from the stone oven — enjoy at Ristorante STORIA in Munich Maxvorstadt, with terrace and atmospheric ambience."}
            </p>
            <a
              href="https://www.ristorantestoria.de/pizza-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Pizza im STORIA entdecken" : "→ Discover pizza at STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default CateringLieferserviceMuenchen;
