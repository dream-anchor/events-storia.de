import { useState, useMemo } from "react";
import { UtensilsCrossed, Wine, FileText, Check, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CourseConfig, DrinkConfig, MenuSelection, CourseType } from "./types";
import { CourseProgress } from "./CourseProgress";
import { CourseSelector } from "./CourseSelector";
import { DrinkPackageSelector } from "./DrinkPackageSelector";
import { FinalizePanel } from "./FinalizePanel";
import { MenuItem } from "./types";

export type WorkflowStep = 'courses' | 'drinks' | 'finalize';

interface MenuWorkflowProps {
  packageId: string | null;
  packageName: string | null;
  guestCount: number;
  courseConfigs: CourseConfig[];
  drinkConfigs: DrinkConfig[];
  menuItems: MenuItem[];
  menuSelection: MenuSelection;
  onMenuSelectionChange: (selection: MenuSelection) => void;
  // For finalize panel
  inquiry?: any;
  emailDraft?: string;
  onEmailDraftChange?: (draft: string) => void;
  onSendOffer?: () => void;
  isSending?: boolean;
  templates?: any[];
}

export const MenuWorkflow = ({
  packageId,
  packageName,
  guestCount,
  courseConfigs,
  drinkConfigs,
  menuItems,
  menuSelection,
  onMenuSelectionChange,
  inquiry,
  emailDraft = "",
  onEmailDraftChange,
  onSendOffer,
  isSending = false,
  templates = [],
}: MenuWorkflowProps) => {
  const [activeStep, setActiveStep] = useState<WorkflowStep>('courses');
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);

  // Calculate completion status
  const coursesComplete = useMemo(() => {
    if (courseConfigs.length === 0) return true;
    const requiredCourses = courseConfigs.filter(c => c.is_required);
    return requiredCourses.every(config => {
      const selection = menuSelection.courses.find(c => c.courseType === config.course_type);
      return selection && (selection.itemId || selection.isCustom);
    });
  }, [courseConfigs, menuSelection.courses]);

  const drinksComplete = useMemo(() => {
    const requiredDrinkChoices = drinkConfigs.filter(c => c.is_choice);
    if (requiredDrinkChoices.length === 0) return true;
    return requiredDrinkChoices.every(config => {
      const selection = menuSelection.drinks.find(d => d.drinkGroup === config.drink_group);
      return selection?.selectedChoice || selection?.customDrink;
    });
  }, [drinkConfigs, menuSelection.drinks]);

  // Get current course config
  const currentCourseConfig = courseConfigs[activeCourseIndex];

  // Course selection helper
  const getCourseSelection = (courseType: CourseType) => {
    return menuSelection.courses.find(c => c.courseType === courseType) || null;
  };

  // Handle course selection
  const handleCourseSelect = (selection: any) => {
    const newCourses = [...menuSelection.courses];
    const existingIndex = newCourses.findIndex(c => c.courseType === selection.courseType);
    
    if (existingIndex >= 0) {
      newCourses[existingIndex] = selection;
    } else {
      newCourses.push(selection);
    }

    onMenuSelectionChange({
      ...menuSelection,
      courses: newCourses,
    });
  };

  // Handle drink selection
  const handleDrinkSelect = (selection: any) => {
    const newDrinks = [...menuSelection.drinks];
    const existingIndex = newDrinks.findIndex(d => d.drinkGroup === selection.drinkGroup);
    
    if (existingIndex >= 0) {
      newDrinks[existingIndex] = selection;
    } else {
      newDrinks.push(selection);
    }

    onMenuSelectionChange({
      ...menuSelection,
      drinks: newDrinks,
    });
  };

  // Navigate to next course
  const handleNextCourse = () => {
    if (activeCourseIndex < courseConfigs.length - 1) {
      setActiveCourseIndex(activeCourseIndex + 1);
    } else {
      // Move to drinks step
      setActiveStep('drinks');
    }
  };

  const steps = [
    {
      id: 'courses' as WorkflowStep,
      label: 'Gänge',
      icon: UtensilsCrossed,
      isComplete: coursesComplete,
      isAvailable: true,
    },
    {
      id: 'drinks' as WorkflowStep,
      label: 'Getränke',
      icon: Wine,
      isComplete: drinksComplete,
      isAvailable: true,
    },
    {
      id: 'finalize' as WorkflowStep,
      label: 'Angebot',
      icon: FileText,
      isComplete: false,
      isAvailable: coursesComplete && drinksComplete,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Pill Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-full">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const isClickable = step.isAvailable || steps.slice(0, idx).every(s => s.isComplete);

          return (
            <button
              key={step.id}
              onClick={() => isClickable && setActiveStep(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all",
                isActive
                  ? "bg-background shadow-sm text-foreground"
                  : isClickable
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.label}</span>
              {step.isComplete && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Step Content with AnimatePresence for smooth transitions */}
      <AnimatePresence mode="wait">
        {activeStep === 'courses' && (
          <motion.div
            key={`course-step-${activeCourseIndex}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Course Progress Navigation */}
            {courseConfigs.length > 0 && (
              <CourseProgress
                courseConfigs={courseConfigs}
                courseSelections={menuSelection.courses}
                activeCourseIndex={activeCourseIndex}
                onCourseClick={setActiveCourseIndex}
              />
            )}

            {/* Active Course Selector */}
            {currentCourseConfig && (
              <CourseSelector
                courseConfig={currentCourseConfig}
                currentSelection={getCourseSelection(currentCourseConfig.course_type)}
                menuItems={menuItems}
                allMenuItems={menuItems}
                onSelect={handleCourseSelect}
                onNext={handleNextCourse}
                isLastCourse={activeCourseIndex === courseConfigs.length - 1}
              />
            )}

            {/* Next Step Button */}
            {coursesComplete && (
              <div className="flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveStep('drinks')}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-colors min-h-[48px]"
                >
                  Weiter zu Getränke
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {activeStep === 'drinks' && (
          <motion.div
            key="drinks-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Drink Package Selector */}
            {drinkConfigs.length > 0 ? (
              <DrinkPackageSelector
                drinkConfigs={drinkConfigs}
                drinkSelections={menuSelection.drinks}
                onSelect={handleDrinkSelect}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wine className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Keine Getränke-Konfiguration für dieses Paket</p>
              </div>
            )}

            {/* Next Step Button */}
            {drinksComplete && (
              <div className="flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveStep('finalize')}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-colors min-h-[48px]"
                >
                  Weiter zum Angebot
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {activeStep === 'finalize' && (
          <motion.div
            key="finalize-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <FinalizePanel
              inquiry={inquiry}
              packageName={packageName}
              guestCount={guestCount}
              menuSelection={menuSelection}
              emailDraft={emailDraft}
              onEmailDraftChange={onEmailDraftChange}
              onSendOffer={onSendOffer}
              isSending={isSending}
              templates={templates}
              // Navigation-based editing props
              courseConfigs={courseConfigs}
              drinkConfigs={drinkConfigs}
              onNavigateToCourse={(courseIndex) => {
                setActiveCourseIndex(courseIndex);
                setActiveStep('courses');
              }}
              onNavigateToDrinks={() => {
                setActiveStep('drinks');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};