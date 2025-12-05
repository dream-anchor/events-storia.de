import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import { CreditCard, Banknote, Smartphone, Gift } from "lucide-react";

const Zahlungsinformationen = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Zahlungsinformationen
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Im Restaurant
              </h2>
              <p>Folgende Zahlungsmittel werden im Restaurant akzeptiert:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Barzahlung</strong> in Euro</li>
                <li><strong>EC-Karte</strong> (Girocard, Maestro, V Pay)</li>
                <li><strong>Kreditkarte</strong> (Visa, Mastercard, American Express)</li>
                <li><strong>Apple Pay</strong></li>
                <li><strong>Google Pay</strong></li>
                <li><strong>STORIA-Gutscheine</strong></li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Online-Zahlungen
              </h2>
              <p>Für Online-Bestellungen (z.B. Gutscheinkauf) akzeptieren wir:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Kreditkarte</strong> (Visa, Mastercard, American Express)</li>
                <li><strong>PayPal</strong></li>
                <li><strong>Sofortüberweisung</strong> (Klarna)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Gutscheine
              </h2>
              <p>
                STORIA-Gutscheine können im Restaurant bei der Bezahlung eingelöst werden. 
                Der Gutscheinwert wird vom Rechnungsbetrag abgezogen. Ein Restbetrag bleibt 
                auf dem Gutschein erhalten und kann bei einem späteren Besuch eingelöst werden.
              </p>
              <p>
                Gutscheine können nicht mit anderen Aktionen oder Rabatten kombiniert werden, 
                sofern nicht ausdrücklich anders angegeben.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Preise & Mehrwertsteuer
              </h2>
              <p>
                Alle auf unserer Speisekarte und Website angegebenen Preise verstehen sich 
                <strong> inklusive der gesetzlichen Mehrwertsteuer</strong> (derzeit 19% für 
                Getränke und Speisen zum Verzehr im Restaurant, 7% für Speisen zum Mitnehmen).
              </p>
              <p className="mt-4 p-4 bg-secondary/30 rounded-lg border border-border">
                <strong>Hinweis:</strong> Die auf unserer Website angegebenen Preise dienen 
                der Information und können von den aktuellen Preisen im Restaurant abweichen. 
                Maßgeblich sind ausschließlich die Preise in unserer aktuellen Speisekarte vor Ort.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Trinkgeld
              </h2>
              <p>
                Trinkgeld ist bei uns natürlich nicht verpflichtend, wird aber von unserem 
                Team sehr geschätzt. Trinkgeld kann bar oder bei Kartenzahlung direkt am 
                Terminal hinzugefügt werden.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Rechnungen & Belege
              </h2>
              <p>
                Sie erhalten selbstverständlich einen ordnungsgemäßen Beleg für Ihre Zahlung. 
                Auf Wunsch stellen wir Ihnen auch eine detaillierte Rechnung für 
                geschäftliche Zwecke aus.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Fragen zur Zahlung?
              </h2>
              <p>
                Bei Fragen zu Zahlungsmöglichkeiten kontaktieren Sie uns gerne:
              </p>
              <p className="mt-2">
                <strong>Telefon:</strong>{" "}
                <a href="tel:+498951519696" className="text-primary hover:underline">
                  +49 89 51519696
                </a>
                <br />
                <strong>E-Mail:</strong>{" "}
                <a href="mailto:info@ristorantestoria.de" className="text-primary hover:underline">
                  info@ristorantestoria.de
                </a>
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

export default Zahlungsinformationen;
