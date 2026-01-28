import { useState } from "react";
import { Check, Wine, Beer, Coffee, Droplets, GlassWater, Plus, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DrinkConfig, DrinkSelection, DrinkOption, DRINK_ICONS } from "./types";
import { GlobalItemSearch } from "./GlobalItemSearch";
import { CustomItemInput } from "./CustomItemInput";
import { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface DrinkPackageSelectorProps {
  drinkConfigs: DrinkConfig[];
  drinkSelections: DrinkSelection[];
  onSelect: (selection: DrinkSelection) => void;
}

const DrinkIcon = ({ group }: { group: string }) => {
  switch (group) {
    case 'aperitif':
      return <Wine className="h-5 w-5" />;
    case 'main_drink':
      return <Wine className="h-5 w-5" />;
    case 'water':
      return <GlassWater className="h-5 w-5" />;
    case 'coffee':
      return <Coffee className="h-5 w-5" />;
    default:
      return <Droplets className="h-5 w-5" />;
  }
};

export const DrinkPackageSelector = ({
  drinkConfigs,
  drinkSelections,
  onSelect,
}: DrinkPackageSelectorProps) => {
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [activeGroupForCustom, setActiveGroupForCustom] = useState<string | null>(null);

  const getSelection = (drinkGroup: string) => 
    drinkSelections.find(s => s.drinkGroup === drinkGroup);

  const handleChoiceSelect = (config: DrinkConfig, choice: string) => {
    onSelect({
      drinkGroup: config.drink_group,
      drinkLabel: config.drink_label,
      selectedChoice: choice,
      quantityLabel: config.quantity_label,
      customDrink: null,
    });
  };

  const handleGlobalDrinkSelect = (item: CombinedMenuItem) => {
    if (activeGroupForCustom) {
      const config = drinkConfigs.find(c => c.drink_group === activeGroupForCustom);
      if (config) {
        onSelect({
          drinkGroup: config.drink_group,
          drinkLabel: config.drink_label,
          selectedChoice: null,
          quantityLabel: config.quantity_label,
          customDrink: item.name,
        });
      }
    }
    setActiveGroupForCustom(null);
  };

  const handleCustomDrink = (item: { name: string; description: string | null }) => {
    if (activeGroupForCustom) {
      const config = drinkConfigs.find(c => c.drink_group === activeGroupForCustom);
      if (config) {
        onSelect({
          drinkGroup: config.drink_group,
          drinkLabel: config.drink_label,
          selectedChoice: null,
          quantityLabel: config.quantity_label,
          customDrink: item.name,
        });
      }
    }
    setActiveGroupForCustom(null);
  };

  const openGlobalSearch = (drinkGroup: string) => {
    setActiveGroupForCustom(drinkGroup);
    setShowGlobalSearch(true);
  };

  const openCustomInput = (drinkGroup: string) => {
    setActiveGroupForCustom(drinkGroup);
    setShowCustomInput(true);
  };

  // Separate choice configs from included configs
  const choiceConfigs = drinkConfigs.filter(c => c.is_choice);
  const includedConfigs = drinkConfigs.filter(c => !c.is_choice && c.is_included);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-xl">🍷</span>
          Getränke-Pauschale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Choice Options (either/or) */}
        {choiceConfigs.map(config => {
          const currentSelection = getSelection(config.drink_group);
          const options = config.options as DrinkOption[];
          const hasCustomDrink = currentSelection?.customDrink;

          return (
            <div key={config.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DrinkIcon group={config.drink_group} />
                  <h4 className="font-medium">{config.drink_label}</h4>
                  <Badge variant="outline" className="text-xs">Auswählen</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openGlobalSearch(config.drink_group)}
                  className="text-xs"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Anderes Getränk
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options.map((option, idx) => {
                  const choiceLabel = typeof option === 'string' 
                    ? option 
                    : option.label;
                  const choiceQuantity = typeof option === 'object' 
                    ? option.quantity 
                    : null;
                  const isSelected = currentSelection?.selectedChoice === choiceLabel && !hasCustomDrink;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleChoiceSelect(config, choiceLabel)}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all",
                        "hover:border-primary/50 hover:shadow-sm",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-semibold">{choiceLabel}</h5>
                          {choiceQuantity && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {choiceQuantity} pro Person
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Custom Drink Selection Display */}
                {hasCustomDrink && (
                  <div
                    className="p-4 rounded-xl border-2 border-primary bg-primary/5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-semibold">{currentSelection.customDrink}</h5>
                        <p className="text-sm text-muted-foreground mt-1">
                          Individuell gewählt
                        </p>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Freie Auswahl
                    </Badge>
                  </div>
                )}
              </div>

              {/* Add Custom Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => openCustomInput(config.drink_group)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Freies Getränk hinzufügen
              </Button>
            </div>
          );
        })}

        {/* Included Items (always part of package) */}
        {includedConfigs.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Inklusive</h4>
            <div className="flex flex-wrap gap-2">
              {includedConfigs.map(config => (
                <div
                  key={config.id}
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200"
                >
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {config.drink_label}
                  </span>
                  {config.quantity_label && (
                    <span className="text-xs text-green-600">
                      ({config.quantity_label})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {drinkConfigs.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            Keine Getränke-Konfiguration für dieses Paket
          </p>
        )}
      </CardContent>

      {/* Global Drink Search */}
      <GlobalItemSearch
        open={showGlobalSearch}
        onOpenChange={(open) => {
          setShowGlobalSearch(open);
          if (!open) setActiveGroupForCustom(null);
        }}
        onSelect={handleGlobalDrinkSelect}
        onCustomItem={() => {
          setShowGlobalSearch(false);
          setShowCustomInput(true);
        }}
        filterType="drinks"
        placeholder="Getränke durchsuchen..."
      />

      {/* Custom Drink Input */}
      <CustomItemInput
        open={showCustomInput}
        onOpenChange={(open) => {
          setShowCustomInput(open);
          if (!open) setActiveGroupForCustom(null);
        }}
        onSubmit={handleCustomDrink}
        title="Getränk hinzufügen"
        description="Füge ein Getränk hinzu, das nicht in der Auswahl steht."
        nameLabel="Getränk"
        namePlaceholder="z.B. Champagner Moët"
        descriptionLabel="Notiz (optional)"
        descriptionPlaceholder="z.B. 0,75l pro 4 Personen"
      />
    </Card>
  );
};
