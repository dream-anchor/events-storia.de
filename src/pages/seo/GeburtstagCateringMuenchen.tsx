import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Cake, Pizza, Users, Truck, ShoppingBag, PartyPopper } from "lucide-react";

const GeburtstagCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Geburtstag Catering München" : "Birthday Catering Munich",
      url: language === "de" ? "/geburtstag-catering-muenchen" : "/en/birthday-catering-munich",
    },
  ];

  const faqItems = t.seo.geburtstagCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.geburtstagCatering.title}
        description={t.seo.geburtstagCatering.description}
        keywords={
          language === "de"
            ? "Geburtstag Catering München, Geburtstagsfeier Catering, Pizza-Party München, Geburtstagsbuffet München, Catering Kindergeburtstag München, Partyservice Geburtstag"
            : "birthday catering Munich, birthday party catering, pizza party Munich, birthday buffet Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Geburtstag Catering München" : "Birthday Catering Munich",
          description:
            language === "de"
              ? "Italienisches Catering für Geburtstagsfeiern in München: Pizza-Party, Buffet und Fingerfood ab 8 € pro Person."
              : "Italian catering for birthday parties in Munich: pizza party, buffet and finger food from €8 per person.",
          serviceType: "Birthday Party Catering",
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
                <Badge variant="secondary" className="text-sm">Geburtstags-Catering</Badge>
                <Badge variant="secondary" className="text-sm">Pizza-Party ab 12 €</Badge>
                <Badge variant="secondary" className="text-sm">Lieferung & Abholung</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Geburtstag Catering München — Italienisches Essen für Ihre Feier"
                  : "Birthday Catering Munich — Italian Food for Your Celebration"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Pizza-Party, italienisches Buffet oder elegantes Fingerfood — wir machen Ihren Geburtstag zu einem kulinarischen Fest."
                  : "Pizza party, Italian buffet or elegant finger food — we make your birthday a culinary celebration."}
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
                      Ob <strong>Kindergeburtstag</strong>, runder Geburtstag oder entspannte
                      Gartenparty — mit italienischem Catering wird Ihre Feier unvergesslich.
                      STORIA bietet Ihnen{" "}
                      <strong>Geburtstags-Catering in München</strong> für jeden Geschmack
                      und jedes Budget: von der lockeren Pizza-Party bis zum eleganten Buffet.
                    </p>
                    <p>
                      Alle Gerichte werden frisch in unserer Küche in der Maxvorstadt
                      zubereitet — und direkt zu Ihnen geliefert oder zur Abholung bereitgestellt.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Pakete nach Feier-Typ
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Kinder- & Teenager-Geburtstag: Pizza-Party
                    </h3>
                    <p>
                      Der Klassiker für jede Altersgruppe! Unsere{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        Pizza-Party
                      </LocalizedLink>{" "}
                      bietet echte neapolitanische Steinofen-Pizza in über 25 Sorten —
                      ab ca. 12 € pro Person. Dazu optional Getränke und Mini-Desserts.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Runder Geburtstag: Menü oder Buffet
                    </h3>
                    <p>
                      Für den 30., 50., 60. oder 70. Geburtstag: Wählen Sie zwischen einem
                      eleganten mehrgängigen Menü oder einem großzügigen{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        warmen Buffet
                      </LocalizedLink>{" "}
                      mit Lasagne, Ossobuco, Risotto und mehr. Ab ca. 25 € pro Person.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Gartenparty: Antipasti & Pizza
                    </h3>
                    <p>
                      Perfekt für den Sommer:{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Antipasti-Platten
                      </LocalizedLink>{" "}
                      zum Teilen, dazu frische Pizza und ein paar{" "}
                      <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                        Fingerfood-Häppchen
                      </LocalizedLink>
                      . Unkompliziert, lecker und ideal für draußen.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Preise für Geburtstags-Catering
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Fingerfood ab ca. 8 € p.P.</strong> — Bruschette, Häppchen, Mini-Portionen</li>
                      <li><strong>Pizza-Party ab ca. 12 € p.P.</strong> — Neapolitanische Pizza aus dem Steinofen</li>
                      <li><strong>Antipasti & Pizza ab ca. 18 € p.P.</strong> — Kombiniert, ideal für Gartenpartys</li>
                      <li><strong>Warmes Buffet ab ca. 25 € p.P.</strong> — Für festliche Geburtstagsfeiern</li>
                    </ul>
                    <p>
                      Alle Preise auf einen Blick:{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        Catering-Preise München
                      </LocalizedLink>
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Selbstabholung möglich
                    </h2>
                    <p>
                      Holen Sie Ihre Bestellung einfach in unserem Restaurant in der{" "}
                      <strong>Karlstraße 47a</strong> ab — das spart Lieferkosten und alles
                      ist frisch zubereitet und sorgfältig verpackt.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Whether <strong>children's birthday</strong>, milestone birthday or relaxed
                      garden party — with Italian catering your celebration becomes unforgettable.
                      STORIA offers{" "}
                      <strong>birthday catering in Munich</strong> for every taste
                      and budget: from casual pizza parties to elegant buffets.
                    </p>
                    <p>
                      All dishes are freshly prepared in our kitchen in Maxvorstadt —
                      and delivered directly to you or ready for pickup.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Packages by Party Type
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Children's & Teenager Birthday: Pizza Party
                    </h3>
                    <p>
                      The classic for every age group! Our{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        pizza party
                      </LocalizedLink>{" "}
                      features authentic Neapolitan stone-oven pizza in over 25 varieties —
                      from approx. €12 per person. Plus optional drinks and mini desserts.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Milestone Birthday: Menu or Buffet
                    </h3>
                    <p>
                      For your 30th, 50th, 60th or 70th: choose between an elegant
                      multi-course menu or a generous{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        hot buffet
                      </LocalizedLink>{" "}
                      with lasagna, ossobuco, risotto and more. From approx. €25 per person.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Garden Party: Antipasti & Pizza
                    </h3>
                    <p>
                      Perfect for summer:{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        antipasti platters
                      </LocalizedLink>{" "}
                      for sharing, plus fresh pizza and some{" "}
                      <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                        finger food bites
                      </LocalizedLink>
                      . Uncomplicated, delicious and ideal for outdoors.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Birthday Catering Prices
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Finger food from approx. €8 p.p.</strong> — Bruschetta, bites, mini portions</li>
                      <li><strong>Pizza party from approx. €12 p.p.</strong> — Neapolitan stone-oven pizza</li>
                      <li><strong>Antipasti & pizza from approx. €18 p.p.</strong> — Combined, ideal for garden parties</li>
                      <li><strong>Hot buffet from approx. €25 p.p.</strong> — For festive birthday celebrations</li>
                    </ul>
                    <p>
                      All prices at a glance:{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        Catering Prices Munich
                      </LocalizedLink>
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Self-Pickup Available
                    </h2>
                    <p>
                      Pick up your order from our restaurant at{" "}
                      <strong>Karlstraße 47a</strong> — save on delivery costs with everything
                      freshly prepared and carefully packed.
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
                {language === "de" ? "Warum STORIA für Ihren Geburtstag?" : "Why STORIA for Your Birthday?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Pizza, title: language === "de" ? "Pizza-Party" : "Pizza party", desc: language === "de" ? "Über 25 Sorten neapolitanische Steinofen-Pizza — der Hit bei Groß und Klein." : "Over 25 varieties of Neapolitan stone-oven pizza — a hit with young and old." },
                  { icon: Cake, title: language === "de" ? "Dessert-Station" : "Dessert station", desc: language === "de" ? "Tiramisù, Panna Cotta und mehr — süßer Abschluss für Ihre Feier." : "Tiramisù, panna cotta and more — sweet finale for your celebration." },
                  { icon: Users, title: language === "de" ? "5 bis 200+ Gäste" : "5 to 200+ guests", desc: language === "de" ? "Von der kleinen Feier bis zur großen Geburtstagsparty." : "From small gatherings to large birthday parties." },
                  { icon: Truck, title: language === "de" ? "Lieferung & Aufbau" : "Delivery & setup", desc: language === "de" ? "Wir liefern in ganz München — auch am Wochenende." : "We deliver throughout Munich — also on weekends." },
                  { icon: ShoppingBag, title: language === "de" ? "Selbstabholung" : "Self-pickup", desc: language === "de" ? "Abholen in der Karlstraße 47a — ohne Lieferkosten." : "Pick up at Karlstraße 47a — no delivery costs." },
                  { icon: PartyPopper, title: language === "de" ? "Für jedes Alter" : "For every age", desc: language === "de" ? "Kindergeburtstag, runder Geburtstag oder Gartenparty — wir haben das passende Paket." : "Children's birthday, milestone or garden party — we have the right package." },
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
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Der lockere Klassiker" : "The casual classic", to: "seo.pizzaCatering" as const },
                  { title: language === "de" ? "Fingerfood" : "Finger Food", desc: language === "de" ? "Elegante Häppchen" : "Elegant bites", to: "seo.fingerfoodCatering" as const },
                  { title: language === "de" ? "Catering-Preise" : "Catering Prices", desc: language === "de" ? "Transparente Übersicht" : "Transparent overview", to: "seo.cateringPreise" as const },
                  { title: language === "de" ? "Italienisches Catering" : "Italian Catering", desc: language === "de" ? "Unser komplettes Angebot" : "Our full offering", to: "seo.italienischesCatering" as const },
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
                {t.seo.geburtstagCatering.faqTitle}
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
              {language === "de" ? "Geburtstag direkt im STORIA feiern?" : "Celebrate your birthday at STORIA?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Bis 100 Gäste im Restaurant — mit Geburtstagstorte, Deko und persönlichem Service. Das Ristorante STORIA in München Maxvorstadt bietet den perfekten Rahmen für Ihre Geburtstagsfeier."
                : "Up to 100 guests at the restaurant — with birthday cake, decorations and personal service. Ristorante STORIA in Munich Maxvorstadt offers the perfect setting for your birthday celebration."}
            </p>
            <a
              href="https://www.ristorantestoria.de/geburtstagsfeier-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Geburtstagsfeier im STORIA planen" : "→ Plan your birthday at STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default GeburtstagCateringMuenchen;
