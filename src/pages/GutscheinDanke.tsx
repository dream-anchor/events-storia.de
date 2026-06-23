import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const GutscheinDanke = () => {
  const { language } = useLanguage();
  const isDE = language === "de";
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  useEffect(() => {
    if (sessionId) {
      trackEvent("purchase", {
        location: "gutschein",
        transaction_id: sessionId,
      });
    }
  }, [sessionId]);

  return (
    <>
      <Helmet>
        <title>{isDE ? "Gutschein bestellt — STORIA" : "Voucher ordered — STORIA"}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen bg-background">
        <section className="container mx-auto px-4 py-16 md:py-24 max-w-2xl text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-6" aria-hidden="true" />
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {isDE ? "Vielen Dank für deinen Kauf!" : "Thank you for your purchase!"}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {isDE
              ? "Wir bereiten deinen Gutschein gerade vor. In wenigen Minuten findest du eine E-Mail mit dem PDF-Gutschein und der Rechnung in deinem Postfach."
              : "We're preparing your voucher right now. Within a few minutes you'll find an email with the PDF voucher and the invoice in your inbox."}
          </p>

          <div className="bg-secondary/40 rounded-xl p-6 border border-border mb-8 text-left">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold mb-2">
                  {isDE ? "Keine E-Mail erhalten?" : "Didn't receive an email?"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isDE
                    ? "Bitte prüfe deinen Spam-Ordner. Falls die E-Mail nach 15 Minuten immer noch nicht da ist, melde dich kurz bei "
                    : "Please check your spam folder. If the email still hasn't arrived after 15 minutes, please contact "}
                  <a href="mailto:info@events-storia.de" className="underline text-primary">info@events-storia.de</a>.
                </p>
              </div>
            </div>
          </div>

          <Button asChild variant="outline">
            <Link to={isDE ? "/" : "/en"}>{isDE ? "Zur Startseite" : "Back to home"}</Link>
          </Button>
        </section>
      </main>
    </>
  );
};

export default GutscheinDanke;