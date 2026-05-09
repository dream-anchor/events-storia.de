import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptionCard } from "./OptionCard";
import { MenuImporter } from "./MenuImporter";
import type {
  OfferBuilderOption,
  OfferMode,
  CourseConfig,
  DrinkConfig,
  CustomerResponse,
} from "./types";
import { DEFAULT_COURSE_CONFIGS } from "./types";
import type { Package } from "../types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface OptionCardGridProps {
  options: OfferBuilderOption[];
  packages: Package[];
  menuItems: CombinedMenuItem[];
  packageConfigs: Record<string, { courses: CourseConfig[]; drinks: DrinkConfig[] }>;
  onUpdateOption: (optionId: string, updates: Partial<OfferBuilderOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onToggleActive: (optionId: string) => void;
  onAddOption: (mode?: OfferMode, copyFrom?: OfferBuilderOption) => void;
  onImportMultiple: (partials: Partial<OfferBuilderOption>[]) => void;
  isLocked: boolean;
  currentVersion: number;
  guestCount: number;
  menuImporterOpen?: boolean;
  onMenuImporterOpenChange?: (open: boolean) => void;
  customerResponse?: CustomerResponse | null;
}

export function OptionCardGrid({
  options,
  packages,
  menuItems,
  packageConfigs,
  onUpdateOption,
  onRemoveOption,
  onToggleActive,
  onAddOption,
  onImportMultiple,
  isLocked,
  currentVersion,
  guestCount,
  menuImporterOpen,
  onMenuImporterOpenChange,
  customerResponse,
}: OptionCardGridProps) {
  const canAdd = options.length < 5 && !isLocked;
  const canDuplicate = options.length < 5;
  const canDelete = options.length > 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Angebots-Optionen
        </h3>
        <div className="flex items-center gap-2">
          <MenuImporter
            guestCount={guestCount}
            currentOptionCount={options.length}
            onImportMultiple={onImportMultiple}
            disabled={isLocked || options.length >= 5}
            externalOpen={menuImporterOpen}
            onExternalOpenChange={onMenuImporterOpenChange}
          />
          {canAdd && (
            <button
              onClick={() => onAddOption()}
              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Option hinzufügen
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-5",
          options.length <= 1 && "grid-cols-1",
          options.length === 2 && "grid-cols-1 xl:grid-cols-2",
          options.length >= 3 && "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"
        )}
      >
        <AnimatePresence mode="popLayout">
          {options.map((option) => {
            // Menü-Modus: Default-Configs (kein Paket). Paket-Modus: Configs aus Paket.
            // Bug B: Im Paket-Modus zusätzlich alle DEFAULT-Gang-Typen verfügbar machen,
            // damit der Betreiber frei entscheiden kann (Dessert, Antipasto, ...).
            // Paketspezifische Configs haben Priorität (mit allowed_categories), zusätzlich
            // werden alle DEFAULT-Typen ergänzt, die noch nicht enthalten sind.
            let courseConfigs: CourseConfig[];
            if (option.offerMode === 'menu') {
              courseConfigs = DEFAULT_COURSE_CONFIGS;
            } else if (option.packageId) {
              const pkgConfigs = packageConfigs[option.packageId]?.courses || [];
              const existingTypes = new Set(pkgConfigs.map(c => c.course_type));
              const extras = DEFAULT_COURSE_CONFIGS
                .filter(d => !existingTypes.has(d.course_type))
                .map(d => ({ ...d, sort_order: 100 + d.sort_order }));
              courseConfigs = [...pkgConfigs, ...extras];
            } else {
              courseConfigs = [];
            }

            const drinkConfigs = option.offerMode === 'paket' && option.packageId
              ? (packageConfigs[option.packageId]?.drinks || [])
              : [];

            return (
              <OptionCard
                key={option.id}
                option={option}
                packages={packages}
                menuItems={menuItems}
                courseConfigs={courseConfigs}
                drinkConfigs={drinkConfigs}
                onUpdate={(updates) => onUpdateOption(option.id, updates)}
                onRemove={() => onRemoveOption(option.id)}
                onDuplicate={() => onAddOption(option.offerMode, option)}
                onToggleActive={() => onToggleActive(option.id)}
                isLocked={isLocked && option.createdInVersion !== currentVersion}
                canDuplicate={canDuplicate}
                canDelete={canDelete}
                onRequestImport={() => onMenuImporterOpenChange?.(true)}
                isCustomerChoice={!!customerResponse && customerResponse.selectedOptionId === option.id}
                customerNotes={customerResponse?.selectedOptionId === option.id ? customerResponse?.customerNotes ?? null : null}
                respondedAt={customerResponse?.selectedOptionId === option.id ? customerResponse?.respondedAt ?? null : null}
              />
            );
          })}
        </AnimatePresence>

      </div>
    </div>
  );
}
