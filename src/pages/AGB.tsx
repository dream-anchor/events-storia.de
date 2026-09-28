import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";
import agbData from "@/content/agb-2026-10.json";
import { AGB_VERSION, AGB_STAND } from "@/config/legal";
import LegalDocument, {
  defaultPartId,
  paragraphSectionId,
  type LegalPart,
} from "@/components/legal/LegalDocument";

/**
 * Einheitliche AGB (Version AGB-2026-10, Stand 28. September 2026).
 * Ersetzt die früheren Einzelseiten AGB Catering, AGB Veranstaltungen und AGB Restaurant.
 * Der Text liegt ausschließlich als JSON vor (src/content/agb-2026-10.json) und wird hier
 * unverändert gerendert. Nur die deutsche Fassung ist verbindlich.
 */

const parts = agbData as LegalPart[];

const partId = defaultPartId;
const sectionId = paragraphSectionId;

const AGB = () => {
  const { language } = useLanguage();
  const isEn = language === "en";

  return (
    <>
      <SEO
        title={isEn ? "Terms and Conditions (AGB)" : "Allgemeine Geschäftsbedingungen (AGB)"}
        description={
          isEn
            ? "General Terms and Conditions of Speranza GmbH (STORIA Munich) for events, catering offers, the online shop and table reservations. Only the German version is binding."
            : "Allgemeine Geschäftsbedingungen der Speranza GmbH (STORIA München) für Veranstaltungen, Catering-Angebote, den Online-Shop und Tischreservierungen."
        }
        canonical={isEn ? "/en/terms" : "/agb"}
        noIndex={true}
      />
      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-32 pb-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-4 text-center">
              Allgemeine Geschäftsbedingungen
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Stand: {AGB_STAND} · Version {AGB_VERSION} — Speranza GmbH
            </p>

            {isEn && (
              <p
                lang="en"
                className="text-center text-sm text-foreground/80 bg-muted/50 border border-border rounded-md px-4 py-3 mb-10"
              >
                These terms are only available in German. The German version is the only binding version.
              </p>
            )}

            {/* Inhaltsverzeichnis */}
            <nav
              aria-label="Inhaltsverzeichnis"
              className="mb-12 rounded-lg border border-border bg-muted/30 px-6 py-5"
            >
              <p className="font-serif font-semibold text-foreground mb-3">Inhalt</p>
              <ol className="space-y-3 text-sm">
                {parts.map((part, pi) => (
                  <li key={part.title}>
                    <a href={`#${partId(pi)}`} className="font-medium text-foreground hover:text-primary underline-offset-2 hover:underline">
                      {part.title}
                    </a>
                    <ul className="mt-1 pl-4 space-y-0.5 text-muted-foreground">
                      {part.sections.map((section) => {
                        const id = sectionId(section.title);
                        return (
                          <li key={section.title}>
                            {id ? (
                              <a href={`#${id}`} className="hover:text-foreground hover:underline underline-offset-2">
                                {section.title}
                              </a>
                            ) : (
                              section.title
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </nav>

            <LegalDocument
              parts={parts}
              partIdFor={partId}
              sectionIdFor={(title) => sectionId(title)}
            />
          </div>
        </main>

        <Footer />
        <FloatingActions />
      </div>
    </>
  );
};

export default AGB;
