import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Pizza, ShoppingBag, Truck, Users, ChefHat, PartyPopper } from "lucide-react";

const PartyserviceMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Partyservice München" : "Party Service Munich",
      url: language === "de" ? "/partyservice-muenchen" : "/en/party-service-munich",
    },
  ];

  const faqItems = t.seo.partyservice.faq;

  return (
    <>
      <SEO
        title={t.seo.partyservice.title}
        description={t.seo.partyservice.description}
        keywords={
          language === "de"
            ? "Partyservice München, italienischer Partyservice, Partyservice Angebote München, Partyservice Preise, Partyservice italienisches Buffet, Pizza Partyservice München"
            : "party service Munich, Italian party service, party catering Munich, pizza party service"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Partyservice München" : "Party Service Munich",
          description:
            language === "de"
              ? "Italienischer Partyservice in München: Fertige Gerichte, Pizza, Buffets und Fingerfood zur Lieferung oder Abholung."
              : "Italian party service in Munich: ready-made dishes, pizza, buffets and finger food for delivery or pickup.",
          serviceType: "Party Service",
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
                <Badge variant="secondary" className="text-sm">Partyservice</Badge>
                <Badge variant="secondary" className="text-sm">Pizza & Buffets</Badge>
                <Badge variant="secondary" className="text-sm">Lieferung oder Abholung</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de"
                  ? "Partyservice München — Italienisches Buffet, Pizza & Fingerfood"
                  : "Party Service Munich — Italian Buffet, Pizza & Finger Food"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Fertige italienische Gerichte für Ihre Party — bestellen, abholen oder liefern lassen. Unkompliziert und lecker."
                  : "Ready-made Italian dishes for your party — order, pick up or have delivered. Simple and delicious."}
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
                      Sie suchen einen <strong>Partyservice in München</strong>, der unkompliziert
                      und trotzdem richtig gut ist? STORIA liefert Ihnen{" "}
                      <strong>fertige italienische Gerichte</strong> für Ihre Feier — von der
                      Pizza-Party über Antipasti-Buffets bis zum kompletten Fingerfood-Paket.
                    </p>
                    <p>
                      Der Vorteil: Sie bestellen einfach online oder telefonisch, wir bereiten
                      alles frisch zu und Sie holen ab oder lassen liefern. Kein Personal nötig,
                      keine komplizierte Planung — einfach gutes Essen für Ihre Gäste.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Partyservice vs. Catering vs. Restaurant
                    </h2>
                  </>
                ) : (
                  <>
                    <p>
                      Looking for a <strong>party service in Munich</strong> that's straightforward
                      yet excellent? STORIA delivers{" "}
                      <strong>ready-made Italian dishes</strong> for your celebration — from
                      pizza parties to antipasti buffets to complete finger food packages.
                    </p>
                    <p>
                      The advantage: simply order online or by phone, we prepare everything
                      fresh and you pick up or have it delivered. No staff needed,
                      no complicated planning — just great food for your guests.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Party Service vs. Catering vs. Restaurant
                    </h2>
                  </>
                )}
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto mt-6 mb-10">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary/20">
                      <th className="text-left py-4 px-4 font-medium"></th>
                      <th className="text-left py-4 px-4 font-medium">{language === "de" ? "Partyservice" : "Party Service"}</th>
                      <th className="text-left py-4 px-4 font-medium">Catering</th>
                      <th className="text-left py-4 px-4 font-medium">Restaurant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(language === "de" ? [
                      { label: "Was?", ps: "Fertige Gerichte", cat: "Planung + Lieferung", rest: "Location + Küche + Service" },
                      { label: "Personal?", ps: "Nein", cat: "Optional", rest: "Inklusive" },
                      { label: "Lieferung?", ps: "Lieferung oder Abholung", cat: "Lieferung + Aufbau", rest: "Vor Ort" },
                      { label: "Preis", ps: "Ab 8 € p.P.", cat: "Ab 15 € p.P.", rest: "Ab 35 € p.P." },
                      { label: "Ideal für", ps: "Lockere Feiern", cat: "Business & Events", rest: "Premium-Erlebnis" },
                    ] : [
                      { label: "What?", ps: "Ready-made dishes", cat: "Planning + delivery", rest: "Venue + kitchen + service" },
                      { label: "Staff?", ps: "No", cat: "Optional", rest: "Included" },
                      { label: "Delivery?", ps: "Delivery or pickup", cat: "Delivery + setup", rest: "On site" },
                      { label: "Price", ps: "From €8 p.p.", cat: "From €15 p.p.", rest: "From €35 p.p." },
                      { label: "Ideal for", ps: "Casual parties", cat: "Business & events", rest: "Premium experience" },
                    ]).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="py-3 px-4 font-medium text-sm">{row.label}</td>
                        <td className="py-3 px-4 text-sm text-primary font-medium">{row.ps}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{row.cat}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{row.rest}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
                {language === "de" ? (
                  <>
                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Unsere Partyservice-Pakete
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Pizza-Party (ab 12 € p.P.)
                    </h3>
                    <p>
                      Der Klassiker für lockere Feiern:{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        Neapolitanische Steinofen-Pizza
                      </LocalizedLink>{" "}
                      in über 25 Sorten. Bestellen Sie ab 10 Pizzen und wählen Sie Ihre
                      Lieblingssorten — heiß geliefert oder frisch abgeholt.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Antipasti-Buffet (ab 18 € p.P.)
                    </h3>
                    <p>
                      Mediterrane{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        Antipasti-Platten
                      </LocalizedLink>{" "}
                      zum Teilen: Bruschette, Mozzarella, Parmaschinken, Grillgemüse,
                      Oliven und mehr — servierfertig auf Platten angerichtet.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Fingerfood-Paket (ab 8 € p.P.)
                    </h3>
                    <p>
                      Handgemachte{" "}
                      <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                        italienische Häppchen
                      </LocalizedLink>
                      : Bruschette, Arancini, Mini-Frittata und mehr.
                      Perfekt für Stehempfänge und lockere Runden.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Komplett-Paket (ab 25 € p.P.)
                    </h3>
                    <p>
                      Antipasti + warme Hauptgerichte +{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        Desserts
                      </LocalizedLink>
                      . Das rundum-sorglos-Paket für Ihre Party — alles aus einer Hand.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Selbstabholung — die Spar-Option
                    </h2>
                    <p>
                      Holen Sie Ihre Bestellung in unserem Restaurant in der{" "}
                      <strong>Karlstraße 47a, München Maxvorstadt</strong> ab und sparen Sie
                      die Lieferkosten. Alles wird frisch zubereitet, sorgfältig verpackt und
                      mit Aufwärm-Anleitung bereitgestellt.
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
                      Our Party Service Packages
                    </h2>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Pizza Party (from €12 p.p.)
                    </h3>
                    <p>
                      The classic for casual parties:{" "}
                      <LocalizedLink to="seo.pizzaCatering" className="underline hover:text-foreground transition-colors">
                        Neapolitan stone-oven pizza
                      </LocalizedLink>{" "}
                      in over 25 varieties. Order from 10 pizzas and choose your
                      favourites — delivered hot or freshly picked up.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Antipasti Buffet (from €18 p.p.)
                    </h3>
                    <p>
                      Mediterranean{" "}
                      <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">
                        antipasti platters
                      </LocalizedLink>{" "}
                      for sharing: bruschetta, mozzarella, Parma ham, grilled vegetables,
                      olives and more — served ready on platters.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Finger Food Package (from €8 p.p.)
                    </h3>
                    <p>
                      Handmade{" "}
                      <LocalizedLink to="seo.fingerfoodCatering" className="underline hover:text-foreground transition-colors">
                        Italian bites
                      </LocalizedLink>
                      : bruschetta, arancini, mini frittata and more.
                      Perfect for standing receptions and relaxed gatherings.
                    </p>

                    <h3 className="text-xl font-medium text-foreground mt-6 mb-2">
                      Complete Package (from €25 p.p.)
                    </h3>
                    <p>
                      Antipasti + hot main courses +{" "}
                      <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">
                        desserts
                      </LocalizedLink>
                      . The all-inclusive package for your party — everything from one source.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Self-Pickup — The Budget Option
                    </h2>
                    <p>
                      Pick up your order from our restaurant at{" "}
                      <strong>Karlstraße 47a, Munich Maxvorstadt</strong> and save on delivery
                      costs. Everything freshly prepared, carefully packed and provided with
                      reheating instructions.
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
                {language === "de" ? "Warum Partyservice von STORIA?" : "Why Party Service from STORIA?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: ChefHat, title: language === "de" ? "Frisch zubereitet" : "Freshly prepared", desc: language === "de" ? "Alles wird am Tag Ihrer Feier frisch in unserer Küche gekocht." : "Everything is freshly cooked in our kitchen on the day of your party." },
                  { icon: Pizza, title: language === "de" ? "25+ Pizza-Sorten" : "25+ pizza varieties", desc: language === "de" ? "Echte neapolitanische Steinofen-Pizza — der Party-Klassiker." : "Authentic Neapolitan stone-oven pizza — the party classic." },
                  { icon: Users, title: language === "de" ? "Ab 5 Personen" : "From 5 people", desc: language === "de" ? "Kleine Runde oder große Feier — wir haben das passende Paket." : "Small gathering or large party — we have the right package." },
                  { icon: Truck, title: language === "de" ? "Lieferung möglich" : "Delivery available", desc: language === "de" ? "Frisch geliefert in ganz München und Umgebung." : "Freshly delivered throughout Munich and surrounding areas." },
                  { icon: ShoppingBag, title: language === "de" ? "Selbstabholung" : "Self-pickup", desc: language === "de" ? "Abholen in der Karlstraße 47a — ohne Lieferkosten." : "Pick up at Karlstraße 47a — no delivery costs." },
                  { icon: PartyPopper, title: language === "de" ? "Flexibel kombinieren" : "Flexible combinations", desc: language === "de" ? "Pizza, Antipasti, Fingerfood — stellen Sie Ihr Wunsch-Menü zusammen." : "Pizza, antipasti, finger food — put together your ideal menu." },
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
                  { title: language === "de" ? "Geburtstag" : "Birthday", desc: language === "de" ? "Catering für Ihre Feier" : "Catering for your party", to: "seo.geburtstagCatering" as const },
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Business Events & Feiern" : "Business events", to: "seo.firmenfeier" as const },
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
                {t.seo.partyservice.faqTitle}
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
              {language === "de" ? "Lieber direkt im Restaurant feiern?" : "Prefer celebrating at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA in München Maxvorstadt bietet das Premium-Erlebnis: Location, Küche, Service und Atmosphäre — alles aus einer Hand, für bis zu 180 Gäste."
                : "Ristorante STORIA in Munich Maxvorstadt offers the premium experience: venue, kitchen, service and atmosphere — all from one source, for up to 180 guests."}
            </p>
            <a
              href="https://www.ristorantestoria.de"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Ristorante STORIA entdecken" : "→ Discover Ristorante STORIA"}
            </a>
          </section>

          <CateringCTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default PartyserviceMuenchen;
