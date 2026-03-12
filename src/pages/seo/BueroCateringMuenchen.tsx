import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Clock, Truck, Users, Receipt, Building2, Repeat } from "lucide-react";

const BueroCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Büro Catering München" : "Office Catering Munich",
      url: language === "de" ? "/buero-catering-muenchen" : "/en/office-catering-munich",
    },
  ];

  const faqItems = t.seo.bueroCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.bueroCatering.title}
        description={t.seo.bueroCatering.description}
        keywords={
          language === "de"
            ? "Büro Catering München, Office Catering München, Business Lunch München, Meeting Catering, Team Lunch München, messe catering, seminar catering"
            : "office catering Munich, business lunch Munich, meeting catering Munich, team lunch Munich, trade fair catering"
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

          {/* Hero */}
          <section className="relative py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4 text-center">
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <Badge variant="secondary" className="text-sm">Business Lunch</Badge>
                <Badge variant="secondary" className="text-sm">Lieferung ins Büro</Badge>
                <Badge variant="secondary" className="text-sm">Ab 5 Personen</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de" ? "Büro Catering in München" : "Office Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Italienischer Business Lunch, Team-Lunch und Meeting-Catering – frisch geliefert ins Büro."
                  : "Italian business lunch, team lunch and meeting catering – freshly delivered to your office."}
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
                      <li><strong>Team-Lunch</strong> –{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">Sharing-Platten</LocalizedLink>{" "}
                        mit Antipasti, Bruschette und Salaten</li>
                      <li><strong>Meeting-Catering</strong> –{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">Fingerfood und Häppchen</LocalizedLink>{" "}
                        für Besprechungen, Workshops und Konferenzen</li>
                      <li><strong><LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">Pizza-Lunch</LocalizedLink></strong>{" "}
                        – Neapolitanische Steinofen-Pizza als beliebter Team-Klassiker</li>
                      <li><strong>Warme Mahlzeiten</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">Pasta, Aufläufe und warme Gerichte</LocalizedLink>{" "}
                        für ein sättigendes Mittagessen</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Auch für Messen & Seminare
                    </h2>
                    <p>
                      Neben dem klassischen Büro-Catering liefern wir auch direkt zu <strong>Messen und Seminaren</strong>:
                      Zur <strong>Messe München/Riem</strong>, zum ICM, zum MOC oder zu Seminarräumen in ganz München.
                      Kontaktieren Sie uns für spezielle <strong>Messe-Catering-Pakete</strong> und Seminar-Verpflegung.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Beliebt bei Münchner Unternehmen
                    </h2>
                    <p>
                      Zahlreiche Unternehmen in der Münchner Innenstadt, Maxvorstadt, Schwabing und
                      darüber hinaus vertrauen auf unser Büro-Catering. Ob Start-up, Agentur oder
                      Konzern – wir passen unser Angebot an Ihre Bedürfnisse an.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Auch für besondere Büro-Anlässe
                    </h2>
                    <p>
                      Neben dem regulären Business Lunch bieten wir auch Catering für besondere
                      Büro-Events: Onboarding-Lunch für neue Mitarbeiter,{" "}
                      <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">Firmenjubiläen</LocalizedLink>
                      , Projektabschlüsse oder{" "}
                      <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">die Weihnachtsfeier im Büro</LocalizedLink>
                      . Mit{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">hausgemachtem Tiramisù</LocalizedLink>{" "}
                      als Nachtisch wird jedes Büro-Essen zum Highlight.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Jetzt Büro-Catering bestellen
                    </h2>
                    <p>
                      Bestellen Sie bequem online oder{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">kontaktieren Sie uns</LocalizedLink>{" "}
                      telefonisch. Wir beraten Sie gerne und erstellen Ihnen ein individuelles Angebot
                      für regelmäßiges oder einmaliges Büro-Catering. Netto-Rechnungen für Geschäftskunden
                      sind selbstverständlich möglich.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      A good lunch strengthens the team and makes the working day more productive. With
                      our <strong>office catering in Munich</strong>, we bring fresh Italian cuisine
                      directly to your desk – uncomplicated, on time and always ready to serve.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Our Office Catering Formats
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Team Lunch</strong> –{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">Sharing platters</LocalizedLink>{" "}
                        with antipasti, bruschetta and salads</li>
                      <li><strong>Meeting Catering</strong> –{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">Finger food and canapés</LocalizedLink>{" "}
                        for meetings, workshops and conferences</li>
                      <li><strong><LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">Pizza Lunch</LocalizedLink></strong>{" "}
                        – Neapolitan stone-oven pizza as the popular team classic</li>
                      <li><strong>Hot Meals</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">Pasta, casseroles and hot dishes</LocalizedLink>{" "}
                        for a filling lunch</li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Also for Trade Fairs & Seminars
                    </h2>
                    <p>
                      Besides classic office catering, we also deliver directly to <strong>trade fairs and seminars</strong>:
                      to <strong>Messe München/Riem</strong>, ICM, MOC or seminar rooms throughout Munich.
                      Contact us for special <strong>trade fair catering packages</strong>.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Popular with Munich Businesses
                    </h2>
                    <p>
                      Numerous companies in Munich's city centre, Maxvorstadt, Schwabing and beyond
                      trust our office catering. Whether start-up, agency or corporation – we adapt
                      our offering to your needs.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Also for Special Office Occasions
                    </h2>
                    <p>
                      Besides regular business lunch, we also offer catering for special office events:
                      onboarding lunch,{" "}
                      <LocalizedLink to="seo.firmenfeier" className="underline hover:text-foreground transition-colors">company anniversaries</LocalizedLink>
                      , project completions or{" "}
                      <LocalizedLink to="seo.weihnachtsfeier" className="underline hover:text-foreground transition-colors">the Christmas party at the office</LocalizedLink>
                      . With{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">homemade tiramisù</LocalizedLink>{" "}
                      for dessert, every office meal becomes a highlight.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Order Office Catering Now
                    </h2>
                    <p>
                      Order conveniently online or{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">contact us</LocalizedLink>{" "}
                      by phone. Net invoices for business customers are available as standard.
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
                {language === "de" ? "Warum Büro-Catering von STORIA?" : "Why Office Catering from STORIA?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Clock, title: language === "de" ? "Pünktlich geliefert" : "Delivered on time", desc: language === "de" ? "Lieferung zur gewünschten Uhrzeit — verlässlich wie ein Uhrwerk." : "Delivery at your preferred time — reliable as clockwork." },
                  { icon: Users, title: language === "de" ? "Ab 5 Personen" : "From 5 people", desc: language === "de" ? "Ideal für kleine Teams, Meetings und Workshops." : "Ideal for small teams, meetings and workshops." },
                  { icon: Repeat, title: language === "de" ? "Stammkunden-Konditionen" : "Regular customer rates", desc: language === "de" ? "Sonderkonditionen für regelmäßige Bestellungen." : "Special rates for regular orders." },
                  { icon: Truck, title: language === "de" ? "Auch zur Messe" : "Also to trade fairs", desc: language === "de" ? "Lieferung zur Messe München/Riem, ICM und MOC." : "Delivery to Messe München/Riem, ICM and MOC." },
                  { icon: Receipt, title: language === "de" ? "Netto-Rechnungen" : "Net invoices", desc: language === "de" ? "Netto-Rechnungen für Geschäftskunden auf Wunsch." : "Net invoices for business customers on request." },
                  { icon: Building2, title: language === "de" ? "Umweltfreundlich" : "Eco-friendly", desc: language === "de" ? "Nachhaltige Verpackungen und umweltbewusste Lieferung." : "Sustainable packaging and eco-conscious delivery." },
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
                {language === "de" ? "Perfekt für Ihren Büro-Anlass" : "Perfect for Your Office Occasion"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Team-Lunch" : "Team Lunch", desc: language === "de" ? "Wöchentliches Mittagessen für das Team" : "Weekly lunch for the team", to: "seo.italienischesCatering" as const },
                  { title: language === "de" ? "Meeting-Catering" : "Meeting Catering", desc: language === "de" ? "Fingerfood und Häppchen für Meetings" : "Finger food for meetings", to: "catering.fingerfood" as const },
                  { title: language === "de" ? "Pizza-Lunch" : "Pizza Lunch", desc: language === "de" ? "Der beliebte Team-Klassiker" : "The popular team classic", to: "seo.pizzaCatering" as const },
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Jubiläum, Sommerfest & mehr" : "Anniversary, summer party & more", to: "seo.firmenfeier" as const },
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
                {t.seo.bueroCatering.faqTitle}
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
              {language === "de" ? "Lieber Mittagessen direkt im Restaurant?" : "Prefer lunch directly at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA in München Maxvorstadt serviert täglich ein Mittagsmenü – frisch gekocht, mit wechselnden Pasta- und Pizzaspecials."
                : "Ristorante STORIA in Munich Maxvorstadt serves a daily lunch menu – freshly cooked, with changing pasta and pizza specials."}
            </p>
            <a
              href="https://www.ristorantestoria.de/lunch-muenchen-maxvorstadt/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Mittagsmenü im STORIA entdecken" : "→ Discover the lunch menu at STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default BueroCateringMuenchen;
