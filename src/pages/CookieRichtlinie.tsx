import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

const CookieRichtlinie = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Cookie-Richtlinie
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                1. Funktionsweise unseres Consent-Systems
              </h2>
              <p>
                Unser DSGVO- und TTDSG-konformes Consent-System unterteilt Cookies in folgende Kategorien 
                und ermöglicht Ihnen eine transparente Auswahl:
              </p>
            </section>

            <section>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Notwendige Cookies
              </h3>
              <p>
                Diese Cookies sind für den technischen Betrieb der Website erforderlich. Sie ermöglichen 
                grundlegende Funktionen wie die Navigation und den Zugang zu geschützten Bereichen der Website. 
                Ohne diese Cookies kann die Website nicht ordnungsgemäß funktionieren.
              </p>
              <p>
                <strong>Rechtsgrundlage:</strong> Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)
              </p>
            </section>

            <section>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Statistik-Cookies
              </h3>
              <p>
                Diese Cookies helfen uns zu verstehen, wie Besucher mit der Website interagieren, 
                indem sie Informationen anonym sammeln und melden. Die Daten werden zur Verbesserung 
                unserer Website genutzt.
              </p>
              <p>
                <strong>Rechtsgrundlage:</strong> Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)
              </p>
            </section>

            <section>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Marketing-Cookies
              </h3>
              <p>
                Diese Cookies werden verwendet, um Besucher über Websites hinweg zu verfolgen. 
                Die Absicht ist, Anzeigen zu zeigen, die für den einzelnen Benutzer relevant und 
                ansprechend sind.
              </p>
              <p>
                <strong>Rechtsgrundlage:</strong> Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)
              </p>
            </section>

            <section>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Externe Dienste
              </h3>
              <p>
                Diese Kategorie umfasst Dienste von Drittanbietern, die in unsere Website eingebettet sind:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Google Maps:</strong> Zur Anzeige unseres Standorts. Bei Aktivierung werden 
                  Daten an Google übertragen.
                </li>
                <li>
                  <strong>OpenTable:</strong> Für unser Online-Reservierungssystem. Bei Aktivierung werden 
                  Daten an OpenTable übertragen.
                </li>
              </ul>
              <p className="mt-4">
                <strong>Rechtsgrundlage:</strong> Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                2. Widerruf der Einwilligung
              </h2>
              <p>
                Sie können Ihre Cookie-Einstellungen jederzeit ändern oder widerrufen. 
                Klicken Sie dazu auf das Cookie-Symbol unten links auf der Seite oder nutzen Sie 
                den Button „Cookie-Einstellungen ändern".
              </p>
              <p>
                Ihre Einwilligung wird in Ihrem Browser gespeichert und kann jederzeit durch 
                Löschen der Browser-Cookies widerrufen werden.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                3. Speicherdauer
              </h2>
              <p>
                Ihre Einwilligungsentscheidung wird für 12 Monate gespeichert. Nach Ablauf dieser 
                Frist werden Sie erneut um Ihre Einwilligung gebeten.
              </p>
              <p>
                Gespeicherte Einwilligungsdaten:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Zeitpunkt der Einwilligung</li>
                <li>Zustand pro Cookie-Kategorie</li>
                <li>Version des Consent-Banners</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Technische Umsetzung
              </h2>
              <p>
                Unser Consent-System blockiert technisch das Laden von nicht-notwendigen Cookies 
                und externen Diensten, bis Sie aktiv Ihre Einwilligung erteilen (Opt-In). 
                Dies entspricht den Anforderungen des EuGH-Urteils „Planet49" sowie der aktuellen 
                deutschen Rechtsprechung (BGH, OLG Rostock 2023).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                5. Kontakt
              </h2>
              <p>
                Bei Fragen zu unserer Cookie-Richtlinie kontaktieren Sie uns bitte:
              </p>
              <p className="mt-2">
                Speranza GmbH<br />
                Karlstraße 47a<br />
                80333 München<br />
                E-Mail:{" "}
                <a href="mailto:info@ristorantestoria.de" className="text-primary hover:underline">
                  info@ristorantestoria.de
                </a>
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

export default CookieRichtlinie;
