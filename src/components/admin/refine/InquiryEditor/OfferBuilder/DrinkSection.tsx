import { useRef, useState } from "react";
import { Wine, Plus, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DishPicker } from "./DishPicker";
import type { DrinkSectionMode, DrinkEinzelnItem } from "./types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { PricingMode } from "./pricingMode";
import { LinePriceModeToggle, type LinePriceMode } from "./LinePriceModeToggle";

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
  /** Bei 'per_event' wird ein Mengen-Feld pro Getraenke-Position sichtbar. */
  pricingMode?: PricingMode;
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
  pricingMode = 'per_person',
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
          {drinksEinzeln.map((item, idx) => {
            const quantity = item.quantity ?? 1;
            const lineTotal = item.pricePerPerson > 0 ? item.pricePerPerson * quantity : 0;
            const fmtEUR = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
            const effPriceMode: LinePriceMode = (item.priceMode ?? (pricingMode === 'per_event' ? 'flat' : 'per_person')) as LinePriceMode;
            return (
              <DrinkRow
                key={item.id + idx}
                idx={idx}
                item={item}
                quantity={quantity}
                lineTotal={lineTotal}
                fmtEUR={fmtEUR}
                effPriceMode={effPriceMode}
                pricingMode={pricingMode}
                disabled={disabled}
                onUpdate={handleUpdateEinzeln}
                onRemove={handleRemoveEinzeln}
              />
            );
          })}

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

interface DrinkRowProps {
  idx: number;
  item: DrinkEinzelnItem;
  quantity: number;
  lineTotal: number;
  fmtEUR: (n: number) => string;
  effPriceMode: LinePriceMode;
  pricingMode: PricingMode;
  disabled: boolean;
  onUpdate: (idx: number, update: Partial<DrinkEinzelnItem>) => void;
  onRemove: (idx: number) => void;
}

function DrinkRow({ idx, item, quantity, lineTotal, fmtEUR, effPriceMode, pricingMode, disabled, onUpdate, onRemove }: DrinkRowProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(item.name);

  const commitName = () => {
    const v = tempName.trim();
    if (v && v !== item.name) onUpdate(idx, { name: v });
    setEditingName(false);
  };

  return (
    <div className="group flex items-center gap-2">
                {/* Menge (nur bei per_event) */}
                {pricingMode === 'per_event' && (
                  <div className="relative w-16 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) onUpdate(idx, { quantity: v });
                      }}
                      disabled={disabled}
                      className="h-8 rounded-lg pr-5 text-right text-sm tabular-nums"
                      title="Menge"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">×</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  {editingName ? (
                    <Input
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={commitName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitName();
                        if (e.key === 'Escape') { setTempName(item.name); setEditingName(false); }
                      }}
                      autoFocus
                      className="h-8 text-sm"
                    />
                  ) : (
                    <>
                      <span className="text-sm flex-1 truncate text-foreground">{item.name}</span>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => { setTempName(item.name); setEditingName(true); }}
                          className="shrink-0 p-1 rounded-md hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Bezeichnung bearbeiten"
                          aria-label="Bezeichnung bearbeiten"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground/60" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="relative w-28 shrink-0">
                  <Input
                    type="number"
                    value={item.pricePerPerson > 0 ? item.pricePerPerson : ''}
                    onChange={(e) => onUpdate(idx, { pricePerPerson: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                    className="h-8 rounded-xl pr-14 text-right text-xs"
                    disabled={disabled}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    €
                  </span>
                </div>
                <LinePriceModeToggle
                  value={effPriceMode}
                  onChange={(m) => onUpdate(idx, { priceMode: m })}
                  disabled={disabled}
                />
                {/* Zeilen-Total (nur bei per_event mit quantity > 1) */}
                {pricingMode === 'per_event' && quantity > 1 && (
                  <span className="text-xs font-medium tabular-nums w-24 text-right shrink-0">
                    {fmtEUR(lineTotal)}
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="shrink-0 p-1 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-destructive" />
                  </button>
                )}
    </div>
  );
}
