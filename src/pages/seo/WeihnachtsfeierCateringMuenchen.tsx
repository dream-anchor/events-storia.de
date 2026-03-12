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
import { Snowflake, Users, ChefHat, CalendarCheck, Building2, Star } from "lucide-react";

const WeihnachtsfeierCateringMuenchen = () => {
  const { t, language } = useLanguage();

  const breadcrumbs = [
    { name: "Home", url: language === "de" ? "/" : "/en" },
    {
      name: language === "de" ? "Weihnachtsfeier Catering München" : "Christmas Party Catering Munich",
      url: language === "de" ? "/weihnachtsfeier-catering-muenchen" : "/en/christmas-party-catering-munich",
    },
  ];

  const faqItems = t.seo.weihnachtsfeier.faq;

  return (
    <>
      <SEO
        title={t.seo.weihnachtsfeier.title}
        description={t.seo.weihnachtsfeier.description}
        keywords={
          language === "de"
            ? "Weihnachtsfeier Catering München, Weihnachtsessen Firma München, Firmen-Weihnachtsfeier Catering, Weihnachtsmenü München, Weihnachtsfeier Restaurant München"
            : "Christmas party catering Munich, corporate Christmas dinner Munich, festive catering Munich"
        }
      />
      <StructuredData
        type="service"
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        serviceData={{
          name: language === "de" ? "Weihnachtsfeier Catering München" : "Christmas Party Catering Munich",
          description:
            language === "de"
              ? "Festliches italienisches Catering für Weihnachtsfeiern und Jahresabschluss-Events in München."
              : "Festive Italian catering for Christmas parties and year-end events in Munich.",
          serviceType: "Christmas Party Catering",
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
                <Badge variant="secondary" className="text-sm">Weihnachtsmenüs</Badge>
                <Badge variant="secondary" className="text-sm">Gruppen ab 10</Badge>
                <Badge variant="secondary" className="text-sm">München & Umland</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {language === "de" ? "Weihnachtsfeier Catering in München" : "Christmas Party Catering in Munich"}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {language === "de"
                  ? "Festliche italienische Menüs für unvergessliche Weihnachtsfeiern – im Büro, zu Hause oder im Restaurant."
                  : "Festive Italian menus for unforgettable Christmas parties – at the office, at home or at the restaurant."}
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
                      Die <strong>Weihnachtsfeier</strong> ist das Highlight des Jahres – und verdient ein
                      Catering, das genauso besonders ist. STORIA bietet Ihnen{" "}
                      <strong>festliches Catering für Weihnachtsfeiern in München</strong>: authentische
                      italienische Küche, sorgfältig zubereitet und stimmungsvoll serviert.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Festliche Menü-Optionen
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Festliches Fingerfood</strong> – Bruschette mit Trüffel, Garnelen-Häppchen und winterliche Arancini als{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">eleganter Stehempfang</LocalizedLink></li>
                      <li><strong>Antipasti-Platten</strong> – Feierliche{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">Sharing-Platten</LocalizedLink>{" "}
                        mit Parmaschinken, Burrata, mariniertem Gemüse und Focaccia</li>
                      <li><strong>Warmes Weihnachtsbuffet</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">Lasagne, Ossobuco, Risotto mit Steinpilzen</LocalizedLink>{" "}
                        und weitere Winterspezialitäten</li>
                      <li><strong>Dessert-Highlights</strong> – Hausgemachtes{" "}
                        <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">Tiramisù, Panna Cotta und Pistazien-Törtchen</LocalizedLink></li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Weihnachtsfeier im Restaurant oder als Catering
                    </h2>
                    <p>
                      Sie haben die Wahl: Feiern Sie Ihre Weihnachtsfeier direkt in unserem{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">Ristorante STORIA in der Maxvorstadt</LocalizedLink>{" "}
                      mit bis zu 70 Gästen, oder wir liefern unser festliches Catering an Ihren Wunschort –
                      ins Büro, in eine Eventlocation oder nach Hause.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Jetzt frühzeitig buchen
                    </h2>
                    <p>
                      Die Weihnachtszeit ist unsere geschäftigste Saison. Sichern Sie sich Ihren
                      Wunschtermin und{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">kontaktieren Sie uns</LocalizedLink>{" "}
                      frühzeitig. Auch vegetarische und vegane Weihnachtsmenüs stellen wir gerne
                      individuell für Sie zusammen.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      The <strong>Christmas party</strong> is the highlight of the year – and deserves catering
                      that is just as special. STORIA offers{" "}
                      <strong>festive catering for Christmas parties in Munich</strong>: authentic Italian
                      cuisine, carefully prepared and atmospherically served.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Festive Menu Options
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Festive Finger Food</strong> – Truffle bruschetta, prawn canapés and winter arancini as an{" "}
                        <LocalizedLink to="catering.fingerfood" className="underline hover:text-foreground transition-colors">elegant standing reception</LocalizedLink></li>
                      <li><strong>Antipasti Platters</strong> – Festive{" "}
                        <LocalizedLink to="catering.platters" className="underline hover:text-foreground transition-colors">sharing platters</LocalizedLink>{" "}
                        with Parma ham, burrata, marinated vegetables and focaccia</li>
                      <li><strong>Warm Christmas Buffet</strong> –{" "}
                        <LocalizedLink to="catering.casseroles" className="underline hover:text-foreground transition-colors">Lasagna, ossobuco, porcini risotto</LocalizedLink>{" "}
                        and more winter specialities</li>
                      <li><strong>Dessert Highlights</strong> – Homemade{" "}
                        <LocalizedLink to="catering.desserts" className="underline hover:text-foreground transition-colors">tiramisù, panna cotta and pistachio tartlets</LocalizedLink></li>
                    </ul>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Christmas Party at the Restaurant or as Catering
                    </h2>
                    <p>
                      Celebrate at our{" "}
                      <LocalizedLink to="events" className="underline hover:text-foreground transition-colors">Ristorante STORIA in Maxvorstadt</LocalizedLink>{" "}
                      with up to 70 guests, or we deliver our festive catering to your preferred location.
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mt-10 mb-4">
                      Book Early
                    </h2>
                    <p>
                      The Christmas season is our busiest time.{" "}
                      <LocalizedLink to="contact" className="underline hover:text-foreground transition-colors">Contact us</LocalizedLink>{" "}
                      early to secure your preferred date. We also create custom vegetarian and vegan Christmas menus.
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
                {language === "de" ? "Warum STORIA für Ihre Weihnachtsfeier?" : "Why STORIA for Your Christmas Party?"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { icon: Star, title: language === "de" ? "15+ Jahre Erfahrung" : "15+ years experience", desc: language === "de" ? "Über 15 Jahre Erfahrung mit Firmen-Weihnachtsfeiern in München." : "Over 15 years of experience with corporate Christmas parties." },
                  { icon: ChefHat, title: language === "de" ? "Festliche Menüs" : "Festive menus", desc: language === "de" ? "Winterliche Spezialitäten mit Trüffel, Steinpilzen und Meeresfrüchten." : "Winter specialities with truffle, porcini and seafood." },
                  { icon: Users, title: language === "de" ? "10 bis 200+ Gäste" : "10 to 200+ guests", desc: language === "de" ? "Von der intimen Team-Feier bis zur großen Firmen-Weihnachtsfeier." : "From intimate team celebrations to large corporate parties." },
                  { icon: CalendarCheck, title: language === "de" ? "Flexible Termine" : "Flexible dates", desc: language === "de" ? "Auch kurzfristige Termine nach Verfügbarkeit möglich." : "Short-notice dates also available subject to availability." },
                  { icon: Building2, title: language === "de" ? "Im Restaurant feiern" : "Celebrate at the restaurant", desc: language === "de" ? "Weihnachtlich dekoriertes Ristorante STORIA für bis zu 70 Gäste." : "Christmas-decorated Ristorante STORIA for up to 70 guests." },
                  { icon: Snowflake, title: language === "de" ? "Winterliche Stehempfänge" : "Winter standing receptions", desc: language === "de" ? "Fingerfood, Antipasti und auf Wunsch Glühwein oder Prosecco." : "Finger food, antipasti and optionally mulled wine or prosecco." },
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
                {language === "de" ? "Weitere Catering-Anlässe" : "More Catering Occasions"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {[
                  { title: language === "de" ? "Firmenfeier" : "Corporate Event", desc: language === "de" ? "Team-Events, Jubiläen & Sommerfeste" : "Team events & anniversaries", to: "seo.firmenfeier" as const },
                  { title: language === "de" ? "Büro-Catering" : "Office Catering", desc: language === "de" ? "Business Lunch & Meetings" : "Business lunch & meetings", to: "seo.bueroCatering" as const },
                  { title: language === "de" ? "Pizza Catering" : "Pizza Catering", desc: language === "de" ? "Der lockere Klassiker" : "The casual classic", to: "seo.pizzaCatering" as const },
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
                {t.seo.weihnachtsfeier.faqTitle}
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
              {language === "de" ? "Oder lieber die Weihnachtsfeier im Restaurant?" : "Or celebrate Christmas at the restaurant?"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === "de"
                ? "Das Ristorante STORIA in München Maxvorstadt bietet Weihnachtsfeiern direkt im Restaurant – stimmungsvolles Ambiente, italienische Küche und persönlicher Service für bis zu 180 Gäste."
                : "Ristorante STORIA in Munich Maxvorstadt offers Christmas parties at the restaurant – atmospheric ambience, Italian cuisine and personal service for up to 180 guests."}
            </p>
            <a
              href="https://www.ristorantestoria.de/weihnachtsfeier-muenchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {language === "de" ? "→ Weihnachtsfeier im STORIA reservieren" : "→ Reserve a Christmas party at STORIA"}
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

export default WeihnachtsfeierCateringMuenchen;
