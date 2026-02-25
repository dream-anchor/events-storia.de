import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRINK_ICONS } from "./types";
import type { DrinkConfig, DrinkSelection, DrinkGroupType, DrinkOption } from "./types";

interface InlineDrinkEditorProps {
  drinks: DrinkSelection[];
  drinkConfigs: DrinkConfig[];
  onUpdateDrink: (index: number, update: Partial<DrinkSelection>) => void;
  onAddDrink?: () => void;
  onRemoveDrink?: (index: number) => void;
  disabled?: boolean;
}

function getOptionLabel(opt: DrinkOption | string): string {
  if (typeof opt === 'string') return opt;
  return opt.label || opt.type || '';
}

/** Häufige Zusatzgetränke für Extra-Drink-Dropdown */
const COMMON_EXTRA_DRINKS = [
  'Prosecco',
  'Aperol Spritz',
  'Hugo',
  'Campari Soda',
  'Negroni',
  'Limoncello',
  'Grappa',
  'Espresso Martini',
  'Gin Tonic',
  'Spritz Veneziano',
];

export function InlineDrinkEditor({
  drinks,
  drinkConfigs,
  onUpdateDrink,
  onAddDrink,
  onRemoveDrink,
  disabled = false,
}: InlineDrinkEditorProps) {
  // Hauptgetränke (Aperitif, Getränk, Custom) vs. Inklusivgetränke (Wasser, Kaffee)
  const MAIN_GROUPS = new Set(['aperitif', 'main_drink', 'custom']);
  const mainDrinks: { drink: DrinkSelection; idx: number }[] = [];
  const inclusiveDrinks: { drink: DrinkSelection; idx: number }[] = [];

  drinks.forEach((drink, idx) => {
    if (MAIN_GROUPS.has(drink.drinkGroup)) {
      mainDrinks.push({ drink, idx });
    } else {
      inclusiveDrinks.push({ drink, idx });
    }
  });

  return (
    <div className="space-y-1">
      {/* Hauptgetränke: Aperitif, Getränk, Custom */}
      {mainDrinks.map(({ drink, idx }) => (
        <DrinkRow
          key={idx}
          drink={drink}
          idx={idx}
          drinkConfigs={drinkConfigs}
          onUpdateDrink={onUpdateDrink}
          onRemoveDrink={onRemoveDrink}
          disabled={disabled}
        />
      ))}

      {/* Getränk hinzufügen — nach Hauptgetränken, vor Wasser/Kaffee */}
      {onAddDrink && !disabled && (
        <button
          type="button"
          onClick={onAddDrink}
          className="flex items-center gap-2 py-2 px-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Getränk hinzufügen
        </button>
      )}

      {/* Inklusivgetränke: Wasser, Kaffee */}
      {inclusiveDrinks.map(({ drink, idx }) => (
        <DrinkRow
          key={idx}
          drink={drink}
          idx={idx}
          drinkConfigs={drinkConfigs}
          onUpdateDrink={onUpdateDrink}
          onRemoveDrink={onRemoveDrink}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/** Einzelne Drink-Zeile — extrahiert für Wiederverwendung in beiden Gruppen */
function DrinkRow({
  drink,
  idx,
  drinkConfigs,
  onUpdateDrink,
  onRemoveDrink,
  disabled,
}: {
  drink: DrinkSelection;
  idx: number;
  drinkConfigs: DrinkConfig[];
  onUpdateDrink: (index: number, update: Partial<DrinkSelection>) => void;
  onRemoveDrink?: (index: number) => void;
  disabled: boolean;
}) {
  const config = drinkConfigs.find(c => c.drink_group === drink.drinkGroup);
  const icon = DRINK_ICONS[drink.drinkGroup as DrinkGroupType] || '🍷';
  const isCustomActive = drink.customDrink != null;
  const isExtraDrink = drink.drinkGroup === 'custom';

  // Inklusive Getränke: nur anzeigen, nicht editierbar
  if (config?.is_included && !config?.is_choice) {
    return (
      <div className="flex items-center gap-3 py-2 px-2 rounded-lg">
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

  // Extra-Drink: Dropdown mit häufigen Getränken (wenn noch kein Custom-Text)
  if (isExtraDrink && !isCustomActive) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 py-2 px-2 rounded-lg",
          "hover:bg-muted/30 transition-colors"
        )}
      >
        <span className="text-base w-7 text-center shrink-0">{icon}</span>
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
            <SelectValue placeholder="Getränk wählen..." />
          </SelectTrigger>
          <SelectContent>
            {COMMON_EXTRA_DRINKS.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">
              Eigene Angabe...
            </SelectItem>
          </SelectContent>
        </Select>
        {onRemoveDrink && (
          <button
            type="button"
            onClick={() => onRemoveDrink(idx)}
            className="shrink-0 h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center hover:bg-destructive/10 transition-colors"
            title="Getränk entfernen"
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  // Freitext-Eingabe (Eigene Angabe oder kein Config oder Extra-Drink)
  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30">
      <span className="text-base w-7 text-center shrink-0">{icon}</span>
      {!isExtraDrink && (
        <span className="text-sm text-muted-foreground w-24 shrink-0 truncate">
          {drink.drinkLabel}
        </span>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Input
          value={drink.customDrink || drink.selectedChoice || ''}
          onChange={(e) =>
            onUpdateDrink(idx, {
              customDrink: e.target.value,
              selectedChoice: null,
            })
          }
          placeholder={isExtraDrink ? "z.B. Prosecco, Limoncello..." : "Getränk eingeben..."}
          className="h-9 rounded-xl"
          disabled={disabled}
          autoFocus={isCustomActive && !drink.customDrink}
        />
        {/* Zurück zum Dropdown (Config-Drinks mit Optionen ODER Extra-Drinks) */}
        {((config?.is_choice && config.options.length > 0) || isExtraDrink) && (
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
        {/* Löschen — nur bei manuell hinzugefügten Drinks */}
        {isExtraDrink && onRemoveDrink && (
          <button
            type="button"
            onClick={() => onRemoveDrink(idx)}
            className="shrink-0 h-9 w-9 rounded-xl border border-border/40 flex items-center justify-center hover:bg-destructive/10 transition-colors"
            title="Getränk entfernen"
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
