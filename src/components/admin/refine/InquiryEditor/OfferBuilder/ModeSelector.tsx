import { ChefHat, Package, UtensilsCrossed, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfferMode } from "./types";

/**
 * ModeSelector v3 — CX-optimiert
 * 
 * Primäre Modi: Restaurant-Menü | Eigenes Menü | Paket
 * Alternative: "Nur eine E-Mail schreiben" als Textlink
 * 
 * "Restaurant-Menü" ist ein UI-Shortcut der:
 * 1. offerMode auf 'menu' setzt
 * 2. onRequestImport() aufruft → öffnet den Restaurant-Menü-Import-Dialog
 */

interface ModeSelectorProps {
  selectedMode: OfferMode;
  onSelect: (mode: OfferMode) => void;
  /** Wird aufgerufen wenn "Restaurant-Menü" gewählt wird — öffnet Import-Dialog */
  onRequestImport?: () => void;
  /** true wenn bereits ein Restaurant-Menü importiert wurde */
  hasImportedMenu?: boolean;
  disabled?: boolean;
}

const PRIMARY_MODES = [
  {
    id: 'restaurant' as const,
    mode: 'menu' as OfferMode,
    label: 'Restaurant-Menü',
    hint: 'Speisekarte laden & anpassen',
    icon: UtensilsCrossed,
    triggersImport: true,
  },
  {
    id: 'custom' as const,
    mode: 'menu' as OfferMode,
    label: 'Eigenes Menü',
    hint: 'Gänge frei zusammenstellen',
    icon: ChefHat,
    triggersImport: false,
  },
  {
    id: 'paket' as const,
    mode: 'paket' as OfferMode,
    label: 'Paket',
    hint: 'Fertigpaket wählen',
    icon: Package,
    triggersImport: false,
  },
];

export function ModeSelector({ selectedMode, onSelect, onRequestImport, hasImportedMenu, disabled }: ModeSelectorProps) {
  // Track which sub-mode is active for 'menu' (restaurant vs custom)
  // If a menu was imported, default to 'restaurant'; otherwise 'custom'
  const activeId = selectedMode === 'email'
    ? 'email'
    : selectedMode === 'paket'
    ? 'paket'
    : hasImportedMenu ? 'restaurant' : 'custom';

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Angebots-Typ
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {PRIMARY_MODES.map(({ id, mode, label, hint, icon: Icon, triggersImport }) => {
          const isSelected = activeId === id;
          return (
            <button
              key={id}
              onClick={() => {
                if (disabled) return;
                onSelect(mode);
                if (triggersImport && onRequestImport) {
                  onRequestImport();
                }
              }}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-muted/30 hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn(
                "h-5 w-5",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs font-semibold leading-tight",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {label}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                {hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alternative: Nur E-Mail */}
      {selectedMode !== 'email' && (
        <button
          onClick={() => !disabled && onSelect('email')}
          disabled={disabled}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Mail className="h-3 w-3 inline mr-1" />
          Oder: Nur eine E-Mail schreiben (ohne Menükonfiguration)
        </button>
      )}
      {selectedMode === 'email' && (
        <div className="mt-3 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary/5 border border-primary/20">
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Nur E-Mail-Modus aktiv</span>
          <button
            onClick={() => !disabled && onSelect('menu')}
            className="text-xs text-muted-foreground hover:text-foreground ml-2 underline"
          >
            Zurück zur Menüauswahl
          </button>
        </div>
      )}
    </div>
  );
}
