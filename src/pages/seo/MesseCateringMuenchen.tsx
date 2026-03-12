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
import { Clock, FileText, Truck, Users, ChefHat, Settings } from "lucide-react";

const MesseCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Messe Catering München" : "Trade Fair Catering Munich",
      url: language === "de" ? "/messe-catering-muenchen" : "/en/trade-fair-catering-munich",
    },
  ];

  const faqItems = t.seo.messeCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.messeCatering.title}
        description={t.seo.messeCatering.description}
        keywords={
          language === "de"
            ? "Messe Catering München, Messecatering, Seminar Catering München, Standverpflegung Messe, Messe München Catering, Catering ICM München, Catering MOC München"
            : "trade fair catering Munich, fair catering, seminar catering Munich, exhibition catering, Messe München catering"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Messe Catering München" : "Trade Fair Catering Munich",
          description:
            language === "de"
              ? "Messe-Catering in München: Standverpflegung, Kundenempfang, Team-Lunch und After-Fair-Dinner für alle Messestandorte."
              : "Trade fair catering in Munich: stand catering, client receptions, team lunches and after-fair dinners for all trade fair venues.",
          serviceType: "Trade Fair Catering",
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
                <Badge variant="secondary" className="text-sm">🏢 Messe & Seminar</Badge>
                <Badge variant="secondary" className="text-sm">📍 Bis Messe Riem</Badge>
                <Badge variant="secondary" className="text-sm">📄 Netto-Rechnung</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Messe-Catering München — Standverpflegung, Empfang & Team-Lunch"
                  : "Trade Fair Catering Munich — Stand Catering, Receptions & Team Lunch"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Italienisches Catering für Messen, Seminare und Kongresse in München — pünktlich, professionell und mit Netto-Rechnung."
                  : "Italian catering for trade fairs, seminars and conferences in Munich — punctual, professional and with net invoicing."}
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
                      Sie organisieren einen <strong>Messestand in München</strong> und suchen
                      zuverlässiges Catering? STORIA liefert{" "}
                      <strong>italienisches Messe-Catering</strong> direkt zu Ihrem Stand — von der
                      Standverpflegung über den Kundenempfang bis zum After-Fair-Dinner für Ihr Team.
                    </p>
                    <p>
                      Als erfahrener <strong>Messecaterer in München</strong> wissen wir: Auf Messen
                      zählt Pünktlichkeit, Flexibilität und ein professioneller Auftritt. Deshalb
                      liefern wir termingenau, stellen ordnungsgemäße B2B-Rechnungen aus und passen
                      uns an kurzfristige Änderungen an.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Messe-Standorte, die wir beliefern
                    </h2>
                  </>
                ) : (
                  <>
                    <p>
                      Organising a <strong>trade fair stand in Munich</strong> and looking for
                      reliable catering? STORIA delivers{" "}
                      <strong>Italian trade fair catering</strong> directly to your stand — from
                      stand catering to client receptions to after-fair dinners for your team.
                    </p>
                    <p>
                      As an experienced <strong>trade fair caterer in Munich</strong>, we know:
                      at trade fairs, punctuality, flexibility and a professional appearance are
                      key. That's why we deliver on time, issue proper B2B invoices and adapt
                      to short-notice changes.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Trade Fair Venues We Serve
                    </h2>
                  </>
                )}
              </div>

              {/* Messe-Standorte */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 mb-10">
                {(language === "de" ? [
                  { name: "Messe München / Riem", desc: "Alle Hallen & Freigelände" },
                  { name: "ICM München", desc: "Internationales Congress Center" },
                  { name: "MOC München", desc: "Veranstaltungscenter Freimann" },
                  { name: "TU München", desc: "Seminare & Konferenzen" },
                  { name: "Zenith München", desc: "Kultur- & Eventhalle" },
                  { name: "Weitere Locations", desc: "Auf Anfrage in München & Umland" },
                ] : [
                  { name: "Messe München / Riem", desc: "All halls & outdoor areas" },
                  { name: "ICM Munich", desc: "International Congress Center" },
                  { name: "MOC Munich", desc: "Event center Freimann" },
                  { name: "TU Munich", desc: "Seminars & conferences" },
                  { name: "Zenith Munich", desc: "Culture & event venue" },
                  { name: "Other locations", desc: "On request in Munich & surrounding areas" },
                ]).map((venue, i) => (
                  <div key={i} className="p-4 rounded-xl border bg-card">
                    <h3 className="font-medium text-sm mb-1">{venue.name}</h3>
                    <p className="text-xs text-muted-foreground">{venue.desc}</p>
                  </div>
                ))}
              </div>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Unsere Messe-Catering-Pakete
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Standverpflegung (ab 12 € p.P.)
                    </h3>
                    <p>
                      Snacks, belegte Brötchen und{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        italienisches Fingerfood
                      </LocalizedLink>{" "}
                      für Ihr Standteam — ideal für lange Messetage mit durchgehendem Betrieb.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Kundenempfang (ab 18 € p.P.)
                    </h3>
                    <p>
                      Hochwertige{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Antipasti-Platten
                      </LocalizedLink>
                      , Bruschette und Fingerfood für den professionellen Empfang
                      Ihrer Geschäftspartner und Kunden am Messestand.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Team-Lunch (ab 15 € p.P.)
                    </h3>
                    <p>
                      Warme{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        Pasta-Gerichte
                      </LocalizedLink>
                      , Salate und leichte Hauptgerichte — perfekt für die Mittagspause
                      Ihres Messe-Teams. Lieferung pünktlich zum gewünschten Zeitpunkt.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      After-Fair-Dinner (ab 30 € p.P.)
                    </h3>
                    <p>
                      Das Highlight nach dem Messetag: Ein komplettes italienisches Dinner
                      mit Antipasti, Hauptgängen und{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        Desserts
                      </LocalizedLink>
                      . Ideal für Kundenbindung und Team-Events.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      B2B-Service für Unternehmen
                    </h2>
                    <p>
                      Als <strong>Messe-Caterer für Unternehmen</strong> bieten wir Ihnen alle
                      Vorteile eines professionellen B2B-Partners: ordnungsgemäße Netto-Rechnungen
                      mit ausgewiesener MwSt., flexible Mengenänderungen bis 48 Stunden vor
                      dem Event und auf Wunsch individuelle Branding-Optionen für Ihren Messeauftritt.
                    </p>
                    <p>
                      Alle Preise im Überblick:{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        Catering-Preise München
                      </LocalizedLink>
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Trade Fair Catering Packages
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Stand Catering (from €12 p.p.)
                    </h3>
                    <p>
                      Snacks, filled rolls and{" "}
                      <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">
                        Italian finger food
                      </LocalizedLink>{" "}
                      for your stand team — ideal for long trade fair days with continuous operation.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Client Reception (from €18 p.p.)
                    </h3>
                    <p>
                      Premium{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        antipasti platters
                      </LocalizedLink>
                      , bruschetta and finger food for the professional reception
                      of your business partners and clients at your trade fair stand.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Team Lunch (from €15 p.p.)
                    </h3>
                    <p>
                      Hot{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        pasta dishes
                      </LocalizedLink>
                      , salads and light main courses — perfect for your trade fair team's
                      lunch break. Delivery punctually at your desired time.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      After-Fair Dinner (from €30 p.p.)
                    </h3>
                    <p>
                      The highlight after the trade fair day: a complete Italian dinner
                      with antipasti, main courses and{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        desserts
                      </LocalizedLink>
                      . Ideal for client retention and team events.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      B2B Service for Companies
                    </h2>
                    <p>
                      As a <strong>trade fair caterer for companies</strong>, we offer all the
                      advantages of a professional B2B partner: proper net invoices with itemised
                      VAT, flexible quantity changes up to 48 hours before the event and
                      custom branding options for your trade fair appearance on request.
                    </p>
                    <p>
                      All prices at a glance:{" "}
                      <LocalizedLink to="seo.cateringPreise" className="underline hover:text-foreground transition-colors">
                        Catering Prices Munich
                      </LocalizedLink>
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
                {language === "de" ? "Warum STORIA für Messe-Catering?" : "Why STORIA for Trade Fair Catering?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Clock, title: language === "de" ? "Pünktliche Lieferung" : "Punctual delivery", desc: language === "de" ? "Termingerechte Lieferung — auch bei engem Messe-Zeitplan." : "On-time delivery — even with tight trade fair schedules." },
                  { icon: FileText, title: language === "de" ? "Netto-Rechnungen" : "Net invoicing", desc: language === "de" ? "Ordnungsgemäße B2B-Rechnungen mit ausgewiesener MwSt." : "Proper B2B invoices with itemised VAT." },
                  { icon: Settings, title: language === "de" ? "Branding-Optionen" : "Branding options", desc: language === "de" ? "Individuelle Servietten und Menükarten mit Ihrem Logo." : "Custom napkins and menu cards with your logo." },
                  { icon: Users, title: language === "de" ? "Flexible Mengen" : "Flexible quantities", desc: language === "de" ? "Mengenänderungen bis 48h vor dem Event möglich." : "Quantity changes possible up to 48h before the event." },
                  { icon: ChefHat, title: language === "de" ? "Frisch zubereitet" : "Freshly prepared", desc: language === "de" ? "Alles wird am Tag der Messe frisch in unserer Küche gekocht." : "Everything freshly cooked in our kitchen on the day of the fair." },
                  { icon: Truck, title: language === "de" ? "Alle Messe-Standorte" : "All fair venues", desc: language === "de" ? "Lieferung zu Messe Riem, ICM, MOC und weiteren Locations." : "Delivery to Messe Riem, ICM, MOC and other venues." },
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
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Events & Team-Feiern" : "Events & team celebrations", to: "seo.firmenfeier" as const },
                  { title: language === "de" ? "Büro-Catering" : "Office Catering", desc: language === "de" ? "Lunch & Meetings" : "Lunch & meetings", to: "seo.bueroCatering" as const },
                  { title: language === "de" ? "Lieferservice" : "Delivery Service", desc: language === "de" ? "Alles über unsere Lieferung" : "All about our delivery", to: "seo.lieferservice" as const },
                  { title: language === "de" ? "Catering-Preise" : "Catering Prices", desc: language === "de" ? "Transparente Übersicht" : "Transparent overview", to: "seo.cateringPreise" as const },
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
                {t.seo.messeCatering.faqTitle}
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
              {language === "de" ? "Lieber Business-Lunch im Restaurant?" : "Prefer a business lunch at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA in München Maxvorstadt bietet tägliche Mittagsmenüs und ist der ideale Ort für Geschäftsessen während der Messe — nur wenige Minuten von der Innenstadt."
                : "Ristorante STORIA in Munich Maxvorstadt offers daily lunch menus and is the ideal place for business lunches during the fair — just minutes from the city centre."}
            </p>
            <a
              href="https://www.ristorantestoria.de/lunch-muenchen-maxvorstadt/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Business-Lunch im STORIA entdecken" : "→ Discover business lunch at STORIA"}
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

export default MesseCateringMuenchen;
