import Header from "@/components/Header";
import { LocalizedLink } from "@/components/LocalizedLink";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MenuDisplay from "@/components/MenuDisplay";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { MessageCircle, CalendarHeart } from "lucide-react";

import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const WHATSAPP_URL =
  "https://wa.me/491636033912?text=Hallo%2C%20ich%20m%C3%B6chte%20gerne%20einen%20Tisch%20im%20STORIA%20reservieren.";

const trackReservationClick = (placement: string) => {
  trackEvent("reservation_click", { location: "speisekarte", placement });
};

const Speisekarte = () => {
  const { t, language } = useLanguage();
  const isDE = language === "de";

  return (
    <>
      <SEO
        title={t.seo.speisekarte.title}
        description={t.seo.speisekarte.description}
      />
      <StructuredData 
        type="menu" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Speisekarte' : 'Menu', url: '/speisekarte' }
        ]} 
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <LocalizedLink to="home">
              <img src={storiaLogo} alt="STORIA – Italienisches Restaurant München" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
            </LocalizedLink>
            <p className="text-lg text-muted-foreground tracking-wide">
              {t.hero.subtitle}
            </p>
          </div>
        </div>
        <Navigation />

        <main className="container mx-auto px-4 py-12 pb-32 md:pb-28 flex-grow">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-center">
            {language === 'de' ? 'Speisekarte – Ristorante München Maxvorstadt' : 'Menu – Italian Restaurant Munich Maxvorstadt'}
          </h1>
          <p className="text-center text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            {language === 'de' 
              ? 'Authentische italienische Küche – neapolitanische Pizza aus dem Steinofen, hausgemachte Pasta und frische Antipasti. Frisch zubereitet mit Liebe und Leidenschaft.'
              : 'Authentic Italian cuisine – Neapolitan stone-oven pizza, homemade pasta and fresh antipasti. Freshly prepared with love and passion.'}
          </p>

          <MenuDisplay
            menuType="food"
            renderAfterCategory={(category, index, total) => {
              // Letzten Abschnitt überspringen — direkt darunter folgt der grosse Abschluss-Block
              if (index === total - 1) return null;
              return (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 rounded-lg border border-border bg-secondary/40 px-4 py-5 text-center">
                  <p className="text-base sm:text-lg text-foreground font-medium">
                    {isDE
                      ? "Gefällt dir, was du siehst?"
                      : "Like what you see?"}
                  </p>
                  <Button
                    asChild
                    size="lg"
                    className="min-h-11 w-full sm:w-auto"
                  >
                    <LocalizedLink
                      to="/reservierung"
                      onClick={() => trackReservationClick(`after_${category.id}`)}
                    >
                      {isDE ? "Jetzt Tisch reservieren" : "Reserve a table now"}
                    </LocalizedLink>
                  </Button>
                </div>
              );
            }}
          />

          {/* Kräftiger Abschluss-Block */}
          <section
            aria-labelledby="speisekarte-cta-heading"
            className="mt-16 rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-background px-6 py-12 sm:py-16 text-center shadow-sm"
          >
            <h2
              id="speisekarte-cta-heading"
              className="text-3xl sm:text-4xl font-serif font-bold mb-3"
            >
              {isDE ? "Hunger bekommen?" : "Getting hungry?"}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              {isDE
                ? "Sichere dir deinen Tisch im STORIA – mitten in der Maxvorstadt."
                : "Reserve your table at STORIA – in the heart of Maxvorstadt."}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
              <Button asChild size="lg" className="min-h-11 sm:min-w-[220px]">
                <LocalizedLink
                  to="/reservierung"
                  onClick={() => trackReservationClick("footer_primary")}
                >
                  <CalendarHeart className="mr-2 h-5 w-5" aria-hidden="true" />
                  {isDE ? "Tisch reservieren" : "Reserve a table"}
                </LocalizedLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-11 sm:min-w-[220px]"
              >
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={isDE ? "Per WhatsApp anfragen" : "Ask via WhatsApp"}
                >
                  <MessageCircle className="mr-2 h-5 w-5" aria-hidden="true" />
                  {isDE ? "Per WhatsApp anfragen" : "Ask via WhatsApp"}
                </a>
              </Button>
            </div>
          </section>
        </main>

        {/* Sticky Reservierungs-Leiste — auf allen Geräten sichtbar */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
          role="region"
          aria-label={isDE ? "Tischreservierung" : "Table reservation"}
        >
          <div
            className="container mx-auto flex items-center justify-between gap-3 px-4 py-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">
                {isDE ? "Lust auf einen Abend bei uns?" : "Fancy an evening with us?"}
              </span>
              <span className="text-xs text-muted-foreground">
                {isDE
                  ? "Reserviere deinen Tisch in wenigen Sekunden."
                  : "Book your table in seconds."}
              </span>
            </div>
            <Button
              asChild
              size="lg"
              className="min-h-11 w-full sm:w-auto sm:ml-auto font-semibold"
            >
              <LocalizedLink
                to="/reservierung"
                onClick={() => trackReservationClick("sticky_bar")}
              >
                <CalendarHeart className="mr-2 h-5 w-5" aria-hidden="true" />
                {isDE ? "Tisch reservieren" : "Reserve a table"}
              </LocalizedLink>
            </Button>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Speisekarte;
