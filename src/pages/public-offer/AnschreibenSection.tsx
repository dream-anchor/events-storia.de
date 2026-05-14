import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OfferLang } from "@/lib/offerLang";
import { tOffer } from "./i18n";

interface AnschreibenSectionProps {
  emailContent: string;
  inquiryId?: string;
  lang?: OfferLang;
  translations?: Record<string, string> | null;
}

export function AnschreibenSection({
  emailContent,
  inquiryId,
  lang = 'de',
  translations = null,
}: AnschreibenSectionProps) {
  const [translated, setTranslated] = useState<string | null>(
    lang !== 'de' && translations?.[lang] ? translations[lang] : null,
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (lang === 'de') {
      setTranslated(null);
      return;
    }
    if (translations?.[lang]) {
      setTranslated(translations[lang]);
      return;
    }
    if (!inquiryId || !emailContent) return;
    let cancelled = false;
    setLoading(true);
    setTranslated(null);
    supabase.functions.invoke('translate-offer-letter', {
      body: { inquiry_id: inquiryId, target_lang: lang, source_text: emailContent },
    })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.translated) {
          setFailed(true);
          setTranslated(null);
        } else {
          setTranslated(data.translated as string);
        }
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lang, inquiryId, emailContent, translations]);

  const sourceText = translated ?? emailContent;

  const greetingSeparators = [
    "Mit freundlichen Grüßen",
    "Herzliche Grüße",
    "Beste Grüße",
    "Viele Grüße",
    "Kind regards",
    "Best regards",
    "Sincerely",
    "Cordialmente",
    "Cordiali saluti",
    "Distinti saluti",
    "Cordialement",
    "Sincères salutations",
    "Bien cordialement",
  ];

  let bodyText = sourceText;
  let greetingLine = "";
  let senderName = "";

  for (const sep of greetingSeparators) {
    const idx = sourceText.indexOf(sep);
    if (idx !== -1) {
      bodyText = sourceText.slice(0, idx).trimEnd();
      const afterGreeting = sourceText.slice(idx);
      const lines = afterGreeting.split('\n').map(l => l.trim()).filter(Boolean);
      greetingLine = lines[0] || sep;
      senderName = lines[1] || "";
      break;
    }
  }

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
          {loading && (
            <div className="mb-4 text-xs font-sans uppercase tracking-widest text-muted-foreground/70">
              {tOffer(lang, 'translatingLetter')}
            </div>
          )}
          {failed && lang !== 'de' && (
            <div className="mb-4 text-xs font-sans text-muted-foreground/70 italic">
              {tOffer(lang, 'translationFailed')}
            </div>
          )}
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