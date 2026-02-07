import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

export function WizardConfigurator({
  option,
  packages,
  inquiry,
  onUpdateOption,
  onBack,
}: WizardConfiguratorProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>(
    option.packageId ? 2 : 1
  );
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);

  const selectedPackage = packages.find((p) => p.id === option.packageId);

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

  // Completion checks
  const coursesComplete = useMemo(() => {
    if (courseConfigs.length === 0) return true;
    const required = courseConfigs.filter((c) => c.is_required);
    return required.every((config) => {
      const sel = adaptedMenuSelection.courses.find(
        (c) => c.courseType === config.course_type
      );
      return sel && (sel.itemId || sel.isCustom);
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

  // Course selection helper
  const getCourseSelection = (courseType: CourseType) => {
    return (
      adaptedMenuSelection.courses.find((c) => c.courseType === courseType) ||
      null
    );
  };

  // Handle course selection
  const handleCourseSelect = useCallback(
    (selection: CourseSelection) => {
      const newCourses = [...option.menuSelection.courses];
      const existingIndex = newCourses.findIndex(
        (c) => c.courseType === selection.courseType
      );

      const adapted = {
        ...selection,
        courseType: selection.courseType as string,
        itemSource: selection.itemSource as string,
      };

      if (existingIndex >= 0) {
        newCourses[existingIndex] = adapted;
      } else {
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

  // Handle package change
  const handlePackageChange = (packageId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (pkg) {
      const newTotal = calculateEventPackagePrice(
        pkg.id,
        pkg.price,
        option.guestCount,
        !!pkg.price_per_person
      );
      onUpdateOption({
        packageId,
        packageName: pkg.name,
        totalAmount: newTotal,
        menuSelection: { courses: [], drinks: [] },
      });
      setActiveCourseIndex(0);
    }
  };

  // Handle finish → back to overview
  const handleFinish = () => {
    onBack();
  };

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
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Option {option.optionLabel} konfigurieren
          </h3>
          <p className="text-sm text-muted-foreground">
            {selectedPackage?.name || "Paket wählen"} &middot;{" "}
            {option.guestCount} Gäste
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex gap-1 p-1 bg-muted rounded-full">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = activeStep === s.step;
          const isClickable =
            s.step === 1 ||
            (s.step === 2 && !!option.packageId) ||
            (s.step === 3 && !!option.packageId) ||
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
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{s.label}</span>
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
                        onClick={() => handlePackageChange(pkg.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 cursor-pointer transition-all",
                          "hover:border-primary/50 hover:shadow-sm",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border"
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
                    currentSelection={getCourseSelection(
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

                {/* Finish Button */}
                <div className="flex justify-start pt-2">
                  <motion.button
                    onClick={handleFinish}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "h-12 px-8 rounded-xl font-semibold text-sm flex items-center gap-2",
                      "bg-gradient-to-r from-amber-500 to-amber-600",
                      "text-white",
                      "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                      "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                      "transition-shadow duration-300"
                    )}
                  >
                    <Check className="h-4 w-4" />
                    Fertig — zurück zur Übersicht
                  </motion.button>
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
