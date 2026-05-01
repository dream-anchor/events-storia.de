import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Package as PackageIcon,
  UtensilsCrossed,
  Wine,
  FileText,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  AlertTriangle,
  Lock,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OfferOption, MenuSelectionType } from "./types";
import { Package, ExtendedInquiry } from "../types";
import { calculateEventPackagePrice } from "@/lib/eventPricing";
import { LiveCalculation } from "./LiveCalculation";
import { CourseProgress } from "../MenuComposer/CourseProgress";
import { CourseSelector } from "../MenuComposer/CourseSelector";
import { DrinkPackageSelector } from "../MenuComposer/DrinkPackageSelector";
import { usePackageMenuConfig } from "../MenuComposer/usePackageMenuConfig";
import { useCombinedMenuItems } from "@/hooks/useCombinedMenuItems";
import type { OfferBuilderOption } from "../OfferBuilder/types";
import type {
  MenuSelection,
  CourseSelection,
  DrinkSelection,
  MenuItem,
  CourseType,
} from "../MenuComposer/types";

type WizardStep = 1 | 2 | 3 | 4;

interface WizardConfiguratorProps {
  option: OfferOption;
  packages: Package[];
  inquiry: ExtendedInquiry;
  onUpdateOption: (updates: Partial<OfferOption>) => void;
  onBack: () => void;
  onImportRestaurantMenus?: (imported: Partial<OfferBuilderOption>[]) => void;
  isLocked?: boolean;
  onFlushSave?: () => Promise<void>;
  onGenerateEmail?: () => Promise<void> | void;
  isGeneratingEmail?: boolean;
}

