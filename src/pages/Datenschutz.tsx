import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import LegalDocument, { type LegalPart } from "@/components/legal/LegalDocument";
import legalText from "@/content/legal/datenschutz.json";

/**
 * Datenschutzerklärung der Speranza GmbH — gemeinsamer Text für events-storia.de und ristorantestoria.de.
 * Quelle: src/content/legal/datenschutz.json (siehe README.md dort), hier unverändert gerendert.
 */
const parts = legalText as LegalPart[];
const PAGE_TITLE = "Datenschutzerklärung";

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

export default Datenschutz;
