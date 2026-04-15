import { ChefHat, Package, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferMode } from "./types";

const MODES: { mode: OfferMode; label: string; icon: React.ElementType; hint: string }[] = [
  { mode: 'menu', label: 'Menü', icon: ChefHat, hint: 'Gänge frei zusammenstellen' },
  { mode: 'paket', label: 'Paket', icon: Package, hint: 'Fertigpaket wählen' },
  { mode: 'email', label: 'Nur E-Mail', icon: Mail, hint: 'Freie Nachricht' },
];

interface ModeSelectorProps {
  selectedMode: OfferMode;
  onSelect: (mode: OfferMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ selectedMode, onSelect, disabled }: ModeSelectorProps) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Angebots-Typ
      </h3>
      <div className="flex gap-2">
        {MODES.map(({ mode, label, icon: Icon, hint }) => {
          const isSelected = selectedMode === mode;
          return (
            <button
              key={mode}
              onClick={() => !disabled && onSelect(mode)}
              disabled={disabled}
              className={cn(
                "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-muted/30 hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn(
                "h-4 w-4 shrink-0",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <div className="min-w-0">
                <span className={cn(
                  "text-sm font-semibold block",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                  {hint}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
