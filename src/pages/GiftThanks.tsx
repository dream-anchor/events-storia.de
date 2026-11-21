import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { GIFT_COPY } from "@/lib/gift/copy";
import { useCart } from "@/contexts/CartContext";

/** Danke-Seite (Muster GutscheinDanke): keine Datenabfrage, nur Bestätigungstext; Details kommen per E-Mail. */
const GiftThanks = () => {
  const { language } = useLanguage();
  const lang = language === "de" ? "de" : "en";
  const t = GIFT_COPY[lang];
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const awaiting = params.get("awaiting") === "1";
  const orderNo = params.get("nr");
  const { removeGiftItems } = useCart();

  useEffect(() => {
    // Gutschein-/Korb-Warenkorb nach erfolgreicher Zahlung leeren
    try {
      sessionStorage.removeItem("storia-gift-cart");
      sessionStorage.removeItem("storia-gift-form");
    } catch { /* ignorieren */ }
    removeGiftItems(); // Geschenkkörbe im gemeinsamen Warenkorb; Catering-Zeilen bleiben unberührt
    if (sessionId) trackEvent("purchase", { location: "geschenkkorb", transaction_id: sessionId });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmal beim Öffnen der Seite (removeGiftItems ist bei jedem Render neu)
  }, [sessionId]);

  return (
    <>
      <Helmet>
        <title>{t.thanksTitle} — STORIA</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen bg-background">
        <section className="container mx-auto max-w-2xl px-4 py-16 text-center md:py-24">
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-primary" aria-hidden="true" />
          <h1 className="mb-4 font-serif text-3xl font-bold md:text-4xl">{awaiting ? t.confirmTitle : t.thanksTitle}</h1>
          <p className="mb-6 text-lg text-muted-foreground">{awaiting ? t.thanksAwaiting : t.thanksPaid}</p>
          {orderNo && <p className="mb-6">{t.thanksOrderNo}: <strong>{orderNo}</strong></p>}
          <div className="mb-8 rounded-xl border border-border bg-secondary/40 p-6 text-left">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {t.thanksNoMail} <a href="mailto:info@events-storia.de" className="text-primary underline">info@events-storia.de</a>.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to={lang === "de" ? "/" : "/en"}>{t.thanksHome}</Link>
          </Button>
        </section>
      </main>
    </>
  );
};

export default GiftThanks;
