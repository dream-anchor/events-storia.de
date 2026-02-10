import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ChefHat, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePackageMenuConfig } from "./usePackageMenuConfig";
import { MenuWorkflow } from "./MenuWorkflow";
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
  // New props for integrated workflow
  inquiry?: any;
  emailDraft?: string;
  onEmailDraftChange?: (draft: string) => void;
  onSendOffer?: () => void;
  isSending?: boolean;
  templates?: any[];
}

export const MenuComposer = ({
  packageId,
  packageName,
  guestCount,
  menuSelection,
  onMenuSelectionChange,
  inquiry,
  emailDraft = "",
  onEmailDraftChange,
  onSendOffer,
  isSending = false,
  templates = [],
}: MenuComposerProps) => {
  const { courseConfigs, drinkConfigs, isLoading, error } = usePackageMenuConfig(packageId);
  const { items: allMenuItems, isLoading: itemsLoading } = useCombinedMenuItems();

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

  // Calculate progress — uses .filter().some() to support multi-select
  const progress = useMemo(() => {
    if (courseConfigs.length === 0) return 0;

    const requiredCourses = courseConfigs.filter(c => c.is_required);
    const completedCourses = requiredCourses.filter(config => {
      const selections = menuSelection.courses.filter(c => c.courseType === config.course_type);
      return selections.some(s => s.itemId || s.isCustom);
    });

    const courseProgress = requiredCourses.length > 0
      ? (completedCourses.length / requiredCourses.length) * 50
      : 50;

    const requiredDrinkChoices = drinkConfigs.filter(c => c.is_choice);
    const completedDrinks = requiredDrinkChoices.filter(config => {
      const selection = menuSelection.drinks.find(d => d.drinkGroup === config.drink_group);
      return selection?.selectedChoice || selection?.customDrink;
    });

    const drinkProgress = requiredDrinkChoices.length > 0
      ? (completedDrinks.length / requiredDrinkChoices.length) * 50
      : 50;

    return Math.round(courseProgress + drinkProgress);
  }, [courseConfigs, drinkConfigs, menuSelection]);

  // Check if all required selections are made
  const isComplete = useMemo(() => {
    const requiredCourses = courseConfigs.filter(c => c.is_required);
    const allCoursesSelected = requiredCourses.every(config => {
      const selections = menuSelection.courses.filter(c => c.courseType === config.course_type);
      return selections.some(s => s.itemId || s.isCustom);
    });

    const requiredDrinkChoices = drinkConfigs.filter(c => c.is_choice);
    const allDrinksSelected = requiredDrinkChoices.every(config => {
      const selection = menuSelection.drinks.find(d => d.drinkGroup === config.drink_group);
      return selection?.selectedChoice || selection?.customDrink;
    });

    return allCoursesSelected && allDrinksSelected;
  }, [courseConfigs, drinkConfigs, menuSelection]);

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

      {/* Menu Workflow - 3-Step Process */}
      <MenuWorkflow
        packageId={packageId}
        packageName={packageName}
        guestCount={guestCount}
        courseConfigs={courseConfigs}
        drinkConfigs={drinkConfigs}
        menuItems={menuItems}
        menuSelection={menuSelection}
        onMenuSelectionChange={onMenuSelectionChange}
        inquiry={inquiry}
        emailDraft={emailDraft}
        onEmailDraftChange={onEmailDraftChange}
        onSendOffer={onSendOffer}
        isSending={isSending}
        templates={templates}
      />
    </div>
  );
};

export * from './types';
