import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { ArrowRight, Gift } from "lucide-react";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { LocalizedLink } from "@/components/LocalizedLink";
import { GiftBasketCard } from "@/components/gift/GiftBasketCard";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { GIFT_COPY } from "@/lib/gift/copy";
import { fetchGiftCatalog } from "@/lib/gift/api";
import { giftItemId, giftMaxForLine } from "@/lib/gift/cartRules";
import { giftImageProps } from "@/lib/gift/image";
import { qtyLeft } from "@/lib/gift/stock";
import type { GiftBasket } from "@/lib/gift/types";

/** Shop-Kategorie "Geschenkkörbe": Körbe liegen im regulären Warenkorb (CartContext).
 *  Inhalt kommt live aus dem Katalog (kein Prerender); noindex, Canonical auf die Landingpage (Entscheidung Antoine 20.11.2026). */
const GeschenkKoerbe = () => {
  const { language } = useLanguage();
  const lang = language === "de" ? "de" : "en";
  const t = GIFT_COPY[lang];
  const { items, addToCart, giftItemCount } = useCart();
  const [catalog, setCatalog] = useState<GiftBasket[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setCatalog(await fetchGiftCatalog());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const handleAdd = (basket: GiftBasket, variantId: string, qty: number) => {
    const variant = basket.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const id = giftItemId(variant.id);
    // Bestand und Warenkorb-Menge berücksichtigen (Server prüft beim Bestellen erneut)
    const inCart = items.find((i) => i.id === id)?.quantity ?? 0;
    // Deckel: Bestand, je Zeile und je Bestellung (giftMaxForLine)
    const allowed = Math.max(0, Math.min(qty, qtyLeft(variant) - inCart, giftMaxForLine(items, id) - inCart));
    if (allowed <= 0) {
      toast.info(t.stockLimit);
      return;
    }
    addToCart(
      {
        id,
        name: basket.name_de,
        name_en: basket.name_en,
        price: basket.price_cents / 100,
        image: giftImageProps(variant.image_url ?? basket.image_url).src,
        kind: "gift_basket",
        variantId: variant.id,
        basketSlug: basket.slug,
        variantKey: variant.key,
        variantLabel: variant.label_de,
        variantLabelEn: variant.label_en,
      },
      allowed,
    );
    if (allowed < qty) toast.info(t.stockLimit);
    else toast.success(t.addedToCart);
  };

  return (
    <>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.shopIntro} />
        <meta name="robots" content="noindex,follow" />
        {/* Marken-Kannibalisierung vermeiden: inhaltliche Seite liegt auf ristorantestoria.de (Entscheidung Antoine 20.11.2026) */}
        <link rel="canonical" href="https://www.ristorantestoria.de/geschenkkoerbe-muenchen/" />
      </Helmet>
      <Header />
      <Navigation />
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1">
          <section className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
            <header className="mb-10 text-center">
              <Gift className="mx-auto mb-3 h-10 w-10 text-primary" aria-hidden="true" />
              <h1 className="font-serif text-4xl font-medium md:text-5xl">{t.shopH1}</h1>
              <p className="mx-auto mt-4 max-w-2xl text-xl text-muted-foreground">{t.shopIntro}</p>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">{t.ageNotice}</p>
            </header>

            {giftItemCount > 0 && (
              <div role="status" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
                <span>{t.shopInCart(giftItemCount)}</span>
                <Button asChild variant="checkoutCta" size="sm">
                  <LocalizedLink to="checkout">
                    {t.toCheckout}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </LocalizedLink>
                </Button>
              </div>
            )}

            {loadFailed && <p role="alert" className="text-center text-destructive">{t.loadError}</p>}
            {!loadFailed && catalog === null && <p className="text-center text-muted-foreground">{t.loading}</p>}
            {catalog && catalog.length === 0 && <p className="text-center text-muted-foreground">{t.emptyShop}</p>}

            {catalog && catalog.length > 0 && (
              <div className="space-y-6">
                {catalog.map((b) => (
                  <GiftBasketCard key={b.id} basket={b} lang={lang} onAdd={(variantId, qty) => handleAdd(b, variantId, qty)} />
                ))}
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default GeschenkKoerbe;
