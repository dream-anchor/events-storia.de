import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import { Link } from "react-router-dom";

const AGBGutscheine = () => {
  return (
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
                E-Mail: info@ristorantestoria.de
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
                  <strong>Gültigkeit:</strong> Gutscheine sind 3 Jahre ab Ausstellungsdatum gültig 
                  (§ 195 BGB). Das Ausstellungsdatum ist auf dem Gutschein vermerkt.
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
              <p><strong>Digitale Gutscheine:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Werden per E-Mail als PDF-Datei versendet</li>
                <li>Versand erfolgt in der Regel innerhalb von 24 Stunden nach Zahlungseingang</li>
                <li>Keine Versandkosten</li>
              </ul>
              
              <p className="mt-4"><strong>Postalischer Versand:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Auf Wunsch versenden wir Gutscheine per Post</li>
                <li>Versandkosten: 2,50 € (Standardversand)</li>
                <li>Lieferzeit: 3-5 Werktage</li>
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
              <p className="mt-4">Akzeptierte Zahlungsarten:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Kreditkarte (Visa, Mastercard, American Express)</li>
                <li>PayPal</li>
                <li>Sofortüberweisung</li>
                <li>EC-Karte (bei Kauf im Restaurant)</li>
                <li>Barzahlung (bei Kauf im Restaurant)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                6. Widerrufsrecht
              </h2>
              <p>
                Für digitale Gutscheine gilt ein 14-tägiges Widerrufsrecht. Weitere Informationen 
                finden Sie in unserer{" "}
                <Link to="/widerrufsbelehrung" className="text-primary hover:underline">
                  Widerrufsbelehrung
                </Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                7. Verlust des Gutscheins
              </h2>
              <p>
                Bei Verlust eines Gutscheins kann kein Ersatz ausgestellt werden. 
                Wir empfehlen, digitale Gutscheine sicher zu speichern und physische 
                Gutscheine sorgfältig aufzubewahren.
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
                Stand: Dezember 2024
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingActions />
    </div>
  );
};

export default AGBGutscheine;
