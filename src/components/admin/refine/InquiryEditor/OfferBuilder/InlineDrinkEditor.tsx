import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRINK_ICONS } from "./types";
import type { DrinkConfig, DrinkSelection, DrinkGroupType, DrinkOption } from "./types";

interface InlineDrinkEditorProps {
  drinks: DrinkSelection[];
  drinkConfigs: DrinkConfig[];
  onUpdateDrink: (index: number, update: Partial<DrinkSelection>) => void;
  disabled?: boolean;
}

function getOptionLabel(opt: DrinkOption | string): string {
  if (typeof opt === 'string') return opt;
  return opt.label || opt.type || '';
}

export function InlineDrinkEditor({
  drinks,
  drinkConfigs,
  onUpdateDrink,
  disabled = false,
}: InlineDrinkEditorProps) {
  return (
    <div className="space-y-1">
      {drinks.map((drink, idx) => {
        const config = drinkConfigs.find(
          c => c.drink_group === drink.drinkGroup
        );
        const icon = DRINK_ICONS[drink.drinkGroup as DrinkGroupType] || '🍷';
        const isCustomActive = drink.customDrink != null;

        // Inklusive Getränke: nur anzeigen, nicht editierbar
        if (config?.is_included && !config?.is_choice) {
          return (
            <div
              key={idx}
              className="flex items-center gap-3 py-2 px-2 rounded-lg"
            >
              <span className="text-base w-7 text-center shrink-0">{icon}</span>
              <span className="text-sm text-muted-foreground w-24 shrink-0 truncate">
                {drink.drinkLabel}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {config.options.map(getOptionLabel).join(', ') || 'Inklusive'}
                </span>
                <Badge variant="secondary" className="text-[10px] h-5">
                  inkl.
                </Badge>
              </div>
            </div>
          );
        }

        // Auswahl-Getränke: Dropdown (nur wenn KEIN eigener Text aktiv ist)
        if (config?.is_choice && config.options.length > 0 && !isCustomActive) {
          return (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-3 py-2 px-2 rounded-lg",
                "hover:bg-muted/30 transition-colors"
              )}
            >
              <span className="text-base w-7 text-center shrink-0">{icon}</span>
              <span className="text-sm text-muted-foreground w-24 shrink-0 truncate">
                {drink.drinkLabel}
              </span>
              <Select
                value={drink.selectedChoice || ''}
                onValueChange={(val) => {
                  if (val === '__custom__') {
                    onUpdateDrink(idx, { selectedChoice: null, customDrink: '' });
                  } else {
                    onUpdateDrink(idx, { selectedChoice: val, customDrink: null });
                  }
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 rounded-xl min-w-[200px]">
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {config.options.map((opt, optIdx) => {
                    const label = getOptionLabel(opt);
                    return (
                      <SelectItem key={optIdx} value={label}>
                        {label}
                        {typeof opt !== 'string' && opt.quantity && (
                          <span className="text-muted-foreground ml-1">({opt.quantity})</span>
                        )}
                      </SelectItem>
                    );
                  })}
                  <SelectItem value="__custom__">
                    Eigene Angabe...
                  </SelectItem>
                </SelectContent>
              </Select>
              {drink.quantityLabel && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {drink.quantityLabel}
                </span>
              )}
            </div>
          );
        }

        // Freitext-Eingabe (Eigene Angabe oder kein Config)
        return (
          <div
            key={idx}
            className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30"
          >
            <span className="text-base w-7 text-center shrink-0">{icon}</span>
            <span className="text-sm text-muted-foreground w-24 shrink-0 truncate">
              {drink.drinkLabel}
            </span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                value={drink.customDrink || drink.selectedChoice || ''}
                onChange={(e) =>
                  onUpdateDrink(idx, {
                    customDrink: e.target.value,
                    selectedChoice: null,
                  })
                }
                placeholder="Getränk eingeben..."
                className="h-9 rounded-xl"
                disabled={disabled}
                autoFocus={isCustomActive && !drink.customDrink}
              />
              {/* Zurück zum Dropdown (nur wenn Config mit Optionen existiert) */}
              {config?.is_choice && config.options.length > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdateDrink(idx, { customDrink: null, selectedChoice: null })}
                  className="shrink-0 h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center hover:bg-muted/50 transition-colors"
                  title="Zurück zur Auswahl"
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
