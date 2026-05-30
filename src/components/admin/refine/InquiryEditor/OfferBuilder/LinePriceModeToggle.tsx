import { cn } from "@/lib/utils";

export type LinePriceMode = 'per_person' | 'flat';

interface LinePriceModeToggleProps {
  value: LinePriceMode;
  onChange: (mode: LinePriceMode) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Kompakter 2-Werte-Toggle pro Speise-/Getränkezeile:
 * "/Pers." = Preis wird mit Gästezahl multipliziert
 * "pauschal" = Preis bleibt absolut (1×)
 */
export function LinePriceModeToggle({ value, onChange, disabled, className }: LinePriceModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border/50 bg-muted/30 p-0.5 text-[10px] leading-none shrink-0",
        className,
      )}
      title="Preis pro Person oder pauschal"
    >
      <button
        type="button"
        onClick={() => !disabled && onChange('per_person')}
        disabled={disabled}
        className={cn(
          "px-1.5 py-0.5 rounded transition-colors",
          value === 'per_person'
            ? "bg-background shadow-sm font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        /Pers.
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange('flat')}
        disabled={disabled}
        className={cn(
          "px-1.5 py-0.5 rounded transition-colors",
          value === 'flat'
            ? "bg-background shadow-sm font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        pauschal
      </button>
    </div>
  );
}