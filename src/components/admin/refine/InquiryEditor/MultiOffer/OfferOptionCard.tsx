import { useState, useMemo } from "react";
import { Package, Check, X, Edit2, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { OfferOption } from "./types";
import { Package as PackageType } from "../types";
import { MenuComposer } from "../MenuComposer";
import type { MenuSelection } from "../MenuComposer/types";

interface OfferOptionCardProps {
  option: OfferOption;
  packages: PackageType[];
  onUpdate: (updates: Partial<OfferOption>) => void;
  onRemove: () => void;
  onToggleActive: () => void;
  isGeneratingPaymentLink?: boolean;
}

export function OfferOptionCard({
  option,
  packages,
  onUpdate,
  onRemove,
  onToggleActive,
  isGeneratingPaymentLink,
}: OfferOptionCardProps) {
  const [showMenuEditor, setShowMenuEditor] = useState(false);

  const selectedPackage = packages.find(p => p.id === option.packageId);

  // Adapt MenuSelectionType to MenuSelection (string -> typed enums)
  // The types are structurally compatible but TypeScript needs explicit casting
  const adaptedMenuSelection: MenuSelection = useMemo(() => ({
    courses: option.menuSelection.courses.map(c => ({
      ...c,
      courseType: c.courseType as MenuSelection['courses'][0]['courseType'],
      itemSource: c.itemSource as MenuSelection['courses'][0]['itemSource'],
    })),
    drinks: option.menuSelection.drinks.map(d => ({
      ...d,
      drinkGroup: d.drinkGroup as MenuSelection['drinks'][0]['drinkGroup'],
    })),
  }), [option.menuSelection]);
  
  const calculateTotal = () => {
    if (!selectedPackage) return 0;
    return selectedPackage.price_per_person 
      ? selectedPackage.price * option.guestCount 
      : selectedPackage.price;
  };

  const total = calculateTotal();

  const handlePackageChange = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    if (pkg) {
      const newTotal = pkg.price_per_person ? pkg.price * option.guestCount : pkg.price;
      onUpdate({
        packageId,
        packageName: pkg.name,
        totalAmount: newTotal,
        menuSelection: { courses: [], drinks: [] },
      });
    }
  };

  const configuredCourses = option.menuSelection.courses.filter(c => c.itemId || c.itemName).length;
  const configuredDrinks = option.menuSelection.drinks.filter(d => d.selectedChoice || d.customDrink).length;
  const hasMenuConfig = configuredCourses > 0 || configuredDrinks > 0;

  return (
    <Card className={cn(
      "transition-all duration-200",
      option.isActive 
        ? "border-primary/50 bg-card shadow-sm" 
        : "border-muted bg-muted/30 opacity-75"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
              option.isActive 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              {option.optionLabel}
            </div>

            <div className="flex-1">
              <Select
                value={option.packageId || ''}
                onValueChange={handlePackageChange}
              >
                <SelectTrigger className="w-[280px] font-medium">
                  <SelectValue placeholder="Paket wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {packages.map(pkg => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{pkg.name}</span>
                        <span className="text-muted-foreground">
                          {pkg.price}€ {pkg.price_per_person ? 'p.P.' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleActive}
              className={cn(
                "gap-1.5",
                option.isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {option.isActive ? (
                <><Check className="h-4 w-4" /> Aktiv</>
              ) : (
                <><X className="h-4 w-4" /> Inaktiv</>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {selectedPackage && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {option.guestCount} Gäste × {selectedPackage.price}€
                {selectedPackage.price_per_person ? ' p.P.' : ''}
              </span>
            </div>
            <div className="text-xl font-bold text-primary">
              {total.toFixed(2)} €
            </div>
          </div>
        )}

        {selectedPackage && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {hasMenuConfig ? (
                  <span className="text-primary">
                    {configuredCourses} Gänge, {configuredDrinks} Getränke konfiguriert
                  </span>
                ) : (
                  <span className="text-muted-foreground">Menü noch nicht konfiguriert</span>
                )}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMenuEditor(!showMenuEditor)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              {showMenuEditor ? 'Schließen' : 'Menü konfigurieren'}
            </Button>
          </div>
        )}

        {option.stripePaymentLinkUrl && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Check className="h-4 w-4" />
              <span>Zahlungslink erstellt</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-primary hover:text-primary/80"
            >
              <a href={option.stripePaymentLinkUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Link öffnen
              </a>
            </Button>
          </div>
        )}

        {isGeneratingPaymentLink && (
          <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Zahlungslink wird erstellt...</span>
          </div>
        )}

        <Collapsible open={showMenuEditor} onOpenChange={setShowMenuEditor}>
          <CollapsibleContent>
            {selectedPackage && (
              <div className="pt-4 border-t">
                <MenuComposer
                  packageId={option.packageId}
                  packageName={selectedPackage.name}
                  guestCount={option.guestCount}
                  menuSelection={adaptedMenuSelection}
                  onMenuSelectionChange={(selection) => 
                    onUpdate({ menuSelection: selection })
                  }
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
