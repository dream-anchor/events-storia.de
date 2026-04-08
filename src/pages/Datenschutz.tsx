import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";

const Datenschutz = () => {
  return (
    <>
      <SEO 
        title="Datenschutzerklärung"
        description="Datenschutzerklärung der Speranza GmbH (STORIA München): Informationen zur Verarbeitung Ihrer Daten gemäß DSGVO."
        noIndex={true}
      />
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Datenschutzerklärung
          </h1>
          
          <div className="prose prose-xl max-w-none space-y-8 text-foreground/90">
            
            {/* 1. Verantwortlicher */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mb-3">
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
                <a href="mailto:info@events-storia.de" className="text-primary hover:underline">
                  info@events-storia.de
                </a>
              </p>
              <p className="mt-2">
                <strong>Vertreten durch:</strong> Agnese Lettieri
              </p>
            </section>

            {/* 2. Erhebung und Speicherung */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
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
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
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
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Cookies
              </h2>
              <p>
                Unsere Website verwendet technisch notwendige Cookies. Sofern Analyse- oder 
                Marketing-Cookies eingesetzt werden, holen wir vorher eine Einwilligung (Consent Banner) ein.
              </p>
            </section>

            {/* 5. Server-Logfiles */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
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
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
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
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
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

              <h3 className="text-lg font-semibold mt-4 mb-2">Elfsight Reviews Widget</h3>
              <p>
                Wir nutzen das Elfsight-Widget zur Anzeige von Kundenbewertungen von Google, 
                TripAdvisor und Facebook. Das Widget wird nur geladen, wenn Sie der Nutzung 
                externer Dienste zugestimmt haben (Cookie-Kategorie "Externe Inhalte").
              </p>
              <p className="mt-2">
                <strong>Anbieter:</strong> Elfsight LLC, 1013 Centre Road, Suite 403-B, Wilmington, DE 19805, USA
              </p>
              <p className="mt-2">
                Beim Laden des Widgets werden Daten an elfsightcdn.com übertragen. 
                Die Datenschutzerklärung von Elfsight finden Sie unter:{" "}
                <a 
                  href="https://elfsight.com/privacy-policy/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://elfsight.com/privacy-policy/
                </a>
              </p>
              <p className="mt-2">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)
              </p>
            </section>

            {/* Stripe */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                8. Zahlungsabwicklung über Stripe
              </h2>
              <p>
                Für die Abwicklung von Zahlungen nutzen wir den Dienst des Zahlungsdienstleisters{" "}
                <strong>Stripe Payments Europe Ltd.</strong>, 1 Grand Canal Street Lower, Grand Canal Dock,
                Dublin, D02 H210, Irland (nachfolgend „Stripe").
              </p>
              <p className="mt-2">
                Wenn Sie eine Zahlung über unsere Website vornehmen, werden die von Ihnen eingegebenen
                Zahlungsdaten (z. B. Name des Karteninhabers, Kreditkartennummer, Kontonummer,
                Rechnungsbetrag) direkt an Stripe übermittelt und dort verarbeitet. Zu den verarbeiteten
                Daten gehören insbesondere: Name und Adresse, Zahlungsdaten (Kreditkartennummer, IBAN),
                E-Mail-Adresse, Transaktionsdaten sowie IP-Adresse.
              </p>
              <p className="mt-2">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie
                Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer Zahlungsabwicklung).
                Stripe ist Teilnehmer am EU-US Data Privacy Framework.
              </p>
              <p className="mt-2">
                Weitere Informationen:{" "}
                <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  stripe.com/de/privacy
                </a>
              </p>
            </section>

            {/* Billie */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                9. Kauf auf Rechnung über Billie (Geschäftskunden)
              </h2>
              <p>
                Für Geschäftskunden bieten wir die Zahlungsmethode „Kauf auf Rechnung" über den
                Zahlungsdienstleister <strong>Billie GmbH</strong>, Charlottenstraße 4, 10969 Berlin
                (nachfolgend „Billie") an.
              </p>
              <p className="mt-2">
                Wenn Sie als Geschäftskunde diese Zahlungsmethode wählen, werden zur Durchführung einer
                Bonitäts- und Identitätsprüfung in Echtzeit folgende Daten an Billie übermittelt:
                Firmenname und Rechtsform, Geschäftsadresse, Name des Bestellers, E-Mail-Adresse sowie
                Bestelldaten (Betrag, Beschreibung). Billie führt anhand dieser Daten eine automatisierte
                Bonitätsprüfung durch. Im Falle der Annahme übernimmt Billie das vollständige Ausfallrisiko.
              </p>
              <p className="mt-2">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie
                Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Dienstleisters an der Bonitätsprüfung).
              </p>
              <p className="mt-2">
                Weitere Informationen:{" "}
                <a href="https://www.billie.io/de/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  billie.io/de/datenschutz
                </a>
              </p>
            </section>

            {/* Resend */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                10. E-Mail-Versand über Resend
              </h2>
              <p>
                Für den Versand transaktionsbezogener E-Mails (Angebote, Zahlungsaufforderungen,
                Buchungsbestätigungen) nutzen wir den Dienst <strong>Resend Inc.</strong>,
                2261 Market Street #5039, San Francisco, CA 94114, USA.
              </p>
              <p className="mt-2">
                Im Rahmen des E-Mail-Versands werden Ihre E-Mail-Adresse sowie der Inhalt der jeweiligen
                Nachricht an Resend übermittelt. Resend verarbeitet diese Daten ausschließlich zum Zweck
                des E-Mail-Versands in unserem Auftrag. Die Datenübermittlung in die USA erfolgt auf
                Grundlage von EU-Standardvertragsklauseln.
              </p>
              <p className="mt-2">
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
              </p>
              <p className="mt-2">
                Weitere Informationen:{" "}
                <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  resend.com/legal/privacy-policy
                </a>
              </p>
            </section>

            {/* 11. Speicherdauer */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                11. Dauer der Speicherung
              </h2>
              <p>
                Personenbezogene Daten werden gelöscht, sobald der Zweck entfällt, oder 
                gesetzliche Aufbewahrungsfristen abgelaufen sind.
              </p>
            </section>

            {/* 12. Betroffenenrechte */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                12. Betroffenenrechte (DSGVO)
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

            {/* 13. Sicherheit */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                13. Sicherheit
              </h2>
              <p>
                Wir verwenden SSL/TLS-Verschlüsselung zum Schutz der übertragenen Daten.
              </p>
            </section>

            {/* 14. Aktualität */}
            <section>
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                14. Aktualität
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
    </>
  );
};

export default Datenschutz;
