import { useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Trash2, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { InlineCourseEditor } from "./InlineCourseEditor";
import { InlineDrinkEditor } from "./InlineDrinkEditor";
import { PriceBreakdown } from "./PriceBreakdown";
import type {
  OfferBuilderOption,
  OfferMode,
  CourseConfig,
  CourseSelection,
  CourseType,
  DrinkConfig,
  DrinkSelection,
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
  onToggleActive: () => void;
  isLocked: boolean;
}

export function OptionCard({
  option,
  packages,
  menuItems,
  courseConfigs,
  drinkConfigs,
  onUpdate,
  onRemove,
  onToggleActive,
  isLocked,
}: OptionCardProps) {
  const selectedPackage = useMemo(
    () => packages.find(p => p.id === option.packageId),
    [packages, option.packageId]
  );

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
      selectedChoice: null,
      quantityLabel: config.quantity_label,
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
    const newCourse: CourseSelection = {
      courseType,
      courseLabel,
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
      drinkLabel: 'Zusatzgetränk',
      selectedChoice: null,
      quantityLabel: null,
      customDrink: '',
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
          !option.isActive && "opacity-50"
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
                <span className="text-sm font-semibold">Option {option.optionLabel}</span>
                <Select
                  value={option.offerMode}
                  onValueChange={(mode: string) => {
                    const offerMode = mode as OfferMode;
                    onUpdate({
                      offerMode,
                      ...(offerMode === 'paket' ? {
                        menuSelection: { courses: [], drinks: [] },
                        budgetPerPerson: null,
                      } : offerMode === 'menu' ? {
                        packageId: null,
                        packageName: '',
                      } : {}),
                    });
                  }}
                  disabled={isLocked}
                >
                  <SelectTrigger className="h-5 w-auto text-[10px] rounded-lg border-0 bg-muted/50 px-2 gap-1 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menu">Menü</SelectItem>
                    <SelectItem value="paket">Paket</SelectItem>
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
              className="h-7 w-7 rounded-lg"
              disabled={isLocked}
            >
              {option.isActive ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-7 w-7 rounded-lg text-destructive/60 hover:text-destructive"
              disabled={isLocked}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
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

          {/* Preis */}
          <PriceBreakdown
            packageData={option.offerMode === 'menu' ? undefined : selectedPackage}
            guestCount={option.guestCount}
            courses={option.offerMode === 'menu' ? option.menuSelection.courses : undefined}
            menuItems={option.offerMode === 'menu' ? menuItems : undefined}
            winePairingPrice={option.menuSelection.winePairingPrice}
            totalAmount={option.totalAmount}
            onTotalChange={option.offerMode === 'menu' ? (total) => onUpdate({ totalAmount: total }) : undefined}
            onCourseUpdate={option.offerMode === 'menu' ? handleCourseUpdate : undefined}
            finalPricePerPerson={option.budgetPerPerson}
            onFinalPriceChange={(price) => onUpdate({ budgetPerPerson: price })}
            disabled={disabled}
          />
        </div>
      </Card>
    </motion.div>
  );
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
  const hasWinePairing = (option.menuSelection.winePairingPrice ?? null) !== null;

  return (
    <div className="space-y-4">
      {/* Gänge */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Menü
        </h4>
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
          disabled={disabled}
        />
      </div>

      {/* Weinbegleitung */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasWinePairing}
            onChange={(e) => {
              onUpdate({
                menuSelection: {
                  ...option.menuSelection,
                  winePairingPrice: e.target.checked ? 0 : null,
                },
              });
            }}
            disabled={disabled}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            🍷 Weinbegleitung
          </span>
        </label>
        {hasWinePairing && (
          <div className="relative ml-6 w-40">
            <Input
              type="number"
              value={option.menuSelection.winePairingPrice || ''}
              onChange={(e) =>
                onUpdate({
                  menuSelection: {
                    ...option.menuSelection,
                    winePairingPrice: parseFloat(e.target.value) || 0,
                  },
                })
              }
              placeholder="z.B. 25"
              className="h-9 rounded-xl pr-16"
              disabled={disabled}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              € / Pers.
            </span>
          </div>
        )}
      </div>
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
    onUpdate({
      packageId: pkg.id,
      packageName: pkg.name,
      menuSelection: { courses: [], drinks: [] },
    });
  };

  return (
    <div className="space-y-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Paket wählen
      </span>
      <div className="grid gap-2">
        {packages.map(pkg => {
          const isSelected = option.packageId === pkg.id;
          return (
            <button
              key={pkg.id}
              onClick={() => !disabled && handleSelectPackage(pkg)}
              disabled={disabled}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-border hover:bg-muted/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "h-4 w-4 rounded-full border-2 shrink-0 mt-0.5",
                isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
              )} />
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
                disabled={disabled}
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