export function WizardConfigurator({
  option,
  packages,
  inquiry,
  onUpdateOption,
  onBack,
  onImportRestaurantMenus,
  isLocked = false,
  onFlushSave,
  onGenerateEmail,
  isGeneratingEmail = false,
}: WizardConfiguratorProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>(
    option.packageId ? 2 : 1
  );
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const autoAdvancingRef = useRef(false);

  const selectedPackage = packages.find((p) => p.id === option.packageId);

  // =================================================================
  // PRICE SYNC (Bug 3): totalAmount muss IMMER aus
  // (packagePrice, guestCount, pricePerPerson) abgeleitet sein.
  // Ohne diesen Effect bleibt der Preis hängen wenn der Admin nur
  // die Gästezahl ändert → DB speichert alten Wert → Public Offer
  // zeigt alten Wert.
  // =================================================================
  useEffect(() => {
    if (!selectedPackage || !option.packageId) return;
    const expected = calculateEventPackagePrice(
      selectedPackage.id,
      selectedPackage.price,
      option.guestCount,
      !!selectedPackage.price_per_person
    );
    // Rundung auf 2 Dezimalstellen für stabilen Vergleich (Float-Drift)
    const roundedExpected = Math.round(expected * 100) / 100;
    const roundedCurrent = Math.round((option.totalAmount || 0) * 100) / 100;
    if (roundedExpected !== roundedCurrent) {
      onUpdateOption({ totalAmount: roundedExpected });
    }
  }, [
    option.packageId,
    option.guestCount,
    option.totalAmount,
    selectedPackage,
    onUpdateOption,
  ]);

  // Load menu configs for the selected package
  const { courseConfigs, drinkConfigs, isLoading: configLoading } = usePackageMenuConfig(
    option.packageId
  );
  const { items: allMenuItems, isLoading: itemsLoading } = useCombinedMenuItems();

  const isDataLoading = configLoading || itemsLoading;

  // Transform menu items
  const menuItems: MenuItem[] = useMemo(() => {
    return allMenuItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category_name: item.category_name || "Unbekannt",
      source: (item.source === "ristorante" ? "ristorante" : "catering") as
        | "catering"
        | "ristorante",
    }));
  }, [allMenuItems]);

  // Adapt MenuSelectionType to MenuSelection
  const adaptedMenuSelection: MenuSelection = useMemo(
    () => ({
      courses: option.menuSelection.courses.map((c) => ({
        ...c,
        courseType: c.courseType as CourseType,
        itemSource: c.itemSource as MenuSelection["courses"][0]["itemSource"],
      })),
      drinks: option.menuSelection.drinks.map((d) => ({
        ...d,
        drinkGroup:
          d.drinkGroup as MenuSelection["drinks"][0]["drinkGroup"],
      })),
    }),
    [option.menuSelection]
  );

  // Completion checks — uses .filter().some() to support multi-select
  const coursesComplete = useMemo(() => {
    if (courseConfigs.length === 0) return true;
    const required = courseConfigs.filter((c) => c.is_required);
    return required.every((config) => {
      const selections = adaptedMenuSelection.courses.filter(
        (c) => c.courseType === config.course_type
      );
      return selections.some((s) => s.itemId || s.isCustom);
    });
  }, [courseConfigs, adaptedMenuSelection.courses]);

  const drinksComplete = useMemo(() => {
    const required = drinkConfigs.filter((c) => c.is_choice);
    if (required.length === 0) return true;
    return required.every((config) => {
      const sel = adaptedMenuSelection.drinks.find(
        (d) => d.drinkGroup === config.drink_group
      );
      return sel?.selectedChoice || sel?.customDrink;
    });
  }, [drinkConfigs, adaptedMenuSelection.drinks]);

  // Course selection helper — returns ALL selections for a courseType (multi-select)
  const getCourseSelections = (courseType: CourseType): CourseSelection[] => {
    return adaptedMenuSelection.courses.filter((c) => c.courseType === courseType);
  };

  // Handle course selection — toggle mode: add if not selected, remove if already selected
  const handleCourseSelect = useCallback(
    (selection: CourseSelection) => {
      const newCourses = [...option.menuSelection.courses];

      const adapted = {
        ...selection,
        courseType: selection.courseType as string,
        itemSource: selection.itemSource as string,
      };

      // Check if this exact item is already selected for this course
      const existingIndex = newCourses.findIndex(
        (c) =>
          c.courseType === selection.courseType &&
          ((c.itemId && c.itemId === selection.itemId) ||
            (c.isCustom && c.itemName === selection.itemName))
      );

      if (existingIndex >= 0) {
        // Toggle off — remove this selection
        newCourses.splice(existingIndex, 1);
      } else {
        // Add this selection (allows multiple per courseType)
        newCourses.push(adapted);
      }

      onUpdateOption({
        menuSelection: { ...option.menuSelection, courses: newCourses },
      });
    },
    [option.menuSelection, onUpdateOption]
  );

  // Handle drink selection
  const handleDrinkSelect = useCallback(
    (selection: DrinkSelection) => {
      const newDrinks = [...option.menuSelection.drinks];
      const existingIndex = newDrinks.findIndex(
        (d) => d.drinkGroup === selection.drinkGroup
      );

      const adapted = {
        ...selection,
        drinkGroup: selection.drinkGroup as string,
      };

      if (existingIndex >= 0) {
        newDrinks[existingIndex] = adapted;
      } else {
        newDrinks.push(adapted);
      }

      onUpdateOption({
        menuSelection: { ...option.menuSelection, drinks: newDrinks },
      });
    },
    [option.menuSelection, onUpdateOption]
  );

  // Navigate to next course or next step
  const handleNextCourse = useCallback(() => {
    if (activeCourseIndex < courseConfigs.length - 1) {
      setActiveCourseIndex(activeCourseIndex + 1);
    } else {
      setActiveStep(3);
    }
  }, [activeCourseIndex, courseConfigs.length]);

  // Apply package change (extracted so confirm-dialog can call it)
  const applyPackageChange = useCallback(
    (packageId: string) => {
      const pkg = packages.find((p) => p.id === packageId);
      if (!pkg) return;
      const newTotal = calculateEventPackagePrice(
        pkg.id,
        pkg.price,
        option.guestCount,
        !!pkg.price_per_person,
      );
      onUpdateOption({
        packageId,
        packageName: pkg.name,
        totalAmount: newTotal,
        menuSelection: { courses: [], drinks: [] },
      });
      setActiveCourseIndex(0);
    },
    [packages, option.guestCount, onUpdateOption],
  );

  // Confirm-Dialog vor Paketwechsel wenn bereits Menü-Auswahl existiert
  const requestPackageChange = useCallback(
    (packageId: string) => {
      if (packageId === option.packageId) return;
      const hasSelections =
        option.menuSelection.courses.length > 0 ||
        option.menuSelection.drinks.length > 0;
      if (hasSelections && option.packageId) {
        setPendingPackageId(packageId);
        return;
      }
      applyPackageChange(packageId);
    },
    [option.packageId, option.menuSelection, applyPackageChange],
  );

  // Gäste-Stepper im Header
  const handleGuestCountChange = useCallback(
    (delta: number) => {
      const next = Math.max(1, option.guestCount + delta);
      const minGuests = selectedPackage?.min_guests ?? 1;
      if (next < minGuests) {
        toast.warning(
          `Dieses Paket erfordert mindestens ${minGuests} Gäste.`,
        );
        return;
      }
      onUpdateOption({ guestCount: next });
    },
    [option.guestCount, selectedPackage, onUpdateOption],
  );

  // Handle finish → flush save, then back to overview
  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      if (onFlushSave) await onFlushSave();
    } catch (e) {
      console.error("flushSave failed", e);
    } finally {
      setIsFinishing(false);
      onBack();
    }
  }, [onFlushSave, onBack]);

  const handleFinishAndCompose = useCallback(async () => {
    setIsFinishing(true);
    try {
      if (onFlushSave) await onFlushSave();
      onBack();
      if (onGenerateEmail) await onGenerateEmail();
    } catch (e) {
      console.error("finish+compose failed", e);
    } finally {
      setIsFinishing(false);
    }
  }, [onFlushSave, onBack, onGenerateEmail]);

  // Welche Pflicht-Gänge fehlen noch?
  const missingRequiredCourses = useMemo(() => {
    if (courseConfigs.length === 0) return [];
    return courseConfigs
      .filter((c) => c.is_required)
      .filter((config) => {
        const sels = adaptedMenuSelection.courses.filter(
          (c) => c.courseType === config.course_type,
        );
        return !sels.some((s) => s.itemId || s.isCustom);
      });
  }, [courseConfigs, adaptedMenuSelection.courses]);

  // Next step label for LiveCalculation
  const getNextStepInfo = (): {
    label: string;
    disabled: boolean;
    action: () => void;
  } => {
    switch (activeStep) {
      case 1:
        return {
          label: "Weiter zu Gänge",
          disabled: !option.packageId,
          action: () => setActiveStep(2),
        };
      case 2:
        return {
          label: "Weiter zu Getränke",
          disabled: !coursesComplete,
          action: () => setActiveStep(3),
        };
      case 3:
        return {
          label: "Zur Zusammenfassung",
          disabled: !drinksComplete,
          action: () => setActiveStep(4),
        };
      case 4:
        return {
          label: "Fertig",
          disabled: false,
          action: handleFinish,
        };
    }
  };

  const nextStepInfo = getNextStepInfo();

  // Step definitions
  const steps = [
    {
      step: 1 as WizardStep,
      label: "Paket editieren",
      icon: PackageIcon,
      isComplete: !!option.packageId,
    },
    {
      step: 2 as WizardStep,
      label: "Gänge (Pflicht)",
      icon: UtensilsCrossed,
      isComplete: coursesComplete,
    },
    {
      step: 3 as WizardStep,
      label: "Getränke",
      icon: Wine,
      isComplete: drinksComplete,
    },
    {
      step: 4 as WizardStep,
      label: "Zusammenfassung",
      icon: FileText,
      isComplete: false,
    },
  ];

  const currentCourseConfig = courseConfigs[activeCourseIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 rounded-xl shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground">
            Option {option.optionLabel} konfigurieren
          </h3>
          <p className="text-sm text-muted-foreground">
            {selectedPackage?.name || "Paket wählen"} &middot;{" "}
            {option.guestCount} Gäste
          </p>
        </div>
        {/* Gäste-Stepper im Wizard-Header (P1 #1) */}
        <div className="flex items-center gap-2 shrink-0">
          {isLocked && (
            <Badge variant="outline" className="gap-1.5 h-9 px-3">
              <Lock className="h-3.5 w-3.5" />
              Gesperrt
            </Badge>
          )}
          <div
            className={cn(
              "flex items-center gap-1 rounded-xl border border-border bg-background p-1",
              isLocked && "opacity-50 pointer-events-none",
            )}
            aria-label="Gäste-Anzahl"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleGuestCountChange(-1)}
              disabled={isLocked || option.guestCount <= 1}
              aria-label="Gäste verringern"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums">
              {option.guestCount} <span className="text-xs text-muted-foreground font-normal">Gäste</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleGuestCountChange(1)}
              disabled={isLocked}
              aria-label="Gäste erhöhen"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Min-Guests-Warnung (P1 #3) */}
      {selectedPackage?.min_guests &&
        option.guestCount < selectedPackage.min_guests && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                Mindestanzahl unterschritten
              </p>
              <p className="text-muted-foreground">
                Dieses Paket erfordert mindestens{" "}
                <strong>{selectedPackage.min_guests} Gäste</strong> — aktuell sind{" "}
                {option.guestCount} eingestellt.
              </p>
            </div>
          </div>
        )}

      {/* Stepper */}
      <div className="flex gap-1 p-1 bg-muted rounded-full">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = activeStep === s.step;
          // P0 #9: Step 3 erfordert nun coursesComplete (war vorher nur packageId)
          const isClickable =
            s.step === 1 ||
            (s.step === 2 && !!option.packageId) ||
            (s.step === 3 && !!option.packageId && coursesComplete) ||
            (s.step === 4 && coursesComplete && drinksComplete);

          return (
            <button
              key={s.step}
              onClick={() => isClickable && setActiveStep(s.step)}
              disabled={!isClickable}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-full text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm"
                  : isClickable
                    ? "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    : "text-muted-foreground/40 cursor-not-allowed"
              )}
              title={
                !isClickable && s.step === 3
                  ? "Bitte zuerst alle Pflicht-Gänge wählen"
                  : !isClickable && s.step === 4
                    ? "Bitte zuerst Gänge & Getränke vervollständigen"
                    : undefined
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.label}</span>
              {s.isComplete && !isActive && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {isDataLoading && activeStep !== 1 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Menü-Konfiguration wird geladen...</p>
          </div>
        </div>
      )}

      {/* Split Layout: Content + LiveCalculation */}
      {(!isDataLoading || activeStep === 1) && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content — 8 columns */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {/* Step 1: Package Selection */}
            {activeStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h4 className="text-base font-semibold text-foreground">
                  Paket auswählen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {packages.map((pkg) => {
                    const isSelected = option.packageId === pkg.id;
                    return (
                      <motion.div
                        key={pkg.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          !isLocked && requestPackageChange(pkg.id)
                        }
                        className={cn(
                          "p-4 rounded-xl border-2 cursor-pointer transition-all",
                          "hover:border-primary/50 hover:shadow-sm",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border",
                          isLocked && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-foreground">
                              {pkg.name}
                            </h5>
                            {pkg.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {pkg.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {pkg.price}€{" "}
                                {pkg.price_per_person ? "p.P." : "pauschal"}
                              </Badge>
                              {pkg.min_guests && (
                                <Badge variant="outline" className="text-xs">
                                  ab {pkg.min_guests} Gäste
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0"
                            >
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {option.packageId && (
                  <div className="flex justify-start pt-2">
                    <Button
                      onClick={() => setActiveStep(2)}
                      className="px-6 h-11 rounded-xl gap-2 bg-primary"
                    >
                      Weiter zu Gänge
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Course Selection */}
            {activeStep === 2 && (
              <motion.div
                key={`step-2-${activeCourseIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h4 className="text-base font-semibold text-foreground">
                  Gänge-Auswahl
                </h4>

                {/* P1 #5/#6: Banner mit fehlenden Pflicht-Gängen */}
                {!coursesComplete && missingRequiredCourses.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        Noch fehlende Pflicht-Gänge
                      </p>
                      <p className="text-muted-foreground">
                        {missingRequiredCourses
                          .map((c) => c.course_label)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Course Progress Navigation */}
                {courseConfigs.length > 0 && (
                  <CourseProgress
                    courseConfigs={courseConfigs}
                    courseSelections={adaptedMenuSelection.courses}
                    activeCourseIndex={activeCourseIndex}
                    onCourseClick={setActiveCourseIndex}
                  />
                )}

                {/* Active Course Selector */}
                {currentCourseConfig && (
                  <CourseSelector
                    courseConfig={currentCourseConfig}
                    currentSelections={getCourseSelections(
                      currentCourseConfig.course_type
                    )}
                    menuItems={menuItems}
                    allMenuItems={menuItems}
                    onSelect={handleCourseSelect}
                    onNext={handleNextCourse}
                    isLastCourse={
                      activeCourseIndex === courseConfigs.length - 1
                    }
                  />
                )}

                {courseConfigs.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>
                        Keine Gang-Konfiguration für dieses Paket vorhanden
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Next Step Button */}
                {coursesComplete && (
                  <div className="flex justify-start pt-2">
                    <Button
                      onClick={() => setActiveStep(3)}
                      className="px-6 h-11 rounded-xl gap-2 bg-primary"
                    >
                      Weiter zu Getränke
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Drink Selection */}
            {activeStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h4 className="text-base font-semibold text-foreground">
                  Getränke-Auswahl
                </h4>

                {drinkConfigs.length > 0 ? (
                  <DrinkPackageSelector
                    drinkConfigs={drinkConfigs}
                    drinkSelections={adaptedMenuSelection.drinks}
                    onSelect={handleDrinkSelect}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Wine className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>Keine Getränke-Konfiguration für dieses Paket</p>
                    </CardContent>
                  </Card>
                )}

                {drinksComplete && (
                  <div className="flex justify-start pt-2">
                    <Button
                      onClick={() => setActiveStep(4)}
                      className="px-6 h-11 rounded-xl gap-2 bg-primary"
                    >
                      Zur Zusammenfassung
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Summary */}
            {activeStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <h4 className="text-base font-semibold text-foreground">
                  Zusammenfassung — Option {option.optionLabel}
                </h4>

                {/* Package */}
                {selectedPackage && (
                  <SummarySection
                    icon={<PackageIcon className="h-4 w-4" />}
                    title="Paket"
                    onEdit={() => setActiveStep(1)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {selectedPackage.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {option.guestCount} Gäste
                        </p>
                      </div>
                      <span className="text-lg font-semibold text-foreground">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(option.totalAmount)}
                      </span>
                    </div>
                  </SummarySection>
                )}

                {/* Courses Summary */}
                {option.menuSelection.courses.filter(
                  (c) => c.itemId || c.itemName
                ).length > 0 && (
                  <SummarySection
                    icon={<UtensilsCrossed className="h-4 w-4" />}
                    title="Gänge"
                    onEdit={() => {
                      setActiveCourseIndex(0);
                      setActiveStep(2);
                    }}
                  >
                    <div className="space-y-2">
                      {option.menuSelection.courses
                        .filter((c) => c.itemId || c.itemName)
                        .map((course, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 text-sm"
                          >
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs text-muted-foreground">
                                {course.courseLabel}
                              </span>
                              <p className="text-foreground font-medium">
                                {course.itemName}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </SummarySection>
                )}

                {/* Drinks Summary */}
                {option.menuSelection.drinks.filter(
                  (d) => d.selectedChoice || d.customDrink
                ).length > 0 && (
                  <SummarySection
                    icon={<Wine className="h-4 w-4" />}
                    title="Getränke"
                    onEdit={() => setActiveStep(3)}
                  >
                    <div className="flex flex-wrap gap-2">
                      {option.menuSelection.drinks
                        .filter((d) => d.selectedChoice || d.customDrink)
                        .map((drink, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/30"
                          >
                            <Check className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">
                              {drink.drinkLabel}:
                            </span>
                            <span className="text-sm text-foreground">
                              {drink.customDrink || drink.selectedChoice}
                            </span>
                          </div>
                        ))}
                    </div>
                  </SummarySection>
                )}

                {/* Finish Buttons (P1 #14): primäre CTA = Anschreiben generieren */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <motion.button
                    onClick={handleFinishAndCompose}
                    disabled={isFinishing || isGeneratingEmail || isLocked}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "h-12 px-6 rounded-xl font-semibold text-sm flex items-center gap-2",
                      "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
                      "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                      "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                      "transition-shadow duration-300",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
                    )}
                  >
                    {isFinishing || isGeneratingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Speichern & Anschreiben generieren
                  </motion.button>
                  <Button
                    variant="outline"
                    onClick={handleFinish}
                    disabled={isFinishing}
                    className="h-12 px-5 rounded-xl gap-2"
                  >
                    {isFinishing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Nur speichern
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* LiveCalculation Sidebar — 4 columns */}
        <div className="lg:col-span-4 hidden lg:block">
          <LiveCalculation
            option={option}
            selectedPackage={selectedPackage}
            onNextStep={nextStepInfo.action}
            nextStepLabel={nextStepInfo.label}
            isNextDisabled={nextStepInfo.disabled}
          />
        </div>
      </div>
      )}

      {/* Mobile Sticky Footer — lg:hidden */}
      {(!isDataLoading || activeStep === 1) && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {selectedPackage ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-lg tracking-tight">
                    {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(option.totalAmount)}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {option.guestCount}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Paket wählen</span>
              )}
            </div>
            <Button
              onClick={nextStepInfo.action}
              disabled={nextStepInfo.disabled}
              className="shrink-0 h-11 px-5 rounded-xl gap-2 font-semibold"
            >
              {nextStepInfo.label}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm-Dialog vor Paketwechsel (P0 #2) */}
      <AlertDialog
        open={!!pendingPackageId}
        onOpenChange={(open) => !open && setPendingPackageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Paket wechseln?</AlertDialogTitle>
            <AlertDialogDescription>
              Beim Wechsel des Pakets werden alle bereits ausgewählten Gänge
              und Getränke entfernt. Möchtest du wirklich fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPackageId) applyPackageChange(pendingPackageId);
                setPendingPackageId(null);
              }}
            >
              Paket wechseln
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Summary Section Sub-Component ---

interface SummarySectionProps {
  icon: React.ReactNode;
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}

function SummarySection({
  icon,
  title,
  onEdit,
  children,
}: SummarySectionProps) {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Bearbeiten
          </Button>
        )}
      </div>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
