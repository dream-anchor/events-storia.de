import { motion } from "framer-motion";
import { Utensils, UtensilsCrossed, ChefHat, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferMode } from "./types";
import { OFFER_MODES } from "./types";

const MODE_ICONS: Record<OfferMode, React.ElementType> = {
  a_la_carte: Utensils,
  teil_menu: UtensilsCrossed,
  fest_menu: ChefHat,
  paket: Package,
};

interface ModeSelectorProps {
  selectedMode: OfferMode;
  onSelect: (mode: OfferMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ selectedMode, onSelect, disabled }: ModeSelectorProps) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Wie wird gegessen?
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {OFFER_MODES.map((config) => {
          const Icon = MODE_ICONS[config.mode];
          const isSelected = selectedMode === config.mode;

          return (
            <motion.button
              key={config.mode}
              whileHover={disabled ? undefined : { scale: 1.02 }}
              whileTap={disabled ? undefined : { scale: 0.98 }}
              onClick={() => !disabled && onSelect(config.mode)}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-colors text-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/50 bg-background hover:border-border hover:bg-muted/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center h-12 w-12 rounded-xl",
                  isSelected ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className={cn(
                "text-sm font-semibold",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                {config.description}
              </span>
              {isSelected && (
                <motion.div
                  layoutId="mode-indicator"
                  className="absolute -top-px -right-px h-5 w-5 rounded-full bg-primary flex items-center justify-center"
                  transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                >
                  <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
