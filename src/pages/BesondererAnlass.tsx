import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ReservationCTA from "@/components/ReservationCTA";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSpecialMenuBySlug } from "@/hooks/useSpecialMenus";
import MenuDisplay from "@/components/MenuDisplay";

const BesondererAnlass = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useLanguage();
  const { data: menu, isLoading, error } = useSpecialMenuBySlug(slug || '');

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <Skeleton className="h-24 md:h-32 w-48 mx-auto mb-4" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </div>
        </div>
        <Navigation />
        <main className="container mx-auto px-4 py-12 flex-grow">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-96" />
        </main>
        <Footer />
      </div>
    );
  }

  // Redirect to overview if menu not found
  if (error || !menu) {
    return <Navigate to="/besondere-anlaesse" replace />;
  }

  const menuTitle = language === 'en' && menu.title_en ? menu.title_en : menu.title || '';
  const menuSubtitle = language === 'en' && menu.subtitle_en ? menu.subtitle_en : menu.subtitle || '';

  // SEO-optimized description based on slug
  const getSeoDescription = () => {
    if (slug?.includes('weihnacht')) {
      return language === 'de'
        ? `${menuTitle} im STORIA München: Italienische Weihnachtsfeier in der Maxvorstadt. Festliche Menüs für Firmenfeier, Familie & Freunde. Jetzt reservieren!`
        : `${menuTitle} at STORIA Munich: Italian Christmas celebration in Maxvorstadt. Festive menus for corporate events, family & friends. Book now!`;
    }
    if (slug?.includes('silvester')) {
      return language === 'de'
        ? `${menuTitle} im STORIA München: Silvester feiern in der Maxvorstadt. Italienisches Restaurant für Ihren Jahreswechsel. Jetzt Tisch sichern!`
        : `${menuTitle} at STORIA Munich: Celebrate New Year's Eve in Maxvorstadt. Italian restaurant for your celebration. Secure your table now!`;
    }
    return language === 'de'
      ? `${menuTitle} im STORIA München Maxvorstadt. Feiern Sie besondere Anlässe mit authentischer italienischer Küche. Jetzt reservieren!`
      : `${menuTitle} at STORIA Munich Maxvorstadt. Celebrate special occasions with authentic Italian cuisine. Book now!`;
  };

  return (
    <>
      <SEO 
        title={`${menuTitle} – Italienisches Restaurant München`}
        description={getSeoDescription()}
        canonical={`/besondere-anlaesse/${slug}`}
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Besondere Anlässe' : 'Special Occasions', url: '/besondere-anlaesse' },
          { name: menuTitle, url: `/besondere-anlaesse/${slug}` }
        ]}
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <Link to="/">
              <img src={storiaLogo} alt="STORIA – Italienisches Restaurant München" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
            </Link>
            <p className="text-lg text-muted-foreground tracking-wide">
              {t.hero.subtitle}
            </p>
          </div>
        </div>
        <Navigation />

        <main className="container mx-auto px-4 py-12 flex-grow">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <MenuDisplay menuType="special" menuId={menu.id} />
            </div>

            {/* Contact CTA */}
            <div className="bg-secondary p-8 rounded-lg text-center">
              <h2 className="text-xl font-bold mb-4">{t.specialOccasions.interested}</h2>
              <p className="text-muted-foreground mb-6">
                {t.specialOccasions.contactUs}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <a href="tel:+498951519696">+49 89 51519696</a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="mailto:info@ristorantestoria.de">{t.specialOccasions.sendEmail}</a>
                </Button>
              </div>
            </div>

            <ReservationCTA />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default BesondererAnlass;
