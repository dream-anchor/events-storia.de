import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import { LocalizedLink } from "@/components/LocalizedLink";

const AGBGutscheine = () => {
  return (
    <>
      <SEO 
        title="AGB für Gutscheine"
        description="AGB für Gutscheine von STORIA München: Gültigkeit, Einlösung und Erstattungsbedingungen für Geschenkgutscheine."
        noIndex={true}
      />
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            AGB für Gutscheine
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                1. Vertragspartner
              </h2>
              <p>
                Vertragspartner für den Kauf von Gutscheinen ist die:<br /><br />
                Speranza GmbH<br />
                Karlstraße 47a<br />
                80333 München<br />
                Telefon: +49 89 51519696<br />
                E-Mail: info@events-storia.de
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                2. Vertragsschluss
              </h2>
              <p>
                Der Kaufvertrag über einen Gutschein kommt mit Eingang der Zahlung zustande. 
                Mit der Zahlung wird der Gutschein aktiviert und ist ab diesem Zeitpunkt einlösbar.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                3. Einlösung
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Gültigkeit:</strong> Gutscheine sind bis zum 31. Dezember des dritten Jahres
                  nach dem Kauf gültig (z. B. Kauf im Jahr 2026: gültig bis 31.12.2029). Das
                  Gültigkeitsdatum ist auf dem Gutschein vermerkt.
                </li>
                <li>
                  <strong>Keine Barauszahlung:</strong> Eine Auszahlung des Gutscheinwertes in bar 
                  ist nicht möglich.
                </li>
                <li>
                  <strong>Übertragbarkeit:</strong> Gutscheine sind frei übertragbar.
                </li>
                <li>
                  <strong>Restwert:</strong> Wird der Gutschein nicht vollständig eingelöst, 
                  bleibt der Restwert erhalten und kann bei einem späteren Besuch eingelöst werden.
                </li>
                <li>
                  <strong>Einlöseort:</strong> Gutscheine können ausschließlich im Restaurant 
                  STORIA in München eingelöst werden.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Versand
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Gutscheine werden per E-Mail als PDF-Datei versendet, in der Regel wenige Minuten nach erfolgreicher Zahlung.</li>
                <li>Es fallen keine Versandkosten an.</li>
                <li>Ein postalischer Versand findet nicht statt.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                5. Preise & Zahlungsarten
              </h2>
              <p>
                Es gelten die zum Zeitpunkt der Bestellung auf unserer Website bzw. im Restaurant 
                angegebenen Preise. Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer.
              </p>
              <p className="mt-4">
                Die Zahlung erfolgt online über den Zahlungsdienstleister Stripe Payments Europe Ltd.
                Welche Zahlungsarten zur Verfügung stehen (z. B. Kreditkarte, Apple Pay, Google Pay),
                zeigt der Bestellprozess.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                6. Widerrufsrecht
              </h2>
              <p>
                Verbrauchern steht beim Kauf von Gutscheinen ein 14-tägiges Widerrufsrecht zu. Es
                erlischt nicht bereits mit der Erstellung oder dem Versand des Gutscheins. Weitere
                Informationen finden Sie in unserer{" "}
                <LocalizedLink to="legal.withdrawal" className="text-primary hover:underline">
                  Widerrufsbelehrung
                </LocalizedLink>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                7. Verlust des Gutscheins
              </h2>
              <p>
                Bei Verlust eines Gutscheins kann kein Ersatz ausgestellt werden. 
                Wir empfehlen, den Gutschein (PDF) sicher zu speichern.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                8. Schlussbestimmungen
              </h2>
              <p>
                Es gilt deutsches Recht. Die Unwirksamkeit einzelner Bestimmungen berührt 
                nicht die Gültigkeit der übrigen Bedingungen.
              </p>
            </section>

            <section className="mt-12 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Stand: 28. September 2026
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingActions />
    </div>
    </>
  );
};

export default AGBGutscheine;
