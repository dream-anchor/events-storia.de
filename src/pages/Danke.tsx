import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail } from "lucide-react";

const Danke = () => {
  const { language } = useLanguage();
  const isDE = language === "de";
  const [params] = useSearchParams();
  const rawName = (params.get("name") || "").trim();
  // Nur anzeigen, wenn plausibler Name (kein HTML/Markup, sinnvolle Länge)
  const name = rawName.length > 0 && rawName.length <= 80 ? rawName.replace(/[<>]/g, "") : "";

  return (
    <>
      <Helmet>
        <title>{isDE ? "Anfrage erhalten — STORIA" : "Inquiry received — STORIA"}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen bg-background">
        <section className="container mx-auto px-4 py-16 md:py-24 max-w-2xl text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-6" aria-hidden="true" />
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {isDE
              ? `Vielen Dank für deine Anfrage${name ? `, ${name}` : ""}!`
              : `Thank you for your inquiry${name ? `, ${name}` : ""}!`}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {isDE
              ? "Unser Team meldet sich in Kürze bei dir — in der Regel innerhalb von 24 Stunden an Werktagen."
              : "Our team will get back to you shortly — usually within 24 hours on business days."}
          </p>

          <div className="bg-secondary/40 rounded-xl p-6 border border-border mb-8 text-left">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold mb-2">
                  {isDE ? "Noch etwas hinzuzufügen?" : "Anything to add?"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isDE
                    ? "Schreib uns jederzeit an "
                    : "Just write to us at "}
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

export default Danke;
