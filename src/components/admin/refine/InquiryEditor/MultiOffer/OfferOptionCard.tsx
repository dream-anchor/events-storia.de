import { useState, useMemo } from "react";
import { Package, Check, X, Edit2, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { OfferOption } from "./types";
import { Package as PackageType, ExtendedInquiry } from "../types";
import { MenuComposer } from "../MenuComposer";
import type { MenuSelection } from "../MenuComposer/types";

interface OfferOptionCardProps {
  option: OfferOption;
  packages: PackageType[];
  inquiry: ExtendedInquiry;
  onUpdate: (updates: Partial<OfferOption>) => void;
  onRemove: () => void;
  onToggleActive: () => void;
  isGeneratingPaymentLink?: boolean;
}

export function OfferOptionCard({
  option,
  packages,
  inquiry,
  onUpdate,
  onRemove,
  onToggleActive,
  isGeneratingPaymentLink,
}: OfferOptionCardProps) {
  const [showMenuEditor, setShowMenuEditor] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

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
    <Card 
      id={`option-${option.id}`}
      className={cn(
        "transition-all duration-300 backdrop-blur-sm",
        option.isActive 
          ? "border-border bg-card/80 shadow-md" 
          : "border-border/50 bg-muted/20 opacity-60"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Option Label Circle - Spatial 2026 */}
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center font-semibold text-xl transition-colors shadow-[var(--shadow-subtle,_0_1px_2px_rgba(0,0,0,0.03))]",
              option.isActive 
                ? "bg-foreground text-background" 
                : "bg-muted text-muted-foreground border border-border"
            )}>
              {option.optionLabel}
            </div>

            <div className="flex-1">
              <Select
                value={option.packageId || ''}
                onValueChange={handlePackageChange}
              >
                <SelectTrigger className="w-[280px] font-medium h-11">
                  <SelectValue placeholder="Paket wählen..." />
                </SelectTrigger>
                <SelectContent className="font-sans">
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

          <div className="flex items-center gap-1">
            {/* Toggle - Minimalist 2026 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleActive}
              className={cn(
                "gap-1.5 h-10 px-3",
                option.isActive 
                  ? "text-foreground" 
                  : "text-muted-foreground"
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
              className="h-10 w-10 text-muted-foreground hover:text-amber-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Pricing Section - Spatial 2026 */}
        {selectedPackage && (
          <div className="p-5 rounded-2xl bg-muted/20 border border-border/30 shadow-[var(--shadow-subtle,_0_1px_2px_rgba(0,0,0,0.03))] space-y-3">
            {selectedPackage.price_per_person ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Preis pro Person</span>
                  <span className="font-medium text-foreground">{selectedPackage.price.toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gäste</span>
                  <span className="font-medium text-foreground">× {option.guestCount}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-base font-medium text-foreground">Gesamt</span>
                  <span className="text-2xl font-semibold text-foreground tracking-tight">{total.toFixed(2)} €</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Pauschalpreis für {option.guestCount} Gäste
                </span>
                <span className="text-2xl font-semibold text-foreground tracking-tight">{total.toFixed(2)} €</span>
              </div>
            )}
          </div>
        )}

        {/* Menu Configuration Status - 2026 */}
        {selectedPackage && (
          <div className="space-y-3">
            {hasMenuConfig ? (
              <>
                {/* Configured Courses */}
                {configuredCourses > 0 && (
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gänge</span>
                      <span className="text-xs text-muted-foreground">{configuredCourses} ausgewählt</span>
                    </div>
                    <div className="space-y-1">
                      {option.menuSelection.courses
                        .filter(c => c.itemId || c.itemName)
                        .map((course, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">{course.courseLabel}:</span>
                            <span className="text-foreground truncate">{course.itemName}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Configured Drinks */}
                {configuredDrinks > 0 && (
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Getränke</span>
                      <span className="text-xs text-muted-foreground">{configuredDrinks} ausgewählt</span>
                    </div>
                    <div className="space-y-1">
                      {option.menuSelection.drinks
                        .filter(d => d.selectedChoice || d.customDrink)
                        .map((drink, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">{drink.drinkLabel}:</span>
                            <span className="text-foreground truncate">{drink.customDrink || drink.selectedChoice}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Edit Button - Compact Ghost 2026 */}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMenuEditor(!showMenuEditor)}
                    className="h-9 px-3 gap-1.5 text-sm text-muted-foreground hover:text-foreground rounded-xl"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    {showMenuEditor ? 'Schließen' : 'Bearbeiten'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Menü noch nicht konfiguriert</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMenuEditor(!showMenuEditor)}
                  className="h-9 px-3 gap-1.5 text-sm text-muted-foreground hover:text-foreground rounded-xl"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {showMenuEditor ? 'Schließen' : 'Konfigurieren'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Payment Link Section - Subtle 2026 */}
        {option.stripePaymentLinkUrl && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2.5 text-sm text-foreground">
              <Check className="h-4 w-4" />
              <span>Zahlungslink erstellt</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-10 text-foreground hover:text-foreground/80"
            >
              <a href={option.stripePaymentLinkUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Link öffnen
              </a>
            </Button>
          </div>
        )}

        {isGeneratingPaymentLink && (
          <div className="flex items-center gap-2.5 p-3 text-sm text-muted-foreground">
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
                  inquiry={inquiry}
                  emailDraft={emailDraft}
                  onEmailDraftChange={setEmailDraft}
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
