import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type KiBadgeLang = "de" | "en";

interface KiBadgeProps {
  /** "normal" = „KI-bearbeitet“, "mini" = nur „KI“ (Thumbs bis ca. 80 px). */
  size?: "normal" | "mini";
  /** Sprache explizit setzen (z. B. Geschenkkorb-Seiten mit eigenem lang-Prop); sonst aus dem LanguageContext. */
  lang?: KiBadgeLang;
  className?: string;
}

const TEXT: Record<KiBadgeLang, { full: string; short: string }> = {
  de: { full: "KI-bearbeitet", short: "KI" },
  en: { full: "AI-edited", short: "AI" },
};

/**
 * Einheitlicher KI-Hinweis für alle Shop-/Produktbilder (Inhaber-Entscheidung 22.11.2026).
 * Kleiner Badge oben rechts im Bild, nicht anklickbar, keine Bildunterschrift.
 * Absolut positioniert: das Elternelement des Bildes muss `relative` sein.
 * Rein statisch (kein State/Effect), damit er im vorgerenderten HTML steht.
 */
export const KiBadge = ({ size = "normal", lang, className = "" }: KiBadgeProps) => {
  const ctx = useLanguage();
  const language: KiBadgeLang = lang ?? ctx.language;
  const text = TEXT[language];
  const mini = size === "mini";
  return (
    <span
      data-ki-badge="bearbeitet"
      title={text.full}
      className={`absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white pointer-events-none select-none ${className}`}
    >
      {mini ? (
        <>
          <span aria-hidden="true">{text.short}</span>
          <span className="sr-only">{text.full}</span>
        </>
      ) : (
        <>
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          {text.full}
        </>
      )}
    </span>
  );
};

export default KiBadge;
