import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import LegalDocument, { type LegalPart } from "@/components/legal/LegalDocument";
import legalText from "@/content/legal/impressum.json";

/**
 * Impressum der Speranza GmbH — gemeinsamer Text für events-storia.de und ristorantestoria.de.
 * Quelle: src/content/legal/impressum.json (siehe README.md dort), hier unverändert gerendert.
 */
const parts = legalText as LegalPart[];
const PAGE_TITLE = "Impressum";

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
              {PAGE_TITLE}
            </h1>

            <LegalDocument parts={parts} pageTitle={PAGE_TITLE} />
          </div>
        </main>

        <Footer />
        <FloatingActions />
      </div>
    </>
  );
};

export default Impressum;
