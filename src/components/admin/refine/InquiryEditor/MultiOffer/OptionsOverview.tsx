import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronDown,
  Check,
  X,
  UtensilsCrossed,
  Wine,
  GlassWater,
  Package as PackageIcon,
  Trash2,
  ChefHat,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { OfferOption } from "./types";
import { Package } from "../types";
import { calculateEventPackagePrice } from "@/lib/eventPricing";

interface OptionsOverviewProps {
  options: OfferOption[];
  packages: Package[];
  isLocked: boolean;
  onUpdateOption: (optionId: string, updates: Partial<OfferOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onToggleActive: (optionId: string) => void;
  onAddOption: () => void;
  onConfigureOption: (optionId: string) => void;
  isMenuComplete: (opt: OfferOption) => boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function OptionsOverview({
  options,
  packages,
  isLocked,
  onUpdateOption,
  onRemoveOption,
  onToggleActive,
  onAddOption,
  onConfigureOption,
  isMenuComplete,
}: OptionsOverviewProps) {
  const [activeTabId, setActiveTabId] = useState<string>(options[0]?.id || "");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    courses: true,
    drinks: false,
    drinkPackage: false,
    extras: false,
  });

  // Keep activeTabId in sync with options
  const activeOption = useMemo(() => {
    const found = options.find((o) => o.id === activeTabId);
    if (found) return found;
    if (options.length > 0) {
      setActiveTabId(options[0].id);
      return options[0];
    }
    return null;
  }, [options, activeTabId]);

  const selectedPackage = activeOption
    ? packages.find((p) => p.id === activeOption.packageId)
    : undefined;

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePackageChange = (packageId: string) => {
    if (!activeOption) return;
    const pkg = packages.find((p) => p.id === packageId);
    if (pkg) {
      const newTotal = calculateEventPackagePrice(
        pkg.id,
        pkg.price,
        activeOption.guestCount,
        !!pkg.price_per_person
      );
      onUpdateOption(activeOption.id, {
        packageId,
        packageName: pkg.name,
        totalAmount: newTotal,
        menuSelection: { courses: [], drinks: [] },
      });
    }
  };

