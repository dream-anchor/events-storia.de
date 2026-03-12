import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Heart, ChefHat, Users, Leaf, Truck, CalendarCheck, UtensilsCrossed } from "lucide-react";

const HochzeitCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Hochzeit Catering München" : "Wedding Catering Munich",
      url: language === "de" ? "/hochzeit-catering-muenchen" : "/en/wedding-catering-munich",
    },
  ];

  const faqItems = t.seo.hochzeitCatering.faq;

  return (
    <>
      <SEO
        title={t.seo.hochzeitCatering.title}
        description={t.seo.hochzeitCatering.description}
        keywords={
          language === "de"
            ? "Hochzeit Catering München, Hochzeitsmenü München, italienisches Hochzeits-Catering, Hochzeitsbuffet München, Hochzeitsessen München, Catering Traumhochzeit"
            : "wedding catering Munich, Italian wedding menu Munich, wedding buffet Munich, wedding food Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Hochzeit Catering München" : "Wedding Catering Munich",
          description:
            language === "de"
              ? "Italienisches Catering für Hochzeiten in München: Mehrgängige Menüs, Fingerfood-Empfänge und Buffets für 20 bis 200 Gäste."
              : "Italian catering for weddings in Munich: multi-course menus, finger food receptions and buffets for 20 to 200 guests.",
          serviceType: "Wedding Catering",
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
                <Badge variant="secondary" className="text-sm">Hochzeits-Catering</Badge>
                <Badge variant="secondary" className="text-sm">Italienische Menüs</Badge>
                <Badge variant="secondary" className="text-sm">20–200 Gäste</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Hochzeit Catering München — Italienisches Menü für Ihre Traumhochzeit"
                  : "Wedding Catering Munich — Italian Menu for Your Dream Wedding"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Von der Aperitivo-Stunde bis zum Dessert — wir machen Ihre Hochzeit zu einem kulinarischen Highlight mit authentischer italienischer Küche."
                  : "From the aperitivo hour to dessert — we make your wedding a culinary highlight with authentic Italian cuisine."}
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
                      Eine Hochzeit verdient ein Catering, das genauso unvergesslich ist wie
                      der Tag selbst. <strong>Italienische Küche</strong> ist dafür die perfekte Wahl:
                      gesellig, vielfältig und von Herzen gemacht. STORIA bietet Ihnen{" "}
                      <strong>individuelles Hochzeits-Catering in München</strong> — von der
                      Aperitivo-Stunde über das Hauptmenü bis zum süßen Abschluss.
                    </p>
                    <p>
                      Ob Sie eine intime Feier mit 20 Gästen oder eine große Hochzeit mit
                      200 Gästen planen — wir passen unser Angebot an Ihre Wünsche,
                      Ihre Location und Ihr Budget an.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Menü-Optionen für Ihre Hochzeit
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Empfang mit Fingerfood
                    </h3>
                    <p>
                      Begrüßen Sie Ihre Gäste mit einem eleganten{" "}
                      <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                        Fingerfood-Empfang
                      </LocalizedLink>
                      : Bruschette, Burrata, Garnelen-Häppchen und saisonale Kreationen —
                      perfekt als Aperitivo vor dem Dinner.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Mehrgängiges Hochzeitsmenü
                    </h3>
                    <p>
                      Unser klassisches Hochzeitsmenü umfasst 3 bis 5 Gänge: von
                      Antipasti über Primo (Pasta/Risotto) und Secondo (Fisch oder Fleisch)
                      bis zum italienischen Dessert. Jeder Gang wird individuell
                      auf Ihre Vorlieben abgestimmt.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Italienisches Hochzeitsbuffet
                    </h3>
                    <p>
                      Für eine lockere, gesellige Atmosphäre: Unser Buffet bietet{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Antipasti-Platten
                      </LocalizedLink>,{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        warme Hauptgerichte
                      </LocalizedLink>{" "}
                      und eine{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        Dessert-Station
                      </LocalizedLink>{" "}
                      — Ihre Gäste bedienen sich nach Lust und Laune.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      A wedding deserves catering that is just as unforgettable as the
                      day itself. <strong>Italian cuisine</strong> is the perfect choice:
                      convivial, diverse and made from the heart. STORIA offers{" "}
                      <strong>customised wedding catering in Munich</strong> — from the
                      aperitivo hour through the main course to the sweet finale.
                    </p>
                    <p>
                      Whether you're planning an intimate celebration with 20 guests or
                      a grand wedding with 200 — we tailor our offering to your wishes,
                      your venue and your budget.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Menu Options for Your Wedding
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Reception with Finger Food
                    </h3>
                    <p>
                      Welcome your guests with an elegant{" "}
                      <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                        finger food reception
                      </LocalizedLink>
                      : bruschetta, burrata, prawn canapés and seasonal creations —
                      perfect as an aperitivo before dinner.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Multi-Course Wedding Menu
                    </h3>
                    <p>
                      Our classic wedding menu includes 3 to 5 courses: from
                      antipasti through primo (pasta/risotto) and secondo (fish or meat)
                      to Italian dessert. Every course is individually
                      tailored to your preferences.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Italian Wedding Buffet
                    </h3>
                    <p>
                      For a relaxed, convivial atmosphere: our buffet features{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        antipasti platters
                      </LocalizedLink>,{" "}
                      <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">
                        warm main courses
                      </LocalizedLink>{" "}
                      and a{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        dessert station
                      </LocalizedLink>{" "}
                      — your guests help themselves as they please.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="py-16 md:py-20 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "So planen wir Ihr Hochzeits-Catering" : "How We Plan Your Wedding Catering"}
              </h2>
              <div className="max-w-3xl mx-auto space-y-8">
                {(language === "de" ? [
                  { step: "1", title: "Erstgespräch", desc: "Sie erzählen uns von Ihrer Hochzeit — Gästezahl, Location, Stil und kulinarische Wünsche." },
                  { step: "2", title: "Menüvorschlag", desc: "Wir erstellen ein individuelles Menü mit Preisübersicht basierend auf Ihren Vorstellungen." },
                  { step: "3", title: "Verkostung", desc: "Optional: Probieren Sie Ihr Wunschmenü vorab bei einem Verkostungstermin in unserem Restaurant." },
                  { step: "4", title: "Feinplanung", desc: "Wir klären alle Details: Zeitplan, Allergien, Service-Personal, Equipment und Aufbau." },
                  { step: "5", title: "Der große Tag", desc: "Wir liefern, bauen auf und servieren — Sie genießen Ihren Tag ohne Stress." },
                  { step: "6", title: "Abbau", desc: "Nach der Feier räumen wir alles auf. Sie müssen sich um nichts kümmern." },
                ] : [
                  { step: "1", title: "Initial consultation", desc: "Tell us about your wedding — guest count, venue, style and culinary wishes." },
                  { step: "2", title: "Menu proposal", desc: "We create a customised menu with price overview based on your ideas." },
                  { step: "3", title: "Tasting", desc: "Optional: try your desired menu in advance at a tasting in our restaurant." },
                  { step: "4", title: "Final planning", desc: "We clarify all details: timeline, allergies, service staff, equipment and setup." },
                  { step: "5", title: "The big day", desc: "We deliver, set up and serve — you enjoy your day stress-free." },
                  { step: "6", title: "Cleanup", desc: "After the celebration, we clear everything away. You don't need to worry about a thing." },
                ]).map((item, i) => (
                  <div key={i} className="flex gap-6 items-start">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-medium text-lg mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* USP Grid */}
          <section className="py-16 md:py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Warum STORIA für Ihre Hochzeit?" : "Why STORIA for Your Wedding?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: ChefHat, title: language === "de" ? "Individuelle Menüplanung" : "Custom menu planning", desc: language === "de" ? "Jedes Hochzeitsmenü wird individuell auf Ihre Wünsche abgestimmt." : "Every wedding menu is individually tailored to your wishes." },
                  { icon: Users, title: language === "de" ? "Professioneller Service" : "Professional service", desc: language === "de" ? "Erfahrenes Service-Personal für einen reibungslosen Ablauf." : "Experienced service staff for a smooth event." },
                  { icon: Leaf, title: language === "de" ? "Vegetarisch & vegan" : "Vegetarian & vegan", desc: language === "de" ? "Individuelle vegetarische und vegane Menüs auf Wunsch." : "Custom vegetarian and vegan menus on request." },
                  { icon: Truck, title: language === "de" ? "Lieferung zur Location" : "Delivery to your venue", desc: language === "de" ? "Wir liefern an jede Location in München und Umgebung." : "We deliver to any venue in Munich and surrounding areas." },
                  { icon: UtensilsCrossed, title: language === "de" ? "Verkostung möglich" : "Tasting available", desc: language === "de" ? "Probieren Sie Ihr Menü vorab bei einem Verkostungstermin." : "Try your menu in advance at a tasting appointment." },
                  { icon: Heart, title: language === "de" ? "Erfahrung mit Hochzeiten" : "Wedding experience", desc: language === "de" ? "Über 15 Jahre Erfahrung mit Hochzeits-Catering in München." : "Over 15 years of experience with wedding catering in Munich." },
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
          <section className="py-16 md:py-20 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-center mb-12">
                {language === "de" ? "Weitere Catering-Angebote" : "More Catering Options"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Fingerfood Empfang" : "Finger Food Reception", desc: language === "de" ? "Aperitivo vor dem Dinner" : "Aperitivo before dinner", to: "seo.fingerfoodCatering" as const },
                  { title: language === "de" ? "Catering-Preise" : "Catering Prices", desc: language === "de" ? "Transparente Preisübersicht" : "Transparent pricing", to: "seo.cateringPreise" as const },
                  { title: language === "de" ? "Italienisches Catering" : "Italian Catering", desc: language === "de" ? "Unser komplettes Angebot" : "Our full offering", to: "seo.italienischesCatering" as const },
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
                {t.seo.hochzeitCatering.faqTitle}
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
              {language === "de" ? "Hochzeitsfeier direkt im STORIA?" : "Wedding celebration at STORIA?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Bis 100 Gäste direkt im Restaurant — mit Location, Service und allem drum und dran. Das Ristorante STORIA in München Maxvorstadt bietet das perfekte Ambiente für Ihre Hochzeitsfeier."
                : "Up to 100 guests directly at the restaurant — with venue, service and everything included. Ristorante STORIA in Munich Maxvorstadt offers the perfect ambience for your wedding celebration."}
            </p>
            <a
              href="https://www.ristorantestoria.de/hochzeitsfeier-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Hochzeitsfeier im STORIA planen" : "→ Plan your wedding at STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default HochzeitCateringMuenchen;
