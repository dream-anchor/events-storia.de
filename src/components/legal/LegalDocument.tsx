/**
 * Rendert einen Rechtstext im gemeinsamen JSON-Schema (src/content/legal/*.json,
 * src/content/agb-2026-10.json):
 *   Teil[] → { title, sections: [{ title, blocks: [p | ul | ol] }] }
 * Absätze dürfen Zeilenumbrüche (\n) enthalten und werden mit whitespace-pre-line gesetzt.
 */

export type LegalListItem = { text: string; sub?: string[] };
export type LegalBlock =
  | { type: "p"; text: string; strong?: boolean }
  | { type: "ul" | "ol"; items: LegalListItem[] };
export type LegalSection = { title: string; blocks: LegalBlock[] };
export type LegalPart = { title: string; sections: LegalSection[] };

/** Anker für Abschnitte wie „1. Geltungsbereich“ → abschnitt-1; sonst laufende Nummer. */
export const defaultSectionId = (title: string, index: number) => {
  const match = title.match(/^\s*(\d+)/);
  return `abschnitt-${match ? match[1] : index + 1}`;
};

/** Anker für AGB-Paragrafen wie „§ 28 Geltung …“ → paragraf-28. */
export const paragraphSectionId = (title: string) => {
  const match = title.match(/§\s*(\d+)/);
  return match ? `paragraf-${match[1]}` : undefined;
};

/** Anker für Teile: teil-a, teil-b, … */
export const defaultPartId = (index: number) => `teil-${String.fromCharCode(97 + index)}`;

interface LegalDocumentProps {
  parts: LegalPart[];
  /** Seitentitel (h1). Ein einziger Teil mit genau diesem Titel bekommt keine eigene h2. */
  pageTitle?: string;
  sectionIdFor?: (title: string, index: number) => string | undefined;
  partIdFor?: (index: number) => string | undefined;
  className?: string;
}

const LegalBlockView = ({ block }: { block: LegalBlock }) => {
  if (block.type === "p") {
    return (
      <p className={`mb-3 whitespace-pre-line${block.strong ? " font-semibold text-foreground" : ""}`}>
        {block.text}
      </p>
    );
  }
  const ListTag = block.type === "ol" ? "ol" : "ul";
  return (
    <ListTag className={`${block.type === "ol" ? "list-decimal" : "list-disc"} pl-6 mb-3 space-y-2`}>
      {block.items.map((item, ii) => (
        <li key={ii} className="whitespace-pre-line">
          {item.text}
          {item.sub && item.sub.length > 0 && (
            <ol className="list-[lower-alpha] pl-6 mt-2 space-y-1">
              {item.sub.map((sub, si) => (
                <li key={si}>{sub}</li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ListTag>
  );
};

const LegalDocument = ({
  parts,
  pageTitle,
  sectionIdFor = defaultSectionId,
  partIdFor = () => undefined,
  className = "prose prose-lg max-w-none space-y-8 text-foreground/90",
}: LegalDocumentProps) => {
  const hidePartHeading =
    parts.length === 1 && pageTitle !== undefined && parts[0].title.trim() === pageTitle.trim();
  let sectionCounter = 0;

  return (
    <div className={className}>
      {parts.map((part, pi) => (
        <section key={part.title} id={partIdFor(pi)} className="scroll-mt-32">
          {!hidePartHeading && (
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mt-12 mb-4">
              {part.title}
            </h2>
          )}
          {part.sections.map((section) => {
            const id = sectionIdFor(section.title, sectionCounter++);
            return (
              <section key={section.title} id={id} className="scroll-mt-32">
                <h3 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  {section.title}
                </h3>
                {section.blocks.map((block, bi) => (
                  <LegalBlockView key={bi} block={block} />
                ))}
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
};

export default LegalDocument;