  if (!activeOption) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <PackageIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Keine Optionen vorhanden</p>
      </div>
    );
  }

  const configuredCourses = activeOption.menuSelection.courses.filter(
    (c) => c.itemId || c.itemName
  );
  const configuredDrinks = activeOption.menuSelection.drinks.filter(
    (d) => d.selectedChoice || d.customDrink
  );
  const menuComplete = isMenuComplete(activeOption);
  const total = activeOption.totalAmount;

  return (
    <div className="space-y-4">
      {/* Option Tabs */}
      <div className="flex items-center gap-2">
        {options.map((opt) => {
          const isActive = opt.id === activeTabId;
          return (
            <button
              key={opt.id}
              onClick={() => setActiveTabId(opt.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : opt.isActive
                    ? "bg-muted text-foreground hover:bg-muted/80"
                    : "bg-muted/50 text-muted-foreground line-through hover:bg-muted/60"
              )}
            >
              Option {opt.optionLabel}
              {opt.packageId && isMenuComplete(opt) && (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
          );
        })}

        {/* Add Option — Inline */}
        {!isLocked && options.length < 5 && (
          <button
            onClick={onAddOption}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-dashed border-border"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hinzufügen</span>
          </button>
        )}
      </div>

      {/* Active Option Content */}
      <motion.div
        key={activeOption.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
      >
        {/* Package Selection Header */}
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-base shrink-0",
                activeOption.isActive
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {activeOption.optionLabel}
            </div>

            {isLocked ? (
              <span className="font-medium text-foreground">
                {selectedPackage?.name || "Kein Paket"}
              </span>
            ) : (
              <Select
                value={activeOption.packageId || ""}
                onValueChange={handlePackageChange}
              >
                <SelectTrigger className="w-[260px] font-medium h-10">
                  <SelectValue placeholder="Paket wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{pkg.name}</span>
                        <span className="text-muted-foreground">
                          {pkg.price}€ {pkg.price_per_person ? "p.P." : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Option Actions */}
          {!isLocked && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleActive(activeOption.id)}
                className={cn(
                  "h-9 px-3 gap-1.5 text-xs",
                  activeOption.isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {activeOption.isActive ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Aktiv
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" /> Inaktiv
                  </>
                )}
              </Button>
              {options.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveOption(activeOption.id)}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Accordion Sections */}
        {selectedPackage && (
          <div className="divide-y divide-border/40">
            {/* Gänge */}
            <AccordionSection
              icon={<UtensilsCrossed className="h-4 w-4" />}
              label="Gänge"
              isOpen={openSections.courses}
              onToggle={() => toggleSection("courses")}
              badge={
                configuredCourses.length > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {configuredCourses.length} ausgewählt
                  </Badge>
                ) : null
              }
            >
              {configuredCourses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {configuredCourses.map((course, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/30"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {course.courseLabel}
                      </span>
                      <span className="text-sm text-foreground">
                        {course.itemName}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Noch keine Gänge konfiguriert
                </p>
              )}
            </AccordionSection>

            {/* Getränke */}
            <AccordionSection
              icon={<Wine className="h-4 w-4" />}
              label="Getränke"
              isOpen={openSections.drinks}
              onToggle={() => toggleSection("drinks")}
              badge={
                configuredDrinks.length > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {configuredDrinks.length} ausgewählt
                  </Badge>
                ) : null
              }
            >
              {configuredDrinks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {configuredDrinks.map((drink, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/30"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {drink.drinkLabel}
                      </span>
                      <span className="text-sm text-foreground">
                        {drink.customDrink || drink.selectedChoice}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Noch keine Getränke konfiguriert
                </p>
              )}
            </AccordionSection>

            {/* Getränke-Pauschale */}
            <AccordionSection
              icon={<GlassWater className="h-4 w-4" />}
              label="Getränke-Pauschale"
              isOpen={openSections.drinkPackage}
              onToggle={() => toggleSection("drinkPackage")}
            >
              <p className="text-sm text-muted-foreground italic">
                Wird im Wizard konfiguriert
              </p>
            </AccordionSection>

            {/* Zusatzleistungen */}
            <AccordionSection
              icon={<PackageIcon className="h-4 w-4" />}
              label="Zusatzleistungen"
              isOpen={openSections.extras}
              onToggle={() => toggleSection("extras")}
            >
              <p className="text-sm text-muted-foreground italic">
                Keine Zusatzleistungen konfiguriert
              </p>
            </AccordionSection>
          </div>
        )}

        {/* Footer Bar */}
        <div className="px-5 py-4 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "font-medium",
                menuComplete ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Option {activeOption.optionLabel}:{" "}
              {!selectedPackage
                ? "Kein Paket"
                : !menuComplete
                  ? "Menü fehlt"
                  : "Vollständig"}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="font-semibold text-foreground">
              Gesamtbetrag: {formatCurrency(total)}
            </span>
          </div>

          {!isLocked && selectedPackage && (
            <motion.button
              onClick={() => onConfigureOption(activeOption.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "h-10 px-5 rounded-xl font-semibold text-sm flex items-center gap-2",
                "bg-gradient-to-r from-amber-500 to-amber-600",
                "text-white",
                "shadow-[0_4px_16px_-4px_rgba(245,158,11,0.4)]",
                "hover:shadow-[0_6px_20px_-4px_rgba(245,158,11,0.5)]",
                "transition-shadow duration-300"
              )}
            >
              <ChefHat className="h-4 w-4" />
              Konfigurieren
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Add Option Link */}
      {!isLocked && options.length < 5 && (
        <button
          onClick={onAddOption}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Weitere Option hinzufügen
        </button>
      )}
    </div>
  );
}

// --- Accordion Section Sub-Component ---

interface AccordionSectionProps {
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function AccordionSection({
  icon,
  label,
  isOpen,
  onToggle,
  badge,
  children,
}: AccordionSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium text-foreground">{label}</span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
