import { cn } from "@/lib/utils";

interface PriceDisplayToggleProps {
  showGross: boolean;
  onChange: (showGross: boolean) => void;
  language: "de" | "en";
  /** Kompakte, beige Variante für die mobile Kurzübersicht (Touch-Ziel min. 36 px) */
  variant?: "default" | "mobile";
}

/** Zweiteiliger Schalter Brutto | Netto – schreibt über onChange in den PriceDisplayContext. */
export function PriceDisplayToggle({ showGross, onChange, language, variant = "default" }: PriceDisplayToggleProps) {
  const grossLabel = language === "de" ? "Brutto" : "Gross";
  const netLabel = language === "de" ? "Netto" : "Net";
  const groupLabel = language === "de" ? "Preisanzeige" : "Price display";

  if (variant === "mobile") {
    const base = "min-h-[36px] px-3.5 text-xs font-medium transition-colors";
    return (
      <div
        role="radiogroup"
        aria-label={groupLabel}
        className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {[
          { value: true, label: grossLabel },
          { value: false, label: netLabel },
        ].map((opt) => {
          const active = showGross === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                base,
                "rounded-md",
                active
                  ? "bg-[#EFE6D6] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-1 text-xs" role="group" aria-label={groupLabel}>
      {[
        { value: true, label: grossLabel },
        { value: false, label: netLabel },
      ].map((opt) => {
        const active = showGross === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2.5 py-1.5 rounded-md transition-colors border",
              active
                ? "bg-foreground text-background border-foreground font-medium"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
