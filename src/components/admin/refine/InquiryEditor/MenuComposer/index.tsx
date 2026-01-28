import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ChefHat, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePackageMenuConfig } from "./usePackageMenuConfig";
import { CourseProgress } from "./CourseProgress";
import { CourseSelector } from "./CourseSelector";
import { DrinkPackageSelector } from "./DrinkPackageSelector";
import { 
  MenuSelection, 
  CourseSelection, 
  DrinkSelection, 
  MenuItem,
  CourseType 
} from "./types";
import { useCombinedMenuItems } from "@/hooks/useCombinedMenuItems";

interface MenuComposerProps {
  packageId: string | null;
  packageName: string | null;
  guestCount: number;
  menuSelection: MenuSelection;
  onMenuSelectionChange: (selection: MenuSelection) => void;
}

export const MenuComposer = ({
  packageId,
  packageName,
  guestCount,
  menuSelection,
  onMenuSelectionChange,
}: MenuComposerProps) => {
  const { courseConfigs, drinkConfigs, isLoading, error } = usePackageMenuConfig(packageId);
  const { items: allMenuItems, isLoading: itemsLoading } = useCombinedMenuItems();
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);

  // Transform menu items to our format
  const menuItems: MenuItem[] = useMemo(() => {
    return allMenuItems.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category_name: item.category_name || 'Unbekannt',
      source: (item.source === 'ristorante' ? 'ristorante' : 'catering') as 'catering' | 'ristorante',
    }));
  }, [allMenuItems]);

  // Get course selection for a course type
  const getCourseSelection = useCallback((courseType: CourseType): CourseSelection | null => {
    return menuSelection.courses.find(c => c.courseType === courseType) || null;
  }, [menuSelection.courses]);

  // Handle course selection
  const handleCourseSelect = useCallback((selection: CourseSelection) => {
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
  }, [menuSelection, onMenuSelectionChange]);

  // Handle drink selection
  const handleDrinkSelect = useCallback((selection: DrinkSelection) => {
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
  }, [menuSelection, onMenuSelectionChange]);

  // Navigate to next course
  const handleNextCourse = useCallback(() => {
    if (activeCourseIndex < courseConfigs.length - 1) {
      setActiveCourseIndex(activeCourseIndex + 1);
    }
  }, [activeCourseIndex, courseConfigs.length]);

  // Calculate progress
  const progress = useMemo(() => {
    if (courseConfigs.length === 0) return 0;
    
    const requiredCourses = courseConfigs.filter(c => c.is_required);
    const completedCourses = requiredCourses.filter(config => {
      const selection = getCourseSelection(config.course_type);
      return selection && (selection.itemId || selection.isCustom);
    });
    
    return Math.round((completedCourses.length / requiredCourses.length) * 100);
  }, [courseConfigs, getCourseSelection]);

  // Check if all required selections are made
  const isComplete = useMemo(() => {
    const requiredCourses = courseConfigs.filter(c => c.is_required);
    const allCoursesSelected = requiredCourses.every(config => {
      const selection = getCourseSelection(config.course_type);
      return selection && (selection.itemId || selection.isCustom);
    });

    const requiredDrinkChoices = drinkConfigs.filter(c => c.is_choice);
    const allDrinksSelected = requiredDrinkChoices.every(config => {
      const selection = menuSelection.drinks.find(d => d.drinkGroup === config.drink_group);
      return selection?.selectedChoice;
    });

    return allCoursesSelected && allDrinksSelected;
  }, [courseConfigs, drinkConfigs, getCourseSelection, menuSelection.drinks]);

  // Reset when package changes
  useEffect(() => {
    setActiveCourseIndex(0);
  }, [packageId]);

  if (!packageId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <ChefHat className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Bitte zuerst ein Paket auswählen</p>
            <p className="text-xs mt-1">Die Menü-Zusammenstellung richtet sich nach dem gewählten Paket</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || itemsLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lade Menü-Konfiguration...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (courseConfigs.length === 0 && drinkConfigs.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Keine Menü-Konfiguration für dieses Paket vorhanden. 
          Bitte die Paket-Einstellungen überprüfen.
        </AlertDescription>
      </Alert>
    );
  }

  const currentCourseConfig = courseConfigs[activeCourseIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Menü-Zusammenstellung
              </CardTitle>
              <CardDescription>
                {packageName} • {guestCount} Gäste
              </CardDescription>
            </div>
            {isComplete ? (
              <Badge className="bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Vollständig
              </Badge>
            ) : (
              <Badge variant="outline">
                {progress}% abgeschlossen
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

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
          onSelect={handleCourseSelect}
          onNext={handleNextCourse}
        />
      )}

      {/* Drink Package Selector */}
      {drinkConfigs.length > 0 && (
        <DrinkPackageSelector
          drinkConfigs={drinkConfigs}
          drinkSelections={menuSelection.drinks}
          onSelect={handleDrinkSelect}
        />
      )}

      {/* Summary when complete */}
      {isComplete && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Menü vollständig konfiguriert</p>
                <p className="text-sm text-green-600">
                  Alle Gänge und Getränke wurden ausgewählt. 
                  Sie können jetzt mit der Kommunikation fortfahren.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export * from './types';
