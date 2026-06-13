import { useMemo, useEffect, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { Eye, EyeOff, Trash2, Lock, Copy, UtensilsCrossed, RefreshCw, ChefHat, Package as PackageIcon, Mail, Sparkles } from "lucide-react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { InlineCourseEditor } from "./InlineCourseEditor";
import { InlineDrinkEditor } from "./InlineDrinkEditor";
import { DrinkSection } from "./DrinkSection";
import { InlineServiceEditor } from "./InlineServiceEditor";
import { PriceBreakdown } from "./PriceBreakdown";
import { FreeformImportPanel } from "./FreeformImportPanel";
import { FreeformProgramEditor } from "./FreeformProgramEditor";
import type { FreeformProgram } from "./types";
import type {
  OfferBuilderOption,
  OfferMode,
  CourseConfig,
  CourseSelection,
  CourseType,
  DrinkConfig,
  DrinkSelection,
  DrinkSectionMode,
  DrinkEinzelnItem,
} from "./types";
import type { Package } from "../types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface OptionCardProps {
  option: OfferBuilderOption;
  packages: Package[];
  menuItems: CombinedMenuItem[];
  courseConfigs: CourseConfig[];
  drinkConfigs: DrinkConfig[];
  onUpdate: (updates: Partial<OfferBuilderOption>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  isLocked: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onRequestImport?: () => void;
  isCustomerChoice?: boolean;
  customerNotes?: string | null;
  respondedAt?: string | null;
}

export function OptionCard({
  option,
  packages,
  menuItems,
  courseConfigs,
  drinkConfigs,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleActive,
  isLocked,
  canDuplicate,
  canDelete,
  onRequestImport,
  isCustomerChoice = false,
  customerNotes = null,
  respondedAt = null,
}: OptionCardProps) {
  const selectedPackage = useMemo(
    () => packages.find(p => p.id === option.packageId),
    [packages, option.packageId]
  );

  // --- Mode-Wechsel via Header-Dropdown: Confirm wenn Daten vorhanden ---
  const [pendingMode, setPendingMode] = useState<OfferMode | null>(null);

  const hasOptionData = useMemo(() => {
    if (option.offerMode === 'unselected') return false;
    return !!option.packageId
      || !!option.packageName
      || option.menuSelection.courses.length > 0
      || option.menuSelection.drinks.length > 0
      || (option.totalAmount ?? 0) > 0;
  }, [option]);

  const applyModeChange = (mode: OfferMode) => {
    onUpdate({
      offerMode: mode,
      packageId: null,
      packageName: '',
      budgetPerPerson: null,
      menuSelection: { courses: [], drinks: [] },
      totalAmount: 0,
    });
  };

  const handleModeSelectChange = (value: string) => {
    // Sentinel: Restaurant-Menü laden (Mode bleibt 'menu', öffnet Import-Sheet)
    if (value === '__import') {
      if (option.offerMode !== 'menu') {
        if (hasOptionData) {
          setPendingMode('menu');
          return;
        }
        applyModeChange('menu');
      }
      onRequestImport?.();
      return;
    }
    const mode = value as OfferMode;
    if (mode === option.offerMode) return;
    if (hasOptionData) {
      setPendingMode(mode);
      return;
    }
    applyModeChange(mode);
  };

  // Trigger zeigt 'Restaurant-Menü laden …' wenn ein importiertes Restaurant-Menü aktiv ist
  const dropdownValue =
    option.offerMode === 'menu' && !!option.packageName && !option.packageId
      ? '__import'
      : option.offerMode;

  // Merged packageData mit Admin-Overrides für PriceBreakdown-Anzeige
  const effectivePackage = useMemo(() => {
    if (!selectedPackage) return undefined;
    const hasOverride = option.budgetPerPerson != null && option.budgetPerPerson > 0;
    return {
      ...selectedPackage,
      name: option.packageName || selectedPackage.name,
      // Override ersetzt den Katalogpreis vollständig — unabhängig vom Pakettyp.
      // - per_person: Override = Preis pro Gast → wird in PriceBreakdown × guests gerechnet.
      // - flat:        Override = Gesamtpreis → wird unverändert übernommen.
      price: hasOverride ? option.budgetPerPerson! : selectedPackage.price,
      // Hinweis für PriceBreakdown: kein calculateEventPackagePrice / Tier-Breakdown verwenden.
      __priceOverridden: hasOverride,
    };
  }, [selectedPackage, option.packageName, option.budgetPerPerson]);

  // --- Drink-Initialisierung aus package_drink_config ---
  const drinksInitializedForPkg = useRef<string | null>(null);

  useEffect(() => {
    if (
      option.offerMode !== 'paket' ||
      !option.packageId ||
      drinkConfigs.length === 0 ||
      drinksInitializedForPkg.current === option.packageId
    ) return;

    // Nur initialisieren wenn drinks noch leer
    if (option.menuSelection.drinks.length > 0) {
      drinksInitializedForPkg.current = option.packageId;
      return;
    }

    drinksInitializedForPkg.current = option.packageId;

    const initialDrinks: DrinkSelection[] = drinkConfigs.map(config => ({
      drinkGroup: config.drink_group,
      drinkLabel: config.drink_label,
      drinkLabel_en: config.drink_label_en ?? null,
      drinkLabel_it: config.drink_label_it ?? null,
      drinkLabel_fr: config.drink_label_fr ?? null,
      selectedChoice: null,
      quantityLabel: config.quantity_label,
      quantityLabel_en: config.quantity_label_en ?? null,
      quantityLabel_it: config.quantity_label_it ?? null,
      quantityLabel_fr: config.quantity_label_fr ?? null,
      customDrink: null,
    }));

    onUpdate({ menuSelection: { ...option.menuSelection, drinks: initialDrinks } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinkConfigs, option.packageId, option.offerMode]);

  const handlePackageChange = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return;
    drinksInitializedForPkg.current = null;
    onUpdate({
      packageId,
      packageName: pkg.name,
      menuSelection: { courses: [], drinks: [] },
    });
  };

  const handleCourseUpdate = (index: number, update: Partial<CourseSelection>) => {
    const updated = [...option.menuSelection.courses];
    updated[index] = { ...updated[index], ...update };
    onUpdate({ menuSelection: { ...option.menuSelection, courses: updated } });
  };

  const handleCourseAdd = (courseType: CourseType, courseLabel: string) => {
    // Auto-detect _en/_it/_fr aus courseConfigs des Pakets, sofern verfügbar
    const cfg = courseConfigs.find(c => c.course_type === courseType);
    const newCourse: CourseSelection = {
      courseType,
      courseLabel,
      courseLabel_en: cfg?.course_label_en ?? null,
      courseLabel_it: cfg?.course_label_it ?? null,
      courseLabel_fr: cfg?.course_label_fr ?? null,
      itemId: null,
      itemName: '',
      itemDescription: null,
      itemSource: 'catering',
      isCustom: false,
    };
    onUpdate({
      menuSelection: {
        ...option.menuSelection,
        courses: [...option.menuSelection.courses, newCourse],
      },
    });
  };

  const handleCourseRemove = (index: number) => {
    const updated = option.menuSelection.courses.filter((_, i) => i !== index);
    onUpdate({ menuSelection: { ...option.menuSelection, courses: updated } });
  };

  const handleDrinkUpdate = (index: number, update: Partial<DrinkSelection>) => {
    const updated = [...option.menuSelection.drinks];
    updated[index] = { ...updated[index], ...update };
    onUpdate({ menuSelection: { ...option.menuSelection, drinks: updated } });
  };

  const handleDrinkAdd = () => {
    const newDrink: DrinkSelection = {
      drinkGroup: 'custom',
      drinkLabel: 'Getränk',
      selectedChoice: null,
      quantityLabel: null,
      customDrink: null,
    };
    onUpdate({
      menuSelection: {
        ...option.menuSelection,
        drinks: [...option.menuSelection.drinks, newDrink],
      },
    });
  };

  const handleDrinkRemove = (index: number) => {
    const updated = option.menuSelection.drinks.filter((_, i) => i !== index);
    onUpdate({ menuSelection: { ...option.menuSelection, drinks: updated } });
  };

  const disabled = isLocked;

  const [notesOpen, setNotesOpen] = useState(false);
  const respondedRelative = respondedAt
    ? formatDistanceToNow(parseISO(respondedAt), { locale: de, addSuffix: true })
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "rounded-2xl border-border/40 shadow-sm overflow-hidden",
          !option.isActive && "opacity-50",
          isCustomerChoice && "ring-2 ring-foreground/80 border-transparent"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold",
              option.isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {option.optionLabel}
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isCustomerChoice && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    title={respondedRelative ? `Kundenwahl ${respondedRelative}` : "Kundenwahl"}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Kundenwahl
                    {respondedRelative && (
                      <span className="font-normal normal-case tracking-normal opacity-80">· {respondedRelative}</span>
                    )}
                  </span>
                )}
                
                <Select
                  value={dropdownValue}
                  onValueChange={handleModeSelectChange}
                  disabled={isLocked || option.offerMode === 'unselected'}
                >
                  <SelectTrigger className="h-8 sm:h-5 w-auto text-xs sm:text-[10px] rounded-lg border-0 bg-muted/50 px-2.5 sm:px-2 gap-1 font-medium">
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__import">
                      <span className="flex items-center gap-2">
                        <UtensilsCrossed className="h-3 w-3" />
                        Restaurant-Menü laden …
                      </span>
                    </SelectItem>
                    <SelectSeparator />
                    <SelectItem value="menu">Eigenes Menü</SelectItem>
                    <SelectItem value="paket">Paket</SelectItem>
                    <SelectItem value="freeform">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        Freitext-Import (KI)
                      </span>
                    </SelectItem>
                    <SelectItem value="email">Nur E-Mail</SelectItem>
                  </SelectContent>
                </Select>
                {isLocked && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleActive}
              className="h-11 w-11 sm:h-7 sm:w-7 rounded-lg"
              disabled={isLocked}
              title="Sichtbarkeit umschalten"
            >
              {option.isActive ? (
                <Eye className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              ) : (
                <EyeOff className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDuplicate}
              className="h-11 w-11 sm:h-7 sm:w-7 rounded-lg text-muted-foreground hover:text-foreground"
              disabled={!canDuplicate}
              title={canDuplicate ? "Option duplizieren" : "Maximum erreicht (5 Optionen)"}
            >
              <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-11 w-11 sm:h-7 sm:w-7 rounded-lg text-destructive/60 hover:text-destructive"
              disabled={isLocked || !canDelete}
              title={!canDelete ? "Mindestens eine Option erforderlich" : "Option entfernen"}
            >
              <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>
        </div>

        {/* Kundennotiz (nur wenn diese Option vom Kunden gewählt wurde) */}
        {isCustomerChoice && customerNotes && (
          <div className="px-5 py-2 border-b border-border/30 bg-muted/10">
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", notesOpen && "rotate-180")} />
              Anmerkung des Kunden
            </button>
            {notesOpen && (
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground bg-muted/40 rounded-xl p-3">
                {customerNotes}
              </p>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Typ-Auswahl-Kacheln (nur wenn Modus noch nicht gewählt) */}
          {option.offerMode === 'unselected' && (
            <ModeSelectorTiles
              onSelect={(mode) => applyModeChange(mode)}
              onRequestImport={onRequestImport}
              disabled={disabled}
            />
          )}

          {/* Nur-E-Mail-Modus: Hinweis im Body */}
          {option.offerMode === 'email' && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/30">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Diese Option hat keine Menükonfiguration — der Kunde erhält nur das Anschreiben weiter unten.
              </div>
            </div>
          )}

          {/* Modus-spezifischer Content */}
          {option.offerMode === 'menu' && (
            <MenuContent
              option={option}
              courseConfigs={courseConfigs}
              menuItems={menuItems}
              onUpdate={onUpdate}
              onCourseUpdate={handleCourseUpdate}
              onCourseAdd={handleCourseAdd}
              onCourseRemove={handleCourseRemove}
              disabled={disabled}
            />
          )}

          {option.offerMode === 'paket' && (
            <PaketContent
              option={option}
              packages={packages}
              courseConfigs={courseConfigs}
              drinkConfigs={drinkConfigs}
              menuItems={menuItems}
              onUpdate={onUpdate}
              onCourseUpdate={handleCourseUpdate}
              onCourseAdd={handleCourseAdd}
              onCourseRemove={handleCourseRemove}
              onDrinkUpdate={handleDrinkUpdate}
              onDrinkAdd={handleDrinkAdd}
              onDrinkRemove={handleDrinkRemove}
              disabled={disabled}
            />
          )}

          {option.offerMode === 'freeform' && (
            <FreeformContent option={option} onUpdate={onUpdate} disabled={disabled} />
          )}

          {/* Equipment & Personal — direkt unter dem Essen, damit sichtbar ist,
              dass diese Posten in die Gesamtsumme einfliessen. */}
          {(option.offerMode === 'menu' || option.offerMode === 'paket' || option.offerMode === 'email') && (
            <div className="space-y-4">
              <p className="text-[11px] text-muted-foreground/70 -mb-2">
                Equipment &amp; Personal — fliessen in die Gesamtsumme ein.
              </p>
              <InlineServiceEditor
                items={option.menuSelection.equipment ?? []}
                sectionType="equipment"
                onUpdate={(items) => onUpdate({ menuSelection: { ...option.menuSelection, equipment: items } })}
                disabled={disabled}
              />
              <InlineServiceEditor
                items={option.menuSelection.staff ?? []}
                sectionType="staff"
                onUpdate={(items) => onUpdate({ menuSelection: { ...option.menuSelection, staff: items } })}
                disabled={disabled}
              />
            </div>
          )}

          {/* Preis — nur anzeigen wenn mindestens 1 Gang konfiguriert */}
          {(option.offerMode === 'paket' || (option.offerMode === 'menu' && option.menuSelection.courses.some(c => c.itemName))) && (
          <PriceBreakdown
            packageData={option.offerMode === 'menu' ? undefined : effectivePackage}
            guestCount={option.guestCount}
            courses={option.offerMode === 'menu' ? option.menuSelection.courses : undefined}
            menuItems={option.offerMode === 'menu' ? menuItems : undefined}
            winePairingPrice={option.offerMode === 'menu' ? computeDrinksPerPerson(option) : option.menuSelection.winePairingPrice}
            drinksLabel={option.offerMode === 'menu' ? computeDrinksLabel(option) : undefined}
            totalAmount={option.totalAmount}
            onTotalChange={option.offerMode === 'menu' ? (total) => onUpdate({ totalAmount: total }) : undefined}
            onCourseUpdate={option.offerMode === 'menu' ? handleCourseUpdate : undefined}
            finalPricePerPerson={option.budgetPerPerson}
            onFinalPriceChange={(price) => onUpdate({ budgetPerPerson: price })}
            pricingMode={option.pricingMode ?? 'per_person'}
            onPricingModeChange={(mode) => onUpdate({ pricingMode: mode })}
            discountPercent={option.discountPercent}
            onDiscountChange={(pct) => onUpdate({ discountPercent: pct })}
            discountAmount={option.discountAmount}
            onDiscountAmountChange={(amt) => onUpdate({ discountAmount: amt })}
            disabled={disabled}
            equipment={option.menuSelection.equipment}
            staff={option.menuSelection.staff}
          />
          )}
        </div>
      </Card>

      {/* Confirm-Dialog: Typ-Wechsel mit Datenverlust nur dieser Option */}
      <AlertDialog open={pendingMode !== null} onOpenChange={(open) => !open && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Typ wechseln?</AlertDialogTitle>
            <AlertDialogDescription>
              Bei Typ-Wechsel gehen Konfiguration und Preise dieser Option verloren.
              Andere Optionen sind nicht betroffen. Fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMode) applyModeChange(pendingMode);
                setPendingMode(null);
              }}
            >
              Wechseln
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// --- Typ-Auswahl-Kacheln (im Body einer noch nicht konfigurierten Karte) ---
function ModeSelectorTiles({
  onSelect,
  onRequestImport,
  disabled,
}: {
  onSelect: (mode: OfferMode) => void;
  onRequestImport?: () => void;
  disabled: boolean;
}) {
  const tiles: Array<{ mode: OfferMode; icon: typeof ChefHat; label: string; hint: string; triggersImport?: boolean }> = [
    { mode: 'menu', icon: UtensilsCrossed, label: 'Restaurant-Menü', hint: 'Speisekarte laden & anpassen', triggersImport: true },
    { mode: 'menu', icon: ChefHat, label: 'Eigenes Menü', hint: 'Gänge frei zusammenstellen' },
    { mode: 'paket', icon: PackageIcon, label: 'Paket', hint: 'Fertigpaket wählen' },
    { mode: 'freeform', icon: Sparkles, label: 'Freitext-Import', hint: 'KI parst Text in Angebot' },
    { mode: 'email', icon: Mail, label: 'Nur E-Mail', hint: 'ohne Menükonfiguration' },
  ];

  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Typ dieser Option wählen
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(({ mode, icon: Icon, label, hint, triggersImport }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (disabled) return;
              onSelect(mode);
              if (triggersImport && onRequestImport) onRequestImport();
            }}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border-2 border-border/40 bg-muted/20 transition-all text-center",
              "hover:border-primary hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-semibold leading-tight text-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Modus: Freitext-Import (KI) ---
function FreeformContent({
  option,
  onUpdate,
  disabled,
}: {
  option: OfferBuilderOption;
  onUpdate: (u: Partial<OfferBuilderOption>) => void;
  disabled: boolean;
}) {
  const program = option.menuSelection.freeformProgram ?? null;

  const setProgram = (p: FreeformProgram | null) => {
    onUpdate({
      menuSelection: { ...option.menuSelection, freeformProgram: p },
      // totalAmount aus brutto übernehmen (Maestro-Prinzip: 1:1)
      totalAmount: p?.totalsFromText?.gross ?? 0,
      packageName: p?.title || option.packageName || 'Catering-Programm',
    });
  };

  if (!program) {
    return <FreeformImportPanel onParsed={setProgram} disabled={disabled} />;
  }

  return (
    <FreeformProgramEditor
      program={program}
      onChange={(p) =>
        onUpdate({
          menuSelection: { ...option.menuSelection, freeformProgram: p },
          totalAmount: p.totalsFromText?.gross ?? 0,
          packageName: p.title || option.packageName,
        })
      }
      onClear={() => setProgram(null)}
      disabled={disabled}
    />
  );
}

// --- Hilfsfunktionen für Drink-Kalkulation ---
function computeDrinksPerPerson(option: OfferBuilderOption): number | null {
  const mode = option.menuSelection.drinksMode ?? 'none';
  const pm = option.pricingMode ?? 'per_person';
  switch (mode) {
    case 'weinbegleitung': {
      const p = option.menuSelection.winePairingPrice ?? null;
      return p != null && p > 0 ? p : null;
    }
    case 'pauschale': {
      const p = option.menuSelection.drinksPauschalePrice ?? null;
      return p != null && p > 0 ? p : null;
    }
    case 'einzeln': {
      // Bei per_event: Zeilen-Total = pricePerPerson * quantity.
      // Bei per_person: einfach Summe (quantity ist dann immer 1).
      const sum = (option.menuSelection.drinksEinzeln ?? []).reduce((s, d) => {
        const qty = pm === 'per_event' ? (d.quantity ?? 1) : 1;
        return s + d.pricePerPerson * qty;
      }, 0);
      return sum > 0 ? sum : null;
    }
    default:
      return null;
  }
}

function computeDrinksLabel(option: OfferBuilderOption): string | undefined {
  const mode = option.menuSelection.drinksMode ?? 'none';
  switch (mode) {
    case 'weinbegleitung': return 'Weinbegleitung';
    case 'pauschale': return option.menuSelection.drinksPauschaleDescription || 'Getränkepauschale';
    case 'einzeln': return 'Getränke';
    default: return undefined;
  }
}

// --- Modus: Menü (freie Gangkonfiguration) ---
function MenuContent({
  option,
  courseConfigs,
  menuItems,
  onUpdate,
  onCourseUpdate,
  onCourseAdd,
  onCourseRemove,
  disabled,
}: {
  option: OfferBuilderOption;
  courseConfigs: CourseConfig[];
  menuItems: CombinedMenuItem[];
  onUpdate: (u: Partial<OfferBuilderOption>) => void;
  onCourseUpdate: (idx: number, u: Partial<CourseSelection>) => void;
  onCourseAdd: (type: CourseType, label: string) => void;
  onCourseRemove: (idx: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Gänge */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Menü
          </h4>
        </div>
        <InlineCourseEditor
          courses={option.menuSelection.courses}
          courseConfigs={courseConfigs}
          menuItems={menuItems}
          onUpdateCourse={onCourseUpdate}
          onAddCourse={onCourseAdd}
          onRemoveCourse={onCourseRemove}
          onReorderCourses={(reordered) => {
            onUpdate({ menuSelection: { ...option.menuSelection, courses: reordered } });
          }}
          pricingMode={option.pricingMode ?? 'per_person'}
          disabled={disabled}
        />
      </div>

      {/* Getränke-Sektion */}
      <DrinkSection
        drinksMode={option.menuSelection.drinksMode ?? 'none'}
        drinksPauschalePrice={option.menuSelection.drinksPauschalePrice ?? null}
        drinksPauschaleDescription={option.menuSelection.drinksPauschaleDescription ?? null}
        winePairingPrice={option.menuSelection.winePairingPrice ?? null}
        drinksEinzeln={option.menuSelection.drinksEinzeln ?? []}
        menuItems={menuItems}
        onUpdate={(update) => onUpdate({ menuSelection: { ...option.menuSelection, ...update } })}
        pricingMode={option.pricingMode ?? 'per_person'}
        disabled={disabled}
      />
    </div>
  );
}

// --- Modus: Paket (Fertige Pakete zur Auswahl + Speisen/Getränke) ---
function PaketContent({
  option,
  packages,
  courseConfigs,
  drinkConfigs,
  menuItems,
  onUpdate,
  onCourseUpdate,
  onCourseAdd,
  onCourseRemove,
  onDrinkUpdate,
  onDrinkAdd,
  onDrinkRemove,
  disabled,
}: {
  option: OfferBuilderOption;
  packages: Package[];
  courseConfigs: CourseConfig[];
  drinkConfigs: DrinkConfig[];
  menuItems: CombinedMenuItem[];
  onUpdate: (u: Partial<OfferBuilderOption>) => void;
  onCourseUpdate: (idx: number, u: Partial<CourseSelection>) => void;
  onCourseAdd: (type: CourseType, label: string) => void;
  onCourseRemove: (idx: number) => void;
  onDrinkUpdate: (idx: number, u: Partial<DrinkSelection>) => void;
  onDrinkAdd: () => void;
  onDrinkRemove: (idx: number) => void;
  disabled: boolean;
}) {
  const handleSelectPackage = (pkg: Package) => {
    if (option.packageId === pkg.id) return; // Bereits gewählt → nicht zurücksetzen
    onUpdate({
      packageId: pkg.id,
      packageName: pkg.name,
      // Snapshot des Paket-Preises — User kann ihn danach überschreiben
      budgetPerPerson: pkg.price_per_person ? pkg.price : null,
      menuSelection: { courses: [], drinks: [] },
    });
  };

  const handleUnselectPackage = () => {
    onUpdate({
      packageId: null,
      packageName: '',
      budgetPerPerson: null,
      menuSelection: { courses: [], drinks: [] },
    });
  };

  const selectedPkg = packages.find(p => p.id === option.packageId);

  // Importiertes Restaurant-Menü (kein DB-Paket, nur Name + Preis)
  const isImportedMenu = !option.packageId && !!option.packageName;

  return (
    <div className="space-y-3">
      {/* Importiertes Menü anzeigen */}
      {isImportedMenu && (
        <div className="flex items-start gap-3 p-3 rounded-xl border-2 border-amber-500 bg-amber-50">
          <UtensilsCrossed className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-900">{option.packageName}</div>
            {option.budgetPerPerson != null && (
              <div className="text-xs text-amber-700 font-medium mt-0.5">
                {option.budgetPerPerson.toFixed(2).replace('.', ',')} € / Person
                {option.guestCount > 0 && ` · ${(option.budgetPerPerson * option.guestCount).toFixed(2).replace('.', ',')} € gesamt`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bug A: Bei importiertem Restaurant-Menü KEINE zusätzliche Paket-Auswahl anbieten */}
      {!isImportedMenu && (
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {option.packageId ? 'Paket (editierbar)' : 'Paket wählen'}
        </span>
      )}

      {/* Editierbare Karte wenn Paket bereits gewählt */}
      {isImportedMenu ? null : option.packageId && selectedPkg ? (
        <div className="rounded-xl border-2 border-primary bg-primary/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="h-4 w-4 rounded-full bg-primary shrink-0 mt-1.5" />
            <div className="flex-1 min-w-0 space-y-2">
              {/* Paket-Name editierbar */}
              <Input
                value={option.packageName}
                onChange={(e) => onUpdate({ packageName: e.target.value })}
                disabled={disabled}
                placeholder="Paket-Name"
                className="h-8 text-sm font-semibold bg-background/60 border-primary/20"
              />

              {/* Preis pro Person editierbar */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  {selectedPkg.price_per_person ? 'Preis/Person:' : 'Gesamtpreis:'}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={option.budgetPerPerson ?? ''}
                  onChange={(e) => onUpdate({ budgetPerPerson: e.target.value ? parseFloat(e.target.value) : null })}
                  disabled={disabled}
                  placeholder={selectedPkg.price.toFixed(2)}
                  className="h-7 w-28 text-sm"
                />
                <span className="text-xs text-muted-foreground">€</span>
                {option.guestCount > 0 && option.budgetPerPerson != null && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedPkg.price_per_person
                      ? `= ${(option.budgetPerPerson * option.guestCount).toFixed(2).replace('.', ',')} € gesamt`
                      : `= ${(option.budgetPerPerson / option.guestCount).toFixed(2).replace('.', ',')} € pro Person`}
                  </span>
                )}
              </div>

              {/* Original-Beschreibung als Referenz */}
              {selectedPkg.description && (
                <div className="text-[11px] text-muted-foreground/70 italic">
                  Original: {selectedPkg.description}
                </div>
              )}
            </div>
          </div>

          {/* Anderes Paket wählen */}
          <button
            type="button"
            onClick={handleUnselectPackage}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            <RefreshCw className="h-3 w-3" />
            Anderes Paket wählen
          </button>
        </div>
      ) : (
        /* Paket-Liste wenn noch nichts gewählt */
        <div className="grid gap-2">
          {packages.map(pkg => {
            return (
              <button
                key={pkg.id}
                onClick={() => !disabled && handleSelectPackage(pkg)}
                disabled={disabled}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors",
                  "border-border/40 hover:border-border hover:bg-muted/20",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="h-4 w-4 rounded-full border-2 shrink-0 mt-0.5 border-muted-foreground/40" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{pkg.name}</div>
                  {pkg.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {pkg.description}
                    </div>
                  )}
                  <div className="text-xs font-medium text-primary mt-1">
                    {pkg.price_per_person
                      ? `${pkg.price.toFixed(2)} € pro Person`
                      : `${pkg.price.toFixed(2)} € pauschal`}
                    {pkg.min_guests && ` · ab ${pkg.min_guests} Pers.`}
                    {pkg.max_guests && ` · max. ${pkg.max_guests} Pers.`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Speisen & Getränke — nach Paketauswahl */}
      {option.packageId && (
        <div className="space-y-4 pt-2 border-t border-border/20">
          {/* Speisen */}
          {courseConfigs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Speisen
              </h4>
              <InlineCourseEditor
                courses={option.menuSelection.courses}
                courseConfigs={courseConfigs}
                menuItems={menuItems}
                onUpdateCourse={onCourseUpdate}
                onAddCourse={onCourseAdd}
                onRemoveCourse={onCourseRemove}
                onReorderCourses={(reordered) =>
                  onUpdate({ menuSelection: { ...option.menuSelection, courses: reordered } })
                }
                pricingMode={option.pricingMode ?? 'per_person'}
                disabled={disabled}
                packageMode={true}
              />
            </div>
          )}

          {/* Getränke */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Getränke
            </h4>
            <InlineDrinkEditor
              drinks={option.menuSelection.drinks}
              drinkConfigs={drinkConfigs}
              onUpdateDrink={onDrinkUpdate}
              onAddDrink={onDrinkAdd}
              onRemoveDrink={onDrinkRemove}
              disabled={disabled}
            />
          </div>

          {/* Lade-Hinweis */}
          {courseConfigs.length === 0 && option.menuSelection.drinks.length === 0 && (
            <p className="text-xs text-muted-foreground animate-pulse">
              Paket-Konfiguration wird geladen...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

