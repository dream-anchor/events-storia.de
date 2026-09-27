import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";
import agbData from "@/content/agb-2026-10.json";
import { AGB_VERSION, AGB_STAND } from "@/config/legal";

/**
 * Einheitliche AGB (Version AGB-2026-10, Stand 28. September 2026).
 * Ersetzt die früheren Einzelseiten AGB Catering, AGB Veranstaltungen und AGB Restaurant.
 * Der Text liegt ausschließlich als JSON vor (src/content/agb-2026-10.json) und wird hier
 * unverändert gerendert. Nur die deutsche Fassung ist verbindlich.
 */

type AgbListItem = { text: string; sub: string[] };
type AgbBlock =
  | { type: "p"; text: string }
  | { type: "ol"; items: AgbListItem[] };
type AgbSection = { title: string; blocks: AgbBlock[] };
type AgbPart = { title: string; sections: AgbSection[] };

const parts = agbData as AgbPart[];

const partId = (index: number) => `teil-${String.fromCharCode(97 + index)}`;
const sectionId = (title: string) => {
  const match = title.match(/§\s*(\d+)/);
  return match ? `paragraf-${match[1]}` : undefined;
};

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

            <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
              {parts.map((part, pi) => (
                <section key={part.title} id={partId(pi)} className="scroll-mt-32">
                  <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mt-12 mb-4">
                    {part.title}
                  </h2>

                  {part.sections.map((section) => (
                    <section key={section.title} id={sectionId(section.title)} className="scroll-mt-32">
                      <h3 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                        {section.title}
                      </h3>
                      {section.blocks.map((block, bi) =>
                        block.type === "p" ? (
                          <p key={bi} className="mb-2">
                            {block.text}
                          </p>
                        ) : (
                          <ol key={bi} className="list-decimal pl-6 space-y-2">
                            {block.items.map((item, ii) => (
                              <li key={ii}>
                                {item.text}
                                {item.sub.length > 0 && (
                                  <ol className="list-[lower-alpha] pl-6 mt-2 space-y-1">
                                    {item.sub.map((sub, si) => (
                                      <li key={si}>{sub}</li>
                                    ))}
                                  </ol>
                                )}
                              </li>
                            ))}
                          </ol>
                        )
                      )}
                    </section>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </main>

        <Footer />
        <FloatingActions />
      </div>
    </>
  );
};

export default AGB;
