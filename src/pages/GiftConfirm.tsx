import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { GIFT_COPY } from "@/lib/gift/copy";
import { confirmGiftReservation, type ConfirmStatus } from "@/lib/gift/api";

/**
 * Bestätigungsseite des Double-Opt-in ("Zahlung vor Ort"). Der Link aus der Mail öffnet nur diese Seite;
 * bestätigt wird erst per Klick auf den Button (Mail-Scanner und Link-Vorschauen lösen so nichts aus).
 * Token steht in ?t=… (nur Hash in der DB, einmalig einlösbar).
 */
const GiftConfirm = () => {
  const { language } = useLanguage();
  const lang = language === "de" ? "de" : "en";
  const t = GIFT_COPY[lang];
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConfirmStatus | "error" | null>(null);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await confirmGiftReservation(token);
      setResult(r.status);
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  };

  const message: Record<ConfirmStatus | "error", string> = {
    confirmed: t.confirmedOk,
    already_confirmed: t.confirmedAlready,
    expired: t.confirmExpired,
    invalid: t.confirmInvalid,
    error: t.confirmError,
  };
  const ok = result === "confirmed" || result === "already_confirmed";
  const orderPath = lang === "de" ? "/geschenkkoerbe/bestellung" : "/en/geschenkkoerbe/bestellung";

  return (
    <>
      <Helmet>
        <title>{t.confirmTitle} — STORIA</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <main className="min-h-screen bg-background">
        <section className="container mx-auto max-w-2xl px-4 py-16 text-center md:py-24">
          {result === null ? (
            <MailCheck className="mx-auto mb-6 h-16 w-16 text-primary" aria-hidden="true" />
          ) : ok ? (
            <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-primary" aria-hidden="true" />
          ) : (
            <XCircle className="mx-auto mb-6 h-16 w-16 text-muted-foreground" aria-hidden="true" />
          )}
          <h1 className="mb-4 font-serif text-3xl font-bold md:text-4xl">{t.confirmTitle}</h1>

          {result === null && token ? (
            <>
              <p className="mb-8 text-lg text-muted-foreground">{t.confirmIntro}</p>
              <Button type="button" size="lg" className="rounded-full" disabled={busy} onClick={confirm}>
                {busy ? t.confirming : t.confirmButton}
              </Button>
            </>
          ) : (
            <>
              <p role="status" className="mb-8 text-lg text-muted-foreground">{result === null ? t.confirmInvalid : message[result]}</p>
              {(result === "expired" || result === "invalid" || result === "error" || result === null) && (
                <Button asChild variant="outline"><Link to={orderPath}>{t.orderAgain}</Link></Button>
              )}
              {ok && <Button asChild variant="outline"><Link to={lang === "de" ? "/" : "/en"}>{t.thanksHome}</Link></Button>}
            </>
          )}
        </section>
      </main>
    </>
  );
};

export default GiftConfirm;
