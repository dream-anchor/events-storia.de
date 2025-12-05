import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

const Datenschutz = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Datenschutzerklärung
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            
            {/* 1. Verantwortlicher */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mb-3">
                1. Verantwortlicher
              </h2>
              <p>
                <strong>Speranza GmbH</strong><br />
                Karlstraße 47a<br />
                80333 München<br />
              Telefon:{" "}
                <a href="tel:+498951519696" className="text-primary hover:underline">
                  +49 89 51519696
                </a><br />
                E-Mail:{" "}
                <a href="mailto:info@ristorantestoria.de" className="text-primary hover:underline">
                  info@ristorantestoria.de
                </a>
              </p>
              <p className="mt-2">
                <strong>Vertreten durch:</strong> Agnese Lettieri
              </p>
            </section>

            {/* 2. Erhebung und Speicherung */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                2. Erhebung und Speicherung personenbezogener Daten
              </h2>
              <p>
                Wir verarbeiten personenbezogene Daten nur, soweit dies für die Bereitstellung 
                unserer Website, zur Kommunikation oder zur Durchführung von Reservierungen erforderlich ist.
              </p>
              <p className="mt-4">
                <strong>Verarbeitet werden u. a.:</strong>
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>IP-Adresse</li>
                <li>Datum und Uhrzeit der Anfrage</li>
                <li>Name, E-Mail-Adresse, Telefonnummer (z. B. über Kontaktformular oder Reservierung)</li>
                <li>Technische Browserdaten</li>
              </ul>
              <p className="mt-4">
                <strong>Rechtsgrundlagen:</strong> Art. 6 Abs. 1 lit. a, b, f DSGVO
              </p>
            </section>

            {/* 3. Kontaktformular & Reservierungen */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                3. Kontaktformular & Reservierungen
              </h2>
              <p>
                Bei Anfragen oder Reservierungen verarbeiten wir die Daten ausschließlich zur 
                Bearbeitung der Anfrage. Speicherung: bis Zweck erledigt ist, anschließend Löschung.
              </p>
              <p className="mt-2">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO
              </p>
            </section>

            {/* 4. Cookies */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Cookies
              </h2>
              <p>
                Unsere Website verwendet technisch notwendige Cookies. Sofern Analyse- oder 
                Marketing-Cookies eingesetzt werden, holen wir vorher eine Einwilligung (Consent Banner) ein.
              </p>
            </section>

            {/* 5. Server-Logfiles */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                5. Server-Logfiles
              </h2>
              <p>
                Der Hosting-Anbieter erhebt automatisch Daten (IP, Datum, Browser etc.). 
                Dies ist technisch erforderlich, um die Website bereitzustellen.
              </p>
              <p className="mt-2">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO
              </p>
            </section>

            {/* 6. Weitergabe an Dritte */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                6. Weitergabe an Dritte
              </h2>
              <p>Eine Weitergabe erfolgt nur, wenn:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>dies zur Vertragserfüllung erforderlich ist (z. B. Reservierungssystem)</li>
                <li>eine gesetzliche Verpflichtung besteht</li>
                <li>eine Einwilligung vorliegt</li>
              </ul>
            </section>

            {/* 7. Externe Dienste */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                7. Einsatz externer Dienste
              </h2>
              
              <h3 className="text-lg font-semibold mt-4 mb-2">OpenTable (Reservierung)</h3>
              <p>
                Für Online-Reservierungen nutzen wir den Dienst OpenTable. Bei einer Reservierung 
                werden Ihre Daten an OpenTable übermittelt. Die Datenschutzerklärung von OpenTable 
                finden Sie unter:{" "}
                <a 
                  href="https://www.opentable.de/legal/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://www.opentable.de/legal/privacy-policy
                </a>
              </p>

              <h3 className="text-lg font-semibold mt-4 mb-2">Google Maps</h3>
              <p>
                Wir nutzen Google Maps zur Darstellung unseres Standorts. Beim Laden der Karte 
                werden Daten an Google übertragen. Die Datenschutzerklärung von Google finden Sie unter:{" "}
                <a 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://policies.google.com/privacy
                </a>
              </p>
            </section>

            {/* 8. Speicherdauer */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                8. Dauer der Speicherung
              </h2>
              <p>
                Personenbezogene Daten werden gelöscht, sobald der Zweck entfällt, oder 
                gesetzliche Aufbewahrungsfristen abgelaufen sind.
              </p>
            </section>

            {/* 9. Betroffenenrechte */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                9. Betroffenenrechte (DSGVO)
              </h2>
              <p>Nutzer haben das Recht auf:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Auskunft</li>
                <li>Berichtigung</li>
                <li>Löschung</li>
                <li>Einschränkung der Verarbeitung</li>
                <li>Datenübertragbarkeit</li>
                <li>Widerruf von Einwilligungen</li>
                <li>Beschwerde bei einer Aufsichtsbehörde</li>
              </ul>
            </section>

            {/* 10. Sicherheit */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                10. Sicherheit
              </h2>
              <p>
                Wir verwenden SSL/TLS-Verschlüsselung zum Schutz der übertragenen Daten.
              </p>
            </section>

            {/* 11. Aktualität */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                11. Aktualität
              </h2>
              <p>
                Diese Datenschutzerklärung wird regelmäßig aktualisiert.
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

export default Datenschutz;
