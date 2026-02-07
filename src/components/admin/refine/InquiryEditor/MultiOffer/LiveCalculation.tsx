import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ChefHat, Wine, Check, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OfferOption } from "./types";
import { Package } from "../types";

interface LiveCalculationProps {
  option: OfferOption;
  selectedPackage: Package | undefined;
  onNextStep: () => void;
  nextStepLabel: string;
  isNextDisabled: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function LiveCalculation({
  option,
  selectedPackage,
  onNextStep,
  nextStepLabel,
  isNextDisabled,
}: LiveCalculationProps) {
  const pricePerPerson = selectedPackage?.price_per_person
    ? selectedPackage.price
    : 0;

  const total = selectedPackage
    ? selectedPackage.price_per_person
      ? selectedPackage.price * option.guestCount
      : selectedPackage.price
    : 0;

  const configuredCourses = useMemo(
    () => option.menuSelection.courses.filter((c) => c.itemId || c.itemName),
    [option.menuSelection.courses]
  );

  const configuredDrinks = useMemo(
    () =>
      option.menuSelection.drinks.filter(
        (d) => d.selectedChoice || d.customDrink
      ),
    [option.menuSelection.drinks]
  );

  return (
    <Card className="sticky top-24 rounded-2xl border-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 px-5 py-4 border-b border-border/40">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Live-Kalkulation
        </h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Price Breakdown */}
        {selectedPackage ? (
          <>
            {selectedPackage.price_per_person && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Preis pro Person</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(pricePerPerson)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Gäste
              </span>
              <span className="font-medium text-foreground">
                {option.guestCount}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Gesamt
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={total.toFixed(2)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-xl font-bold text-foreground tracking-tight"
                >
                  {formatCurrency(total)}
                </motion.span>
              </AnimatePresence>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Paket wählen für Kalkulation
          </p>
        )}

        {/* Selected Items */}
        {(configuredCourses.length > 0 || configuredDrinks.length > 0) && (
          <>
            <Separator />

            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {/* Courses */}
              {configuredCourses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <ChefHat className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Gänge
                    </span>
                  </div>
                  {configuredCourses.map((course, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-foreground truncate block">
                          {course.itemName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {course.courseLabel}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Drinks */}
              {configuredDrinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Wine className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Getränke
                    </span>
                  </div>
                  {configuredDrinks.map((drink, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-foreground truncate block">
                          {drink.customDrink || drink.selectedChoice}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {drink.drinkLabel}
                          {drink.quantityLabel && ` (${drink.quantityLabel})`}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* CTA Footer */}
      <div className="p-4 border-t border-border/40 bg-muted/20">
        <Button
          onClick={onNextStep}
          disabled={isNextDisabled}
          className={cn(
            "w-full h-11 rounded-xl font-semibold gap-2",
            "bg-gradient-to-r from-amber-500 to-amber-600",
            "text-white hover:from-amber-600 hover:to-amber-700",
            "shadow-[0_4px_16px_-4px_rgba(245,158,11,0.4)]",
            "disabled:opacity-50 disabled:shadow-none"
          )}
        >
          {nextStepLabel}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
