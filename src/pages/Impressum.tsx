import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";

const Impressum = () => {
  return (
    <>
      <SEO 
        title="Impressum"
        description="Impressum der Speranza GmbH - Ristorante STORIA München. Rechtliche Angaben, Kontaktdaten und Firmendaten."
        canonical="/impressum"
        noIndex={false}
      />
      <div className="min-h-screen bg-background">
        <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Impressum
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            {/* Firmenadresse */}
            <section>
              <p className="font-semibold text-lg">Speranza GmbH</p>
              <p>
                Karlstraße 47a<br />
                80333 München<br />
                Deutschland
              </p>
            </section>

            {/* Kontakt */}
            <section>
              <p>
                <strong>Telefon:</strong>{" "}
                <a href="tel:+498951519696" className="text-primary hover:underline">
                  +49 89 51519696
                </a>
              </p>
              <p>
                <strong>E-Mail:</strong>{" "}
                <a href="mailto:info@ristorantestoria.de" className="text-primary hover:underline">
                  info@ristorantestoria.de
                </a>
              </p>
            </section>

            {/* Vertretung */}
            <section>
              <p>
                <strong>Vertreten durch die Geschäftsführerin:</strong><br />
                Agnese Lettieri
              </p>
            </section>

            {/* Handelsregister */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Registereintrag
              </h2>
              <p>
                Eingetragen im Handelsregister des Amtsgerichts München<br />
                <strong>Handelsregisternummer:</strong> HRB 209637
              </p>
            </section>

            {/* Steuern */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Umsatzsteuer-ID
              </h2>
              <p>DE 296024880</p>
              
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Steuernummer
              </h2>
              <p>143/182/00980</p>
            </section>

            {/* Inhaltlich Verantwortlicher */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Inhaltlich Verantwortliche gemäß § 18 Abs. 2 MStV
              </h2>
              <p>
                Agnese Lettieri<br />
                Karlstraße 47a<br />
                80333 München
              </p>
            </section>

            {/* Berufsbezogene Angaben */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Berufsbezogene Angaben
              </h2>
              <p>Gewerbebetrieb Gastronomie (nach § 14 GewO angemeldet)</p>
            </section>

            {/* EU-Streitschlichtung */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                EU-Streitschlichtung
              </h2>
              <p>
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                <a 
                  href="https://ec.europa.eu/consumers/odr/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
              </p>
              <p className="mt-4">
                Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren 
                vor einer Verbraucherschlichtungsstelle teilzunehmen.
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

export default Impressum;
