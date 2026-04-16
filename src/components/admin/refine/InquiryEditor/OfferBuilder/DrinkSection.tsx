import { useRef } from "react";
import { Wine, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DishPicker } from "./DishPicker";
import type { DrinkSectionMode, DrinkEinzelnItem } from "./types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface DrinkSectionUpdate {
  drinksMode?: DrinkSectionMode;
  drinksPauschalePrice?: number | null;
  drinksPauschaleDescription?: string | null;
  winePairingPrice?: number | null;
  drinksEinzeln?: DrinkEinzelnItem[];
}

interface DrinkSectionProps {
  drinksMode: DrinkSectionMode;
  drinksPauschalePrice: number | null;
  drinksPauschaleDescription: string | null;
  winePairingPrice: number | null;
  drinksEinzeln: DrinkEinzelnItem[];
  menuItems: CombinedMenuItem[];
  onUpdate: (update: DrinkSectionUpdate) => void;
  disabled?: boolean;
}

const DRINK_FILTER_CATEGORIES = ['wein', 'wine', 'bier', 'beer', 'getränk', 'drink', 'cocktail', 'aperitif', 'prosecco', 'sekt', 'limonade', 'softdrink'];

const MODE_OPTIONS: { value: DrinkSectionMode; label: string }[] = [
  { value: 'none', label: 'Keine' },
  { value: 'pauschale', label: 'Pauschale' },
  { value: 'weinbegleitung', label: 'Weinbegleitung' },
  { value: 'einzeln', label: 'Positionen' },
];

export function DrinkSection({
  drinksMode,
  drinksPauschalePrice,
  drinksPauschaleDescription,
  winePairingPrice,
  drinksEinzeln,
  menuItems,
  onUpdate,
  disabled = false,
}: DrinkSectionProps) {
  const addPickerKey = useRef(0);

  const handleModeChange = (mode: DrinkSectionMode) => {
    onUpdate({ drinksMode: mode });
  };

  const handleAddEinzeln = (dish: { id: string; name: string; description: string | null; source: string; price: number | null }) => {
    addPickerKey.current += 1;
    const newItem: DrinkEinzelnItem = {
      id: dish.id,
      name: dish.name,
      pricePerPerson: dish.price ?? 0,
    };
    onUpdate({ drinksEinzeln: [...drinksEinzeln, newItem] });
  };

  const handleUpdateEinzeln = (idx: number, update: Partial<DrinkEinzelnItem>) => {
    const updated = drinksEinzeln.map((item, i) => i === idx ? { ...item, ...update } : item);
    onUpdate({ drinksEinzeln: updated });
  };

  const handleRemoveEinzeln = (idx: number) => {
    onUpdate({ drinksEinzeln: drinksEinzeln.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-2">
      {/* Header + Mode-Auswahl — kompakt wenn "Keine" */}
      {drinksMode === 'none' ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Wine className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">
              Getränke: Keine
            </span>
          </div>
          <button
            type="button"
            onClick={() => !disabled && handleModeChange('pauschale')}
            disabled={disabled}
            className="text-[11px] text-primary/70 hover:text-primary transition-colors"
          >
            + hinzufügen
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Wine className="h-3.5 w-3.5 text-amber-600/80" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Getränke
            </span>
          </div>
          <div className="flex items-center gap-1">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && handleModeChange(opt.value)}
                disabled={disabled}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                  drinksMode === opt.value
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modus: Pauschale pro Person */}
      {drinksMode === 'pauschale' && (
        <div className="ml-5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative w-36 shrink-0">
              <Input
                type="number"
                value={drinksPauschalePrice ?? ''}
                onChange={(e) => onUpdate({ drinksPauschalePrice: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
                placeholder="z.B. 25"
                className="h-9 rounded-xl pr-16"
                disabled={disabled}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                € / Pers.
              </span>
            </div>
            <Input
              value={drinksPauschaleDescription ?? ''}
              onChange={(e) => onUpdate({ drinksPauschaleDescription: e.target.value || null })}
              placeholder="Was ist enthalten? (z.B. Aperitivo, 2 Glas Wein, Wasser, Kaffee)"
              className="h-9 rounded-xl flex-1 text-sm"
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Modus: Weinbegleitung */}
      {drinksMode === 'weinbegleitung' && (
        <div className="ml-5">
          <div className="relative w-40">
            <Input
              type="number"
              value={winePairingPrice ?? ''}
              onChange={(e) => onUpdate({ winePairingPrice: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
              placeholder="z.B. 28"
              className="h-9 rounded-xl pr-16"
              disabled={disabled}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              € / Pers.
            </span>
          </div>
        </div>
      )}

      {/* Modus: Einzelne Positionen */}
      {drinksMode === 'einzeln' && (
        <div className="ml-5 space-y-1.5">
          {drinksEinzeln.map((item, idx) => (
            <div key={item.id + idx} className="flex items-center gap-2">
              <span className="text-sm flex-1 truncate text-foreground">{item.name}</span>
              <div className="relative w-28 shrink-0">
                <Input
                  type="number"
                  value={item.pricePerPerson > 0 ? item.pricePerPerson : ''}
                  onChange={(e) => handleUpdateEinzeln(idx, { pricePerPerson: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                  className="h-8 rounded-xl pr-14 text-right text-xs"
                  disabled={disabled}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  € / Pers.
                </span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveEinzeln(idx)}
                  className="shrink-0 p-1 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-destructive" />
                </button>
              )}
            </div>
          ))}

          {!disabled && (
            <div className="flex items-center gap-2 pt-0.5">
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <DishPicker
                key={addPickerKey.current}
                value={null}
                onSelect={handleAddEinzeln}
                menuItems={menuItems}
                filterCategories={DRINK_FILTER_CATEGORIES}
                placeholder="Getränk hinzufügen..."
                allowCustom={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
