import { useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Trash2, Lock, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DrinkConfig,
  CourseSelection,
  DrinkSelection,
  CourseType,
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

  const eventPackages = useMemo(
    () => packages.filter(p => p.package_type === 'event'),
    [packages]
  );

  const handlePackageChange = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return;
    // Courses + Drinks leeren bei Paketwechsel — werden durch useEffect neu initialisiert
    onUpdate({
      packageId,
      packageName: pkg.name,
      menuSelection: { courses: [], drinks: [] },
    });
  };

  // Courses aus Package-Config initialisieren (bei Paketwechsel oder wenn leer)
  useEffect(() => {
    if (!option.packageId || !courseConfigs.length) return;
    if (option.offerMode === 'a_la_carte') return;
    if (option.menuSelection.courses.length > 0) return;

    const initialCourses: CourseSelection[] = courseConfigs.map(cc => ({
      courseType: cc.course_type,
      courseLabel: cc.course_label,
      itemId: null,
      itemName: cc.is_custom_item ? (cc.custom_item_name || '') : '',
      itemDescription: cc.is_custom_item ? (cc.custom_item_description || null) : null,
      itemSource: 'catering' as const,
      isCustom: cc.is_custom_item ?? false,
    }));
    onUpdate({ menuSelection: { ...option.menuSelection, courses: initialCourses } });
  }, [option.packageId, courseConfigs.length, option.offerMode]);

  // Drinks aus Package-Config initialisieren (nur bei fest_menu)
  useEffect(() => {
    if (!option.packageId || !drinkConfigs.length) return;
    if (option.offerMode !== 'fest_menu') return;
    if (option.menuSelection.drinks.length > 0) return;

    const initialDrinks: DrinkSelection[] = drinkConfigs.map(dc => ({
      drinkGroup: dc.drink_group,
      drinkLabel: dc.drink_label,
      selectedChoice: null,
      quantityLabel: dc.quantity_label || null,
      customDrink: null,
    }));
    onUpdate({ menuSelection: { ...option.menuSelection, drinks: initialDrinks } });
  }, [option.packageId, drinkConfigs.length, option.offerMode]);

  const handleGuestCountChange = (val: string) => {
    const count = parseInt(val) || 0;
    if (count >= 0) onUpdate({ guestCount: count });
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
                      ...(offerMode === 'a_la_carte' ? {
                        menuSelection: { courses: [], drinks: [] },
                        budgetPerPerson: null,
                      } : {}),
                    });
                  }}
                  disabled={isLocked}
                >
                  <SelectTrigger className="h-5 w-auto text-[10px] rounded-lg border-0 bg-muted/50 px-2 gap-1 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_la_carte">À la carte</SelectItem>
                    <SelectItem value="teil_menu">Teil-Menü</SelectItem>
                    <SelectItem value="fest_menu">Fest-Menü</SelectItem>
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
          {/* Paket + Gäste (Paket nur bei teil_menu und fest_menu) */}
          <div className={cn("grid gap-3", option.offerMode === 'a_la_carte' ? "grid-cols-1" : "grid-cols-2")}>
            {option.offerMode !== 'a_la_carte' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Location / Paket
                </label>
                <Select
                  value={option.packageId || ''}
                  onValueChange={handlePackageChange}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 rounded-xl">
                    <SelectValue placeholder="Paket wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eventPackages.map(pkg => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({pkg.price_per_person ? `${pkg.price} €/P.` : `${pkg.price} € pauschal`})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Gäste
              </label>
              <Input
                type="number"
                value={option.guestCount}
                onChange={(e) => handleGuestCountChange(e.target.value)}
                min={1}
                className="h-9 rounded-xl"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Modus-spezifischer Content */}
          {option.offerMode === 'a_la_carte' && (
            <AlaCarteContent
              option={option}
              onUpdate={onUpdate}
              disabled={disabled}
            />
          )}

          {option.offerMode === 'teil_menu' && (
            <TeilMenuContent
              option={option}
              courseConfigs={courseConfigs}
              menuItems={menuItems}
              onCourseUpdate={handleCourseUpdate}
              onCourseAdd={handleCourseAdd}
              onCourseRemove={handleCourseRemove}
              disabled={disabled}
            />
          )}

          {option.offerMode === 'fest_menu' && (
            <FestMenuContent
              option={option}
              courseConfigs={courseConfigs}
              drinkConfigs={drinkConfigs}
              menuItems={menuItems}
              onUpdate={onUpdate}
              onCourseUpdate={handleCourseUpdate}
              onCourseAdd={handleCourseAdd}
              onCourseRemove={handleCourseRemove}
              onDrinkUpdate={handleDrinkUpdate}
              disabled={disabled}
            />
          )}

          {/* Preis (nicht bei à la carte — dort gibt es keinen Konfigurator-Preis) */}
          {option.offerMode !== 'a_la_carte' && (
            <PriceBreakdown
              packageData={selectedPackage}
              guestCount={option.guestCount}
              menuPricePerPerson={option.budgetPerPerson || 0}
            />
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// --- Modus: À la carte (Reservierungsbestätigung, kein Konfigurator) ---
function AlaCarteContent({
  option,
  onUpdate,
  disabled,
}: {
  option: OfferBuilderOption;
  onUpdate: (u: Partial<OfferBuilderOption>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 border border-amber-200/50 p-3 space-y-2">
        <p className="text-xs font-medium text-amber-800">
          Reservierungsbestätigung
        </p>
        <p className="text-xs text-amber-700/80">
          Gäste bestellen frei von unserer Speisekarte. Kein Menü-Konfigurator nötig.
          Verwenden Sie die Vorlage "Reservierungsanfrage (Gruppen)" im Anschreiben.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`attach-menu-${option.id}`}
          checked={option.attachMenu}
          onCheckedChange={(checked) =>
            onUpdate({ attachMenu: checked === true })
          }
          disabled={disabled}
        />
        <label
          htmlFor={`attach-menu-${option.id}`}
          className="text-sm cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
          Aktuelle Speisekarte als PDF beifügen
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Tisch-Anordnung (optional)
        </label>
        <Input
          value={option.tableNote || ''}
          onChange={(e) => onUpdate({ tableNote: e.target.value || null })}
          placeholder="z.B. 2 lange Tafeln à 12 Personen, Vorspeisenplatte"
          className="h-9 rounded-xl"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// --- Modus: Teil-Menü ---
function TeilMenuContent({
  option,
  courseConfigs,
  menuItems,
  onCourseUpdate,
  onCourseAdd,
  onCourseRemove,
  disabled,
}: {
  option: OfferBuilderOption;
  courseConfigs: CourseConfig[];
  menuItems: CombinedMenuItem[];
  onCourseUpdate: (idx: number, u: Partial<CourseSelection>) => void;
  onCourseAdd: (type: CourseType, label: string) => void;
  onCourseRemove: (idx: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <InlineCourseEditor
        courses={option.menuSelection.courses}
        courseConfigs={courseConfigs}
        menuItems={menuItems}
        onUpdateCourse={onCourseUpdate}
        onAddCourse={onCourseAdd}
        onRemoveCourse={onCourseRemove}
        disabled={disabled}
        isPartialMenu
      />
      <div className="rounded-xl bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Hauptgang & Rest: Gäste bestellen à la carte vor Ort.
        </p>
      </div>
    </div>
  );
}

// --- Modus: Fest-Menü ---
function FestMenuContent({
  option,
  courseConfigs,
  drinkConfigs,
  menuItems,
  onUpdate,
  onCourseUpdate,
  onCourseAdd,
  onCourseRemove,
  onDrinkUpdate,
  disabled,
}: {
  option: OfferBuilderOption;
  courseConfigs: CourseConfig[];
  drinkConfigs: DrinkConfig[];
  menuItems: CombinedMenuItem[];
  onUpdate: (u: Partial<OfferBuilderOption>) => void;
  onCourseUpdate: (idx: number, u: Partial<CourseSelection>) => void;
  onCourseAdd: (type: CourseType, label: string) => void;
  onCourseRemove: (idx: number) => void;
  onDrinkUpdate: (idx: number, u: Partial<DrinkSelection>) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Budget pro Person */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Budget pro Person (Orientierung)
        </label>
        <div className="relative">
          <Input
            type="number"
            value={option.budgetPerPerson || ''}
            onChange={(e) =>
              onUpdate({ budgetPerPerson: parseFloat(e.target.value) || null })
            }
            placeholder="z.B. 85"
            className="h-9 rounded-xl pr-8"
            disabled={disabled}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            €
          </span>
        </div>
      </div>

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
          disabled={disabled}
        />
      </div>

      {/* Getränke — anzeigen wenn Drinks vorhanden ODER drinkConfigs geladen */}
      {(option.menuSelection.drinks.length > 0 || drinkConfigs.length > 0) && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Getränke
          </h4>
          <InlineDrinkEditor
            drinks={option.menuSelection.drinks}
            drinkConfigs={drinkConfigs}
            onUpdateDrink={onDrinkUpdate}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
