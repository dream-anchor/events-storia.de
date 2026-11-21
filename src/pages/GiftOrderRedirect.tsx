import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { getLocalizedPath } from "@/config/routes";
import { trackEvent } from "@/lib/analytics";
import { GIFT_COPY } from "@/lib/gift/copy";
import { fetchGiftCatalog } from "@/lib/gift/api";
import { giftItemId } from "@/lib/gift/cartRules";
import { giftImageProps } from "@/lib/gift/image";
import { parseDeepLink, resolveDeepLink, type DeepLinkNote } from "@/lib/gift/deeplink";
import { MAX_QTY_PER_LINE } from "@/lib/gift/pricing";

/** Alte Korb-Shop-URL /geschenkkoerbe/bestellung (+ /en/): Deep-Links von ristorantestoria.de (?korb=&wein=&menge=, ?pos=)
 *  legen die Körbe mit SET-Semantik in den regulären Warenkorb und führen zur Kasse;
 *  ?cancelled=1 (Rückkehr von Stripe) führt mit erhaltenem Warenkorb zur Kasse; ohne gültige Position zur Kategorie-Seite. */
const GiftOrderRedirect = () => {
  // Sprache aus dem Pfad (nicht aus dem Context): der Context zieht erst nach dem Render nach
  const { pathname } = useLocation();
  const lang = pathname.startsWith("/en") ? "en" : "de";
  const t = GIFT_COPY[lang];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addToCart } = useCart();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const checkoutPath = getLocalizedPath("checkout", lang);
    const categoryPath = getLocalizedPath("catering.giftBaskets", lang);

    // ?lang=en (z. B. aus den IT/FR-Seiten) -> EN-Shop, übrige Parameter bleiben erhalten
    if (params.get("lang") === "en" && lang === "de") {
      const next = new URLSearchParams(params);
      next.delete("lang");
      const qs = next.toString();
      navigate(`/en/geschenkkoerbe/bestellung${qs ? `?${qs}` : ""}`, { replace: true });
      started.current = false; // die EN-Route startet die Weiterleitung neu
      return;
    }

    if (params.get("cancelled") === "1") {
      navigate(`${checkoutPath}?cancelled=1`, { replace: true });
      return;
    }

    const positions = parseDeepLink(params);
    if (positions.length === 0) {
      navigate(categoryPath, { replace: true });
      return;
    }

    const noteText = (n: DeepLinkNote): string => {
      switch (n.kind) {
        case "unknown_basket": return t.noteUnknownBasket;
        case "unknown_wine": return t.noteUnknownWine;
        case "sold_out": return t.noteSoldOut;
        case "capped": return t.noteCapped(n.qty);
      }
    };

    void (async () => {
      try {
        // Preise/Bestand stammen aus dem Katalog, nicht aus der URL
        const catalog = await fetchGiftCatalog();
        const { lines, notes } = resolveDeepLink(positions, catalog, MAX_QTY_PER_LINE);
        notes.forEach((n) => toast.info(noteText(n)));
        for (const line of lines) {
          for (const b of catalog) {
            const v = b.variants.find((x) => x.id === line.variantId);
            if (!v) continue;
            addToCart(
              {
                id: giftItemId(v.id),
                name: b.name_de,
                name_en: b.name_en,
                price: b.price_cents / 100,
                image: giftImageProps(v.image_url ?? b.image_url).src,
                kind: "gift_basket",
                variantId: v.id,
                basketSlug: b.slug,
                variantKey: v.key,
                variantLabel: v.label_de,
                variantLabelEn: v.label_en,
              },
              line.qty,
              { mode: "set" }, // Menge setzen, nicht addieren (Deep-Link + erneuter Klick ergab früher Menge 2)
            );
          }
        }
        trackEvent("view_item", { location: "geschenkkorb_deeplink", items: lines.length });
        navigate(lines.length > 0 ? checkoutPath : categoryPath, { replace: true });
      } catch {
        toast.error(t.loadError);
        navigate(categoryPath, { replace: true });
      }
    })();
  }, [params, lang, navigate, addToCart, t]);

  return (
    <>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href="https://www.ristorantestoria.de/geschenkkoerbe-muenchen/" />
      </Helmet>
      <main className="min-h-screen bg-background">
        <p className="container mx-auto px-4 py-24 text-center text-muted-foreground" role="status">{t.redirecting}</p>
      </main>
    </>
  );
};

export default GiftOrderRedirect;
