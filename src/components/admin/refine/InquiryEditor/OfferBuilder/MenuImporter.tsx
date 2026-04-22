import { useState } from "react";
import { UtensilsCrossed, Loader2, ChevronRight, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useRistoranteCompleteMenus, type RistoranteImportItem, type RistoranteTastingMenu } from "@/hooks/useRistoranteCompleteMenus";
import { OPTION_LABELS } from "./types";
import type { OfferBuilderOption, CourseSelection, CourseType } from "./types";

interface MenuImporterProps {
  guestCount: number;
  currentOptionCount: number;
  onImportMultiple: (options: Partial<OfferBuilderOption>[]) => void;
  disabled?: boolean;
  /** Kontrolliert: Sheet von außen öffnen */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

function formatEur(price: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(price);
}

/**
 * Heuristik: Mappt einen Label-/Item-Text auf einen passenden CourseType.
 * Dient nur der korrekten Icon-/Sortier-Anzeige im Public-Offer.
 */
function detectCourseType(label: string, itemName: string): CourseType {
  const t = `${label} ${itemName}`.toLowerCase();
  if (/dessert|dolc|tiramisu|panna cotta|sorbet|eis|gelato/.test(t)) return 'dessert';
  if (/pasta|pizz|risott|gnocch|spaghett|tagliat|raviol|lasagn|primo/.test(t)) return 'pasta';
  if (/fisch|fish|pesce|branzino|lachs|thunfisch|salmon/.test(t)) return 'main_fish';
  if (/fleisch|meat|carne|rind|schwein|lamm|kalb|filet|steak/.test(t)) return 'main_meat';
  if (/vegan/.test(t)) return 'vegan';
  if (/veget/.test(t)) return 'vegetarisch';
  if (/finger/.test(t)) return 'fingerfood';
  if (/main|haupt|secondo/.test(t)) return 'main';
  if (/anti|vorspeise|starter|insalat|salat|bruschett|carpacc/.test(t)) return 'starter';
  return 'main';
}

const POSITION_LABELS = ['Antipasto', 'Pasta', 'Hauptgang', 'Dessert', 'Gang 5', 'Gang 6'];

/**
 * Parst eine Restaurant-Menü-Beschreibung in strukturierte CourseSelections.
 * Akzeptiert Trennzeichen: |, Newline, • (Bullet), – (en-dash) und – Variante.
 * Pro Teil: Optional "Label: Item" → courseLabel + itemName,
 *   sonst Position-basierte Defaults (Antipasto / Pasta / Hauptgang / Dessert).
 */
function parseMenuDescription(description: string): CourseSelection[] {
  if (!description?.trim()) return [];

  // An den üblichen Trennzeichen splitten
  const parts = description
    .split(/[|\n•]|\s[–-]\s/g)
    .map(p => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return [];

  return parts.map((part, idx) => {
    // "Label: Item-Beschreibung" Pattern erkennen
    const colonMatch = part.match(/^([^:]{2,30}):\s*(.+)$/);
    let courseLabel: string;
    let itemName: string;

    if (colonMatch) {
      courseLabel = colonMatch[1].trim();
      itemName = colonMatch[2].trim();
    } else {
      courseLabel = POSITION_LABELS[idx] ?? `Gang ${idx + 1}`;
      itemName = part;
    }

    return {
      courseType: detectCourseType(courseLabel, itemName),
      courseLabel,
      itemId: null,
      itemName,
      itemDescription: null,
      itemSource: 'ristorante',
      isCustom: true,
      overridePrice: null,
      quantity: null,
    } satisfies CourseSelection;
  });
}

export function MenuImporter({ guestCount, currentOptionCount, onImportMultiple, disabled = false, externalOpen, onExternalOpenChange }: MenuImporterProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  };
  const [activeTab, setActiveTab] = useState<'lunch' | 'dinner'>('lunch');

  // Lunch state — Mehrfachauswahl
  const [selectedLunchIds, setSelectedLunchIds] = useState<Set<string>>(new Set());
  const [addDrinkPaket, setAddDrinkPaket] = useState(false);
  const [drinkPaketPrice, setDrinkPaketPrice] = useState<string>('');
  const [drinkPaketDesc, setDrinkPaketDesc] = useState('Getränkepauschale');

  // Dinner state — Mehrfachauswahl
  const [selectedTastingIds, setSelectedTastingIds] = useState<Set<string>>(new Set());
  const [addWinePairing, setAddWinePairing] = useState(false);

  const { data, isLoading, error } = useRistoranteCompleteMenus(open);

  const resetState = () => {
    setSelectedLunchIds(new Set());
    setAddDrinkPaket(false);
    setDrinkPaketPrice('');
    setDrinkPaketDesc('Getränkepauschale');
    setSelectedTastingIds(new Set());
    setAddWinePairing(false);
    setActiveTab('lunch');
  };

  const toggleLunch = (id: string) => {
    setSelectedLunchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTasting = (id: string, menu: RistoranteTastingMenu) => {
    setSelectedTastingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Weinbegleitung deaktivieren falls keine Auswahl mehr
        if (next.size === 0) setAddWinePairing(false);
      } else {
        next.add(id);
      }
      return next;
    });
    // Weinbegleitung nur anzeigen wenn mindestens ein Menü mit Weinbegleitung gewählt ist
    if (!menu.winePairing) setAddWinePairing(false);
  };

  const selectedCount = activeTab === 'lunch' ? selectedLunchIds.size : selectedTastingIds.size;
  const maxNewOptions = OPTION_LABELS.length - currentOptionCount;

  // Vorschau welche Labels vergeben werden
  const nextLabels = OPTION_LABELS
    .slice(currentOptionCount, currentOptionCount + selectedCount)
    .join(', ');

  const handleImport = () => {
    if (!data) return;

    const results: Partial<OfferBuilderOption>[] = [];
    const drinkPrice = addDrinkPaket && drinkPaketPrice ? parseFloat(drinkPaketPrice) || 0 : 0;

    if (activeTab === 'lunch') {
      const selectedItems = data.lunch?.packageItems.filter(item => selectedLunchIds.has(item.id)) ?? [];
      for (const item of selectedItems) {
        const basePrice = item.price ?? 0;
        const pricePerPerson = basePrice + drinkPrice;
        let packageName = item.name;
        const parsedCourses = parseMenuDescription(item.description ?? '');
        const menuSel: OfferBuilderOption['menuSelection'] = { courses: parsedCourses, drinks: [] };

        if (addDrinkPaket && drinkPaketDesc) {
          packageName += ` + ${drinkPaketDesc}`;
          menuSel.drinksMode = 'pauschale';
          menuSel.drinksPauschalePrice = drinkPrice;
          menuSel.drinksPauschaleDescription = drinkPaketDesc;
        }

        results.push({
          offerMode: 'paket',
          packageId: null,
          packageName,
          budgetPerPerson: pricePerPerson,
          totalAmount: pricePerPerson * guestCount,
          menuSelection: menuSel,
        });
      }
    } else {
      const selectedMenus = data.dinner?.tastingMenus.filter(m => selectedTastingIds.has(m.id)) ?? [];
      for (const menu of selectedMenus) {
        const basePrice = menu.price ?? 0;
        const winePrice = addWinePairing && menu.winePairing?.price ? menu.winePairing.price : 0;
        const pricePerPerson = basePrice + winePrice;
        let packageName = menu.name;
        const parsedCourses = parseMenuDescription(menu.description ?? '');
        const menuSel: OfferBuilderOption['menuSelection'] = { courses: parsedCourses, drinks: [] };

        if (addWinePairing && menu.winePairing) {
          packageName += ' mit Weinbegleitung';
          menuSel.winePairingPrice = winePrice;
        }

        results.push({
          offerMode: 'paket',
          packageId: null,
          packageName,
          budgetPerPerson: pricePerPerson,
          totalAmount: pricePerPerson * guestCount,
          menuSelection: menuSel,
        });
      }
    }

    if (results.length > 0) {
      onImportMultiple(results.slice(0, maxNewOptions));
      setOpen(false);
      resetState();
    }
  };

  const canImport = selectedCount > 0 && selectedCount <= maxNewOptions;

  // Prüfe ob mindestens ein ausgewähltes Dinner-Menü Weinbegleitung hat
  const anyTastingHasWine = data?.dinner?.tastingMenus
    .filter(m => selectedTastingIds.has(m.id))
    .some(m => !!m.winePairing) ?? false;

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      {/* Trigger-Button nur zeigen wenn NICHT extern kontrolliert */}
      {externalOpen === undefined && (
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || maxNewOptions === 0}
            className="h-7 rounded-lg gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Restaurant-Menü laden
          </Button>
        </SheetTrigger>
      )}

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-amber-700" />
            Restaurant-Menüs auswählen
          </SheetTitle>
        </SheetHeader>

        {/* Tab-Auswahl */}
        <div className="flex rounded-xl border border-border/50 p-1 gap-1 mb-5">
          {(['lunch', 'dinner'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === tab
                  ? "bg-amber-700 text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab === 'lunch' ? '☀️ Business-Lunch' : '🌙 Abendkarte'}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            Fehler beim Laden: {error instanceof Error ? error.message : 'Unbekannter Fehler'}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {/* LUNCH */}
            {activeTab === 'lunch' && data.lunch && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    3-Gänge-Menü — Mehrere wählbar
                  </p>
                  <div className="space-y-2">
                    {data.lunch.packageItems.map((item) => {
                      const isSelected = selectedLunchIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleLunch(item.id)}
                          className={cn(
                            "w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors",
                            isSelected
                              ? "border-amber-700 bg-amber-50"
                              : "border-border/40 hover:border-border hover:bg-muted/20"
                          )}
                        >
                          {/* Checkbox */}
                          <div className={cn(
                            "h-4 w-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center",
                            isSelected ? "border-amber-700 bg-amber-700" : "border-muted-foreground/40"
                          )}>
                            {isSelected && (
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M1 4l3 3 5-5" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                            )}
                            {item.price != null && (
                              <div className="text-sm font-semibold text-amber-700 mt-1">
                                {formatEur(item.price)} / Person
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Getränkepauschale */}
                <div className="border border-border/40 rounded-xl p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addDrinkPaket}
                      onChange={(e) => setAddDrinkPaket(e.target.checked)}
                      className="h-4 w-4 rounded accent-amber-700"
                    />
                    <span className="text-sm font-medium">Getränkepauschale hinzufügen</span>
                  </label>

                  {addDrinkPaket && (
                    <div className="space-y-2 pl-6">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Bezeichnung</label>
                        <input
                          type="text"
                          value={drinkPaketDesc}
                          onChange={(e) => setDrinkPaketDesc(e.target.value)}
                          placeholder="z.B. Getränkepauschale"
                          className="w-full h-8 rounded-lg border border-border/60 px-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-amber-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Preis / Person (€)</label>
                        <input
                          type="number"
                          value={drinkPaketPrice}
                          onChange={(e) => setDrinkPaketPrice(e.target.value)}
                          placeholder="z.B. 12.00"
                          min="0"
                          step="0.50"
                          className="w-full h-8 rounded-lg border border-border/60 px-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-amber-700"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Preisvorschau für alle gewählten */}
                {selectedLunchIds.size > 0 && data.lunch.packageItems
                  .filter(i => selectedLunchIds.has(i.id))
                  .map(item => {
                    const price = (item.price ?? 0) + (addDrinkPaket && drinkPaketPrice ? parseFloat(drinkPaketPrice) || 0 : 0);
                    return (
                      <div key={item.id} className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1 truncate">{item.name}</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Preis / Person</span>
                          <span className="font-semibold">{formatEur(price)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Gesamt ({guestCount} Pers.)</span>
                          <span className="font-bold text-amber-800">{formatEur(price * guestCount)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* DINNER */}
            {activeTab === 'dinner' && data.dinner && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Degustationsmenü — Mehrere wählbar
                  </p>
                  <div className="space-y-2">
                    {data.dinner.tastingMenus.map((menu) => {
                      const isSelected = selectedTastingIds.has(menu.id);
                      return (
                        <button
                          key={menu.id}
                          onClick={() => toggleTasting(menu.id, menu)}
                          className={cn(
                            "w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors",
                            isSelected
                              ? "border-amber-700 bg-amber-50"
                              : "border-border/40 hover:border-border hover:bg-muted/20"
                          )}
                        >
                          {/* Checkbox */}
                          <div className={cn(
                            "h-4 w-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center",
                            isSelected ? "border-amber-700 bg-amber-700" : "border-muted-foreground/40"
                          )}>
                            {isSelected && (
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M1 4l3 3 5-5" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{menu.name}</div>
                            {menu.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{menu.description}</div>
                            )}
                            {menu.price != null && (
                              <div className="text-sm font-semibold text-amber-700 mt-1">
                                {formatEur(menu.price)} / Person
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weinbegleitung — nur wenn mindestens ein gewähltes Menü sie hat */}
                {anyTastingHasWine && (
                  <div className="border border-border/40 rounded-xl p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addWinePairing}
                        onChange={(e) => setAddWinePairing(e.target.checked)}
                        className="h-4 w-4 rounded accent-amber-700"
                      />
                      <Wine className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">Weinbegleitung hinzufügen</span>
                    </label>
                  </div>
                )}

                {/* Preisvorschau für alle gewählten */}
                {selectedTastingIds.size > 0 && data.dinner.tastingMenus
                  .filter(m => selectedTastingIds.has(m.id))
                  .map(menu => {
                    const wineP = addWinePairing && menu.winePairing?.price ? menu.winePairing.price : 0;
                    const price = (menu.price ?? 0) + wineP;
                    return (
                      <div key={menu.id} className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1 truncate">{menu.name}</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Preis / Person</span>
                          <span className="font-semibold">{formatEur(price)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Gesamt ({guestCount} Pers.)</span>
                          <span className="font-bold text-amber-800">{formatEur(price * guestCount)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Auswahl-Zusammenfassung + Import-Button */}
            <div className="pt-5 mt-5 border-t border-border/40 space-y-3">
              {selectedCount > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  {selectedCount} Menü{selectedCount > 1 ? 's' : ''} ausgewählt
                  {nextLabels && ` → wird als Option ${nextLabels} angelegt`}
                  {selectedCount > maxNewOptions && (
                    <span className="text-destructive block mt-0.5">
                      Max. {maxNewOptions} weitere Option{maxNewOptions !== 1 ? 'en' : ''} möglich
                    </span>
                  )}
                </p>
              )}
              <Button
                onClick={handleImport}
                disabled={!canImport}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white rounded-xl h-10 font-semibold gap-2"
              >
                {selectedCount > 1 ? `Alle ${selectedCount} übernehmen` : 'Übernehmen'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
