import type { MenuSelection } from "./types";

export function AnschreibenSection({ emailContent }: { emailContent: string }) {
  const greetingSeparators = [
    "Mit freundlichen Grüßen",
    "Herzliche Grüße",
    "Beste Grüße",
    "Viele Grüße",
  ];

  let bodyText = emailContent;
  let greetingLine = "";
  let senderName = "";

  for (const sep of greetingSeparators) {
    const idx = emailContent.indexOf(sep);
    if (idx !== -1) {
      bodyText = emailContent.slice(0, idx).trimEnd();
      const afterGreeting = emailContent.slice(idx);
      const lines = afterGreeting.split('\n').map(l => l.trim()).filter(Boolean);
      greetingLine = lines[0] || sep;
      senderName = lines[1] || "";
      break;
    }
  }

  bodyText = bodyText
    .replace(/über den folgenden Link/gi, "unten")
    .replace(/im folgenden Link/gi, "unten")
    .replace(/unter folgendem Link/gi, "unten");

  bodyText = bodyText
    .replace(/^.*(?:Angebot|Details).*(?:finden|sehen|einsehen).*?https?:\/\/\S+.*$/gim, '')
    .replace(/^.*(?:unter|über|via)\s+(?:folgendem\s+|diesem\s+|dem\s+)?Link\s*:?.*?https?:\/\/\S+.*$/gim, '')
    .replace(/\(\s*(?:Siehe\s+[^)]*?)?Link\s*:?[^)]*?https?:\/\/[^)]+\)/gi, '')
    .replace(/^\s*https?:\/\/\S*(?:\/offer\/|\/ihr-angebot\/|\/your-offer\/)\S*\s*$/gim, '');

  bodyText = bodyText
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return (
    <section className="bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl">
          <div className="font-serif text-base md:text-[1.1rem] leading-[1.75] text-foreground/90 whitespace-pre-line">
            {bodyText}
          </div>

          {greetingLine && (
            <div className="mt-8 text-foreground/80 font-serif">
              <p>{greetingLine}</p>
              {senderName && <p className="font-semibold">{senderName}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}