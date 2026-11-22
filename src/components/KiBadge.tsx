import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type KiBadgeLang = "de" | "en";

interface KiBadgeProps {
  /** "normal" = „KI-bearbeitet“, "mini" = nur „KI“ (Thumbs bis ca. 80 px). */
  size?: "normal" | "mini";
  /** Sprache explizit setzen (z. B. Geschenkkorb-Seiten mit eigenem lang-Prop); sonst aus dem LanguageContext. */
  lang?: KiBadgeLang;
  /** Ecke im Bild: Standard oben rechts; auf Karten mit eigenem Zähler/Abzeichen oben rechts z. B. "br"/"bl". */
  corner?: "tr" | "tl" | "br" | "bl";
  className?: string;
}

// Eckenklassen statt className-Überschreibung: Tailwind sortiert gleiche Utilities nach Wert,
// ein späteres `top-0.5` würde `top-1.5` im Stylesheet nicht zuverlässig schlagen.
const CORNER: Record<NonNullable<KiBadgeProps["corner"]>, { normal: string; mini: string }> = {
  tr: { normal: "top-1.5 right-1.5", mini: "top-0.5 right-0.5" },
  tl: { normal: "top-1.5 left-1.5", mini: "top-0.5 left-0.5" },
  br: { normal: "bottom-1.5 right-1.5", mini: "bottom-0.5 right-0.5" },
  bl: { normal: "bottom-1.5 left-1.5", mini: "bottom-0.5 left-0.5" },
};

const TEXT: Record<KiBadgeLang, { full: string; short: string }> = {
  de: { full: "KI-bearbeitet", short: "KI" },
  en: { full: "AI-edited", short: "AI" },
};

/**
 * Einheitlicher KI-Hinweis für alle Shop-/Produktbilder (Inhaber-Entscheidung 22.11.2026).
 * Kleiner Badge (Standard oben rechts, per `corner` verlegbar), nicht anklickbar, keine Bildunterschrift.
 * Für Screenreader unsichtbar (aria-hidden): die Info steht im Alt-Text des Bildes (kiAltSuffix).
 * Absolut positioniert: das Elternelement des Bildes muss `relative` sein.
 * Rein statisch (kein State/Effect), damit er im vorgerenderten HTML steht.
 */
export const KiBadge = ({ size = "normal", lang, corner = "tr", className = "" }: KiBadgeProps) => {
  const ctx = useLanguage();
  const language: KiBadgeLang = lang ?? ctx.language;
  const text = TEXT[language];
  const mini = size === "mini";
  return (
    <span
      data-ki-badge="bearbeitet"
      aria-hidden="true"
      className={`absolute ${CORNER[corner][size]} z-10 inline-flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white pointer-events-none select-none ${className}`}
    >
      {mini ? (
        text.short
      ) : (
        <>
          <Sparkles className="h-2.5 w-2.5" />
          {text.full}
        </>
      )}
    </span>
  );
};

export default KiBadge;
