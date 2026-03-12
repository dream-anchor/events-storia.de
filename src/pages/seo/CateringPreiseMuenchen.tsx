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
import { Euro, FileText, Truck, Calculator, Building2, ShoppingBag } from "lucide-react";

const CateringPreiseMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Catering Preise München" : "Catering Prices Munich",
      url: language === "de" ? "/catering-preise-muenchen" : "/en/catering-prices-munich",
    },
  ];

  const faqItems = t.seo.cateringPreise.faq;

  const priceCategories = language === "de" ? [
    { category: "Fingerfood", price: "ab 8 €", ideal: "Empfänge, Networking", to: "seo.fingerfoodCatering" as const },
    { category: "Pizza-Party", price: "ab 12 €", ideal: "Geburtstage, lockere Feiern", to: "seo.pizzaCatering" as const },
    { category: "Antipasti-Platten", price: "ab 18 €", ideal: "Familienfeiern, Gartenpartys", to: "catering.platters" as const },
    { category: "Business Lunch", price: "ab 15 €", ideal: "Büro, Meetings, Seminare", to: "seo.bueroCatering" as const },
    { category: "Warmes Buffet", price: "ab 25 €", ideal: "Firmenfeiern, Hochzeiten", to: "catering.casseroles" as const },
    { category: "Festmenü (3 Gänge)", price: "ab 35 €", ideal: "Hochzeiten, Jubiläen", to: "events" as const },
    { category: "Premium (5 Gänge)", price: "ab 55 €", ideal: "Gala-Dinner, exklusive Events", to: "events" as const },
  ] : [
    { category: "Finger Food", price: "from €8", ideal: "Receptions, networking", to: "seo.fingerfoodCatering" as const },
    { category: "Pizza Party", price: "from €12", ideal: "Birthdays, casual parties", to: "seo.pizzaCatering" as const },
    { category: "Antipasti Platters", price: "from €18", ideal: "Family celebrations, garden parties", to: "catering.platters" as const },
    { category: "Business Lunch", price: "from €15", ideal: "Office, meetings, seminars", to: "seo.bueroCatering" as const },
    { category: "Hot Buffet", price: "from €25", ideal: "Corporate events, weddings", to: "catering.casseroles" as const },
    { category: "Set Menu (3 courses)", price: "from €35", ideal: "Weddings, anniversaries", to: "events" as const },
    { category: "Premium (5 courses)", price: "from €55", ideal: "Gala dinners, exclusive events", to: "events" as const },
  ];

  return (
    <>
      <SEO
        title={t.seo.cateringPreise.title}
        description={t.seo.cateringPreise.description}
        keywords={
          language === "de"
            ? "Catering Preise München, Was kostet Catering pro Person, Catering Kosten München, günstiges Catering München, Catering Preisliste, Buffet Preise München"
            : "catering prices Munich, how much does catering cost per person, catering costs Munich, affordable catering Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Catering Preise München" : "Catering Prices Munich",
          description:
            language === "de"
              ? "Transparente Catering-Preise in München: Fingerfood, Pizza, Buffet und Festmenüs ab 8 € pro Person."
              : "Transparent catering prices in Munich: finger food, pizza, buffet and set menus from €8 per person.",
          serviceType: "Catering Service",
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
                <Badge variant="secondary" className="text-sm">Transparente Preise</Badge>
                <Badge variant="secondary" className="text-sm">Individuelle Angebote</Badge>
                <Badge variant="secondary" className="text-sm">Lieferung inklusive</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de" ? "Catering Preise München — Was kostet Catering pro Person?" : "Catering Prices Munich — How Much Does Catering Cost Per Person?"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Faire und transparente Preise für italienisches Catering — von einfachem Fingerfood bis zum exklusiven Festmenü."
                  : "Fair and transparent prices for Italian catering — from simple finger food to exclusive set menus."}
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
                      Sie planen ein Event und möchten wissen, <strong>was Catering in München kostet</strong>?
                      Bei STORIA erhalten Sie hochwertige italienische Küche zu fairen Preisen —
                      transparent kalkuliert und individuell auf Ihre Wünsche abgestimmt.
                    </p>
                    <p>
                      Unsere Preise richten sich nach der Art des Caterings, der Personenzahl
                      und dem gewünschten Service-Level. Hier finden Sie eine Übersicht
                      unserer Ab-Preise pro Person.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Planning an event and want to know <strong>how much catering costs in Munich</strong>?
                      At STORIA, you get high-quality Italian cuisine at fair prices —
                      transparently calculated and tailored to your needs.
                    </p>
                    <p>
                      Our prices depend on the type of catering, number of guests
                      and desired service level. Here you'll find an overview
                      of our starting prices per person.
                    </p>
                  </>
                )}
              </div>

              {/* Price Table */}
              <div className="mt-12">
                <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-8">
                  {language === "de" ? "Preisübersicht — Ab-Preise pro Person" : "Price Overview — Starting Prices Per Person"}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-primary/20">
                        <th className="text-left py-4 px-4 font-medium">{language === "de" ? "Kategorie" : "Category"}</th>
                        <th className="text-left py-4 px-4 font-medium">{language === "de" ? "Ab-Preis / Person" : "From / Person"}</th>
                        <th className="text-left py-4 px-4 font-medium hidden sm:table-cell">{language === "de" ? "Ideal für" : "Ideal for"}</th>
                        <th className="text-right py-4 px-4 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceCategories.map((row, i) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="py-4 px-4 font-medium">{row.category}</td>
                          <td className="py-4 px-4 text-primary font-semibold">{row.price}</td>
                          <td className="py-4 px-4 text-sm text-muted-foreground hidden sm:table-cell">{row.ideal}</td>
                          <td className="py-4 px-4 text-right">
                            <LocalizedLink to={row.to} className="text-sm text-primary hover:underline">
                              {language === "de" ? "Details →" : "Details →"}
                            </LocalizedLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  {language === "de"
                    ? "Alle Preise sind Endpreise inkl. MwSt. Lieferkosten je nach Entfernung."
                    : "All prices are final prices incl. VAT. Delivery costs depending on distance."}
                </p>
              </div>

              {/* Content continues */}
              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6 mt-12">
                {language === "de" ? (
                  <>
                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Was beeinflusst den Preis?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Personenzahl</strong> — Größere Gruppen profitieren von besseren Konditionen</li>
                      <li><strong>Menüwahl</strong> — Von einfachem Fingerfood bis zum mehrgängigen Festmenü</li>
                      <li><strong>Lieferentfernung</strong> — Im Münchner Stadtgebiet Pauschale, außerhalb nach km</li>
                      <li><strong>Service-Level</strong> — Lieferung, Aufbau, Service-Personal, Abbau</li>
                      <li><strong>Geschirr & Ausstattung</strong> — Einweg oder Porzellan/Glas</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Beispiel: Catering für 20 Personen
                    </h2>
                    <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                      {[
                        { variant: "Einfach", menu: "Fingerfood & Bruschette", price: "ab ca. 160 €", detail: "8 € × 20 Pers." },
                        { variant: "Mittel", menu: "Pizza-Party mit Salat", price: "ab ca. 300 €", detail: "15 € × 20 Pers." },
                        { variant: "Premium", menu: "Warmes Buffet mit Antipasti", price: "ab ca. 600 €", detail: "30 € × 20 Pers." },
                      ].map((ex, i) => (
                        <div key={i} className="rounded-2xl border bg-card p-6 text-center">
                          <p className="text-sm font-medium text-primary mb-1">{ex.variant}</p>
                          <p className="text-lg font-semibold mb-2">{ex.price}</p>
                          <p className="text-sm text-muted-foreground">{ex.menu}</p>
                          <p className="text-xs text-muted-foreground mt-1">({ex.detail})</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preise sind Richtwerte. Lieferkosten und Service-Aufschläge kommen ggf. hinzu.{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        Kontaktieren Sie uns
                      </LocalizedLink>{" "}
                      für ein verbindliches Angebot.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Netto-Preise für Geschäftskunden
                    </h2>
                    <p>
                      Für Firmen und Geschäftskunden erstellen wir selbstverständlich{" "}
                      <strong>Netto-Rechnungen</strong> mit ausgewiesener USt. Geben Sie bei Ihrer
                      Anfrage einfach Ihre Firmenadresse und USt-IdNr. an — wir kümmern
                      uns um den Rest. Mehr Infos zum{" "}
                      <LocalizedLink to="seo.bueroCatering" className="underline hover:text-foreground transition-colors">
                        Büro-Catering
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Selbstabholung spart Lieferkosten
                    </h2>
                    <p>
                      Sie möchten Lieferkosten sparen? Holen Sie Ihre Bestellung einfach in
                      unserem Restaurant in der <strong>Karlstraße 47a, München Maxvorstadt</strong> ab.
                      Alles wird frisch zubereitet und sorgfältig verpackt — inklusive
                      Aufwärm-Anleitung wo nötig.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      What Influences the Price?
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Number of guests</strong> — Larger groups benefit from better rates</li>
                      <li><strong>Menu choice</strong> — From simple finger food to multi-course set menus</li>
                      <li><strong>Delivery distance</strong> — Flat rate within Munich, per km outside</li>
                      <li><strong>Service level</strong> — Delivery, setup, service staff, cleanup</li>
                      <li><strong>Tableware & equipment</strong> — Disposable or porcelain/glass</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Example: Catering for 20 People
                    </h2>
                    <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                      {[
                        { variant: "Simple", menu: "Finger food & bruschetta", price: "from approx. €160", detail: "€8 × 20 ppl." },
                        { variant: "Medium", menu: "Pizza party with salad", price: "from approx. €300", detail: "€15 × 20 ppl." },
                        { variant: "Premium", menu: "Hot buffet with antipasti", price: "from approx. €600", detail: "€30 × 20 ppl." },
                      ].map((ex, i) => (
                        <div key={i} className="rounded-2xl border bg-card p-6 text-center">
                          <p className="text-sm font-medium text-primary mb-1">{ex.variant}</p>
                          <p className="text-lg font-semibold mb-2">{ex.price}</p>
                          <p className="text-sm text-muted-foreground">{ex.menu}</p>
                          <p className="text-xs text-muted-foreground mt-1">({ex.detail})</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Prices are indicative. Delivery costs and service charges may apply.{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">
                        Contact us
                      </LocalizedLink>{" "}
                      for a binding quote.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Net Prices for Business Customers
                    </h2>
                    <p>
                      For companies and business customers, we provide{" "}
                      <strong>net invoices</strong> with VAT shown separately. Simply provide your
                      company address and VAT ID with your inquiry — we take care of the rest.
                      More about{" "}
                      <LocalizedLink to="seo.bueroCatering" className="underline hover:text-foreground transition-colors">
                        office catering
                      </LocalizedLink>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Self-Pickup Saves Delivery Costs
                    </h2>
                    <p>
                      Want to save on delivery costs? Pick up your order from our restaurant
                      at <strong>Karlstraße 47a, Munich Maxvorstadt</strong>.
                      Everything freshly prepared and carefully packed — including
                      reheating instructions where needed.
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
                {language === "de" ? "Warum STORIA Catering?" : "Why STORIA Catering?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Euro, title: language === "de" ? "Faire Preise" : "Fair prices", desc: language === "de" ? "Transparente Kalkulation ohne versteckte Kosten." : "Transparent pricing with no hidden costs." },
                  { icon: FileText, title: language === "de" ? "Individuelle Angebote" : "Custom quotes", desc: language === "de" ? "Jedes Event ist anders — wir erstellen Ihr maßgeschneidertes Angebot." : "Every event is different — we create your tailored quote." },
                  { icon: Truck, title: language === "de" ? "Lieferung & Aufbau" : "Delivery & setup", desc: language === "de" ? "Lieferung im Münchner Stadtgebiet, Aufbau und Abbau optional." : "Delivery within Munich, setup and cleanup optional." },
                  { icon: Calculator, title: language === "de" ? "Netto für Firmen" : "Net for businesses", desc: language === "de" ? "Netto-Rechnungen mit ausgewiesener USt für Geschäftskunden." : "Net invoices with separate VAT for business customers." },
                  { icon: Building2, title: language === "de" ? "Im Restaurant feiern" : "Celebrate at the restaurant", desc: language === "de" ? "Alternativ: Event im Ristorante STORIA für bis zu 180 Gäste." : "Alternative: event at Ristorante STORIA for up to 180 guests." },
                  { icon: ShoppingBag, title: language === "de" ? "Selbstabholung möglich" : "Self-pickup available", desc: language === "de" ? "Abholen in der Karlstraße 47a — ohne Lieferkosten." : "Pick up at Karlstraße 47a — no delivery costs." },
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

          {/* Anlass-Section: All catering pages */}
          <section className="py-16 md:py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Alle Catering-Kategorien" : "All Catering Categories"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Fingerfood" : "Finger Food", desc: language === "de" ? "Häppchen ab 8 € p.P." : "Bites from €8 p.p.", to: "seo.fingerfoodCatering" as const },
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Pizza-Party ab 12 € p.P." : "Pizza party from €12 p.p.", to: "seo.pizzaCatering" as const },
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Business Events & Feiern" : "Business events & celebrations", to: "seo.firmenfeier" as const },
                  { title: language === "de" ? "Büro-Catering" : "Office Catering", desc: language === "de" ? "Business Lunch ab 15 € p.P." : "Business lunch from €15 p.p.", to: "seo.bueroCatering" as const },
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
                {t.seo.cateringPreise.faqTitle}
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
              {language === "de" ? "Lieber direkt im Restaurant feiern?" : "Prefer celebrating at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA in München Maxvorstadt bietet Events direkt im Restaurant — stimmungsvolles Ambiente, italienische Küche und persönlicher Service für bis zu 180 Gäste."
                : "Ristorante STORIA in Munich Maxvorstadt offers events at the restaurant — atmospheric ambience, Italian cuisine and personal service for up to 180 guests."}
            </p>
            <a
              href="https://www.ristorantestoria.de/italienisches-restaurant-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Essen direkt im STORIA" : "→ Dine directly at STORIA"}
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

export default CateringPreiseMuenchen;
