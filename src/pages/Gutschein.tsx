import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trackEvent } from "@/lib/analytics";
import { Gift, Mail, ShieldCheck, MapPin } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [2500, 5000, 7500, 10000]; // cents
const MIN_CENTS = 1000;
const MAX_CENTS = 50000;

const Gutschein = () => {
  const { language } = useLanguage();
  const isDE = language === "de";
  const t = isDE ? COPY.de : COPY.en;

  const [amountCents, setAmountCents] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [agbOk, setAgbOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveAmount = useMemo(() => {
    if (customAmount) {
      const eur = parseFloat(customAmount.replace(",", "."));
      if (!Number.isFinite(eur)) return 0;
      return Math.round(eur * 100);
    }
    return amountCents;
  }, [amountCents, customAmount]);

  const formattedAmount = (effectiveAmount / 100).toLocaleString(isDE ? "de-DE" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (effectiveAmount < MIN_CENTS || effectiveAmount > MAX_CENTS) {
      toast.error(t.errAmount);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail)) {
      toast.error(t.errEmail);
      return;
    }
    if (!agbOk) {
      toast.error(t.errAgb);
      return;
    }
    if (message.length > 300) {
      toast.error(t.errMessage);
      return;
    }

    setLoading(true);
    try {
      trackEvent("begin_checkout", {
        location: "gutschein",
        currency: "EUR",
        value: effectiveAmount / 100,
      });

      const { data, error } = await supabase.functions.invoke("create-voucher-checkout", {
        body: {
          amount_cents: effectiveAmount,
          purchaser_email: purchaserEmail.trim(),
          purchaser_name: purchaserName.trim() || null,
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientEmail.trim() || null,
          message: message.trim() || null,
          language,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("Missing checkout URL");

      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t.errGeneric + (msg ? `: ${msg}` : ""));
      setLoading(false);
    }
  };

  const setPreset = (cents: number) => {
    setAmountCents(cents);
    setCustomAmount("");
  };

  return (
    <>
      <Helmet>
        <title>{t.metaTitle}</title>
        <meta name="description" content={t.metaDescription} />
        <link rel="canonical" href={`https://events-storia.de${isDE ? "/gutschein" : "/en/voucher"}`} />
      </Helmet>

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-gradient-to-br from-secondary/40 to-background border-b border-border">
          <div className="container mx-auto px-4 py-12 md:py-20 text-center max-w-3xl">
            <Gift className="mx-auto h-12 w-12 text-primary mb-4" aria-hidden="true" />
            <h1 className="text-3xl md:text-5xl font-serif font-bold mb-4">{t.heroTitle}</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
              {t.heroSub}
            </p>
          </div>
        </section>

        {/* Form + Summary */}
        <section className="container mx-auto px-4 py-12 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Betrag */}
            <div>
              <h2 className="text-xl font-semibold mb-4">{t.stepAmount}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {PRESETS.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => setPreset(cents)}
                    className={`rounded-lg border-2 px-4 py-4 text-lg font-semibold transition-all min-h-[64px] ${
                      amountCents === cents && !customAmount
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {(cents / 100).toFixed(0)} €
                  </button>
                ))}
              </div>
              <div>
                <Label htmlFor="customAmount" className="text-sm text-muted-foreground">
                  {t.customAmountLabel}
                </Label>
                <Input
                  id="customAmount"
                  type="number"
                  inputMode="decimal"
                  min={10}
                  max={500}
                  step={1}
                  placeholder="z. B. 60"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="max-w-[200px]"
                />
              </div>
            </div>

            {/* Empfänger / Nachricht */}
            <div>
              <h2 className="text-xl font-semibold mb-4">{t.stepRecipient}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recipientName">{t.recipientName} <span className="text-muted-foreground text-xs">{t.optional}</span></Label>
                  <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="purchaserName">{t.purchaserName} <span className="text-muted-foreground text-xs">{t.optional}</span></Label>
                  <Input id="purchaserName" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} maxLength={120} />
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="message">{t.messageLabel} <span className="text-muted-foreground text-xs">{t.optional} · {t.messageLimit}</span></Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                  maxLength={300}
                  rows={3}
                  placeholder={t.messagePlaceholder}
                />
                <div className="text-right text-xs text-muted-foreground mt-1">{message.length}/300</div>
              </div>
              <div className="mt-4">
                <Label htmlFor="recipientEmail">{t.recipientEmail} <span className="text-muted-foreground text-xs">{t.optional}</span></Label>
                <Input id="recipientEmail" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} maxLength={254} />
                <p className="text-xs text-muted-foreground mt-1">{t.recipientEmailHelp}</p>
              </div>
            </div>

            {/* Käufer */}
            <div>
              <h2 className="text-xl font-semibold mb-4">{t.stepPurchaser}</h2>
              <Label htmlFor="purchaserEmail">{t.purchaserEmail} *</Label>
              <Input
                id="purchaserEmail"
                type="email"
                required
                value={purchaserEmail}
                onChange={(e) => setPurchaserEmail(e.target.value)}
                maxLength={254}
              />
              <p className="text-xs text-muted-foreground mt-1">{t.purchaserEmailHelp}</p>
            </div>

            {/* AGB */}
            <div className="flex items-start gap-3">
              <Checkbox id="agb" checked={agbOk} onCheckedChange={(v) => setAgbOk(v === true)} className="mt-1" />
              <Label htmlFor="agb" className="text-sm font-normal leading-relaxed cursor-pointer">
                {t.agbPre}{" "}
                <Link to={isDE ? "/agb-gutscheine" : "/en/voucher-terms"} target="_blank" className="underline">{t.agbTerms}</Link>{" "}
                {t.agbAnd}{" "}
                <Link to={isDE ? "/datenschutz" : "/en/privacy"} target="_blank" className="underline">{t.agbPrivacy}</Link>{" "}
                {t.agbPost}
              </Label>
            </div>

            {/* Submit */}
            <div className="bg-secondary/40 rounded-xl p-6 border border-border">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-muted-foreground">{t.total}</span>
                <span className="text-3xl font-bold">{formattedAmount} €</span>
              </div>
              <Button type="submit" size="lg" className="w-full min-h-[52px] text-base" disabled={loading}>
                {loading ? t.loading : t.cta}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">{t.checkoutHint}</p>
            </div>
          </form>

          {/* Trust */}
          <div className="grid sm:grid-cols-3 gap-6 mt-12 pt-8 border-t border-border">
            <div className="text-center">
              <Mail className="mx-auto h-8 w-8 text-primary mb-2" aria-hidden="true" />
              <h3 className="font-semibold mb-1">{t.trust1Title}</h3>
              <p className="text-sm text-muted-foreground">{t.trust1Text}</p>
            </div>
            <div className="text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary mb-2" aria-hidden="true" />
              <h3 className="font-semibold mb-1">{t.trust2Title}</h3>
              <p className="text-sm text-muted-foreground">{t.trust2Text}</p>
            </div>
            <div className="text-center">
              <MapPin className="mx-auto h-8 w-8 text-primary mb-2" aria-hidden="true" />
              <h3 className="font-semibold mb-1">{t.trust3Title}</h3>
              <p className="text-sm text-muted-foreground">{t.trust3Text}</p>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <h2 className="text-2xl font-serif font-bold mb-6 text-center">{t.faqTitle}</h2>
            <div className="space-y-4">
              {t.faq.map((q, i) => (
                <details key={i} className="rounded-lg border border-border bg-card p-4">
                  <summary className="font-medium cursor-pointer">{q.q}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{q.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

const COPY = {
  de: {
    metaTitle: "STORIA Gutschein verschenken | Restaurant-Gutschein München",
    metaDescription: "Geschenkgutschein für das STORIA in München. Frei wählbarer Betrag, sofort per E-Mail, einlösbar im Restaurant. 3 Jahre gültig.",
    heroTitle: "STORIA Gutschein verschenken",
    heroSub: "Italienische Küche mitten in München. Wähle einen Betrag, schreib eine persönliche Nachricht — der Gutschein kommt sofort per E-Mail.",
    stepAmount: "1. Betrag wählen",
    customAmountLabel: "Freibetrag (10 – 500 €)",
    stepRecipient: "2. Empfänger & Nachricht",
    recipientName: "Empfänger-Name",
    purchaserName: "Dein Name",
    optional: "(optional)",
    messageLabel: "Persönliche Nachricht",
    messageLimit: "max. 300 Zeichen",
    messagePlaceholder: "Alles Liebe zum Geburtstag! …",
    recipientEmail: "Empfänger-E-Mail",
    recipientEmailHelp: "Wenn angegeben, schicken wir den Gutschein zusätzlich direkt an den Beschenkten.",
    stepPurchaser: "3. Deine E-Mail",
    purchaserEmail: "E-Mail",
    purchaserEmailHelp: "An diese Adresse senden wir den Gutschein-PDF und die Rechnung.",
    agbPre: "Ich akzeptiere die",
    agbTerms: "AGB für Gutscheine",
    agbAnd: "und die",
    agbPrivacy: "Datenschutzerklärung",
    agbPost: ".",
    total: "Gesamt",
    cta: "Jetzt sicher bezahlen",
    loading: "Weiterleitung zu Stripe …",
    checkoutHint: "Bezahlung erfolgt sicher über Stripe. Du wirst weitergeleitet.",
    errAmount: "Bitte einen Betrag zwischen 10 € und 500 € wählen.",
    errEmail: "Bitte eine gültige E-Mail angeben.",
    errAgb: "Bitte AGB und Datenschutz akzeptieren.",
    errMessage: "Nachricht darf max. 300 Zeichen lang sein.",
    errGeneric: "Es ist ein Fehler aufgetreten",
    trust1Title: "Sofort per E-Mail",
    trust1Text: "Du erhältst den Gutschein als PDF direkt nach der Zahlung.",
    trust2Title: "3 Jahre gültig",
    trust2Text: "Verjährungsfrist: 3 Jahre zum Jahresende (BGB).",
    trust3Title: "Einlösung vor Ort",
    trust3Text: "Karlstraße 47a, 80333 München — einfach vorzeigen.",
    faqTitle: "Häufige Fragen",
    faq: [
      { q: "Wann kommt der Gutschein an?", a: "Sofort nach erfolgreicher Zahlung wird der Gutschein als PDF per E-Mail versendet — in der Regel innerhalb weniger Minuten." },
      { q: "Wie lange ist der Gutschein gültig?", a: "Drei volle Kalenderjahre, jeweils zum Jahresende (gesetzliche Verjährungsfrist nach § 195 BGB)." },
      { q: "Kann ich den Gutschein online einlösen?", a: "Nein. Der Gutschein wird ausschließlich vor Ort im Restaurant STORIA in der Karlstraße 47a, München, eingelöst." },
      { q: "Was passiert mit dem Restbetrag?", a: "Ein nicht vollständig genutzter Betrag bleibt bis zum Gültigkeitsende auf dem Code erhalten und kann beim nächsten Besuch verwendet werden." },
      { q: "Erhalte ich eine Rechnung?", a: "Ja, die Rechnung wird automatisch per E-Mail zugestellt." },
      { q: "Gilt das Widerrufsrecht?", a: "Bei digital zugestellten Gutscheinen erlischt das Widerrufsrecht mit der Erstellung — siehe AGB für Gutscheine." },
    ],
  },
  en: {
    metaTitle: "STORIA Gift Voucher | Restaurant voucher Munich",
    metaDescription: "Gift voucher for STORIA in Munich. Choose any amount, delivered instantly by email, redeemable at the restaurant. Valid for 3 years.",
    heroTitle: "Give a STORIA gift voucher",
    heroSub: "Italian cuisine in the heart of Munich. Pick an amount, add a personal note — the voucher arrives by email instantly.",
    stepAmount: "1. Choose amount",
    customAmountLabel: "Custom amount (€10 – €500)",
    stepRecipient: "2. Recipient & message",
    recipientName: "Recipient name",
    purchaserName: "Your name",
    optional: "(optional)",
    messageLabel: "Personal message",
    messageLimit: "max. 300 characters",
    messagePlaceholder: "Happy birthday! …",
    recipientEmail: "Recipient email",
    recipientEmailHelp: "If provided, we'll also send the voucher directly to the recipient.",
    stepPurchaser: "3. Your email",
    purchaserEmail: "Email",
    purchaserEmailHelp: "We'll send the voucher PDF and the invoice to this address.",
    agbPre: "I accept the",
    agbTerms: "voucher terms",
    agbAnd: "and the",
    agbPrivacy: "privacy policy",
    agbPost: ".",
    total: "Total",
    cta: "Pay securely now",
    loading: "Redirecting to Stripe …",
    checkoutHint: "Payment is processed securely via Stripe. You will be redirected.",
    errAmount: "Please choose an amount between €10 and €500.",
    errEmail: "Please enter a valid email address.",
    errAgb: "Please accept the terms and privacy policy.",
    errMessage: "Message must be max. 300 characters.",
    errGeneric: "An error occurred",
    trust1Title: "Instant email delivery",
    trust1Text: "You'll receive the voucher PDF right after payment.",
    trust2Title: "Valid for 3 years",
    trust2Text: "Statutory limitation period: 3 years to year-end (German Civil Code).",
    trust3Title: "Redeem in person",
    trust3Text: "Karlstraße 47a, 80333 Munich — just show it at the table.",
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "When does the voucher arrive?", a: "Right after successful payment — usually within a few minutes — as a PDF by email." },
      { q: "How long is the voucher valid?", a: "Three full calendar years, each to year-end (statutory limitation period under § 195 BGB)." },
      { q: "Can I redeem the voucher online?", a: "No. The voucher can only be redeemed in person at STORIA, Karlstraße 47a, Munich." },
      { q: "What happens to a remaining balance?", a: "Any unused balance remains on the code until the expiry date and can be used on your next visit." },
      { q: "Do I get an invoice?", a: "Yes, the invoice is sent automatically by email." },
      { q: "Does the right of withdrawal apply?", a: "For vouchers delivered digitally the right of withdrawal expires upon creation — see voucher terms." },
    ],
  },
};

export default Gutschein;