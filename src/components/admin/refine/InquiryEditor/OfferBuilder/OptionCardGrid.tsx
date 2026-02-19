import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptionCard } from "./OptionCard";
import type {
  OfferBuilderOption,
  OfferMode,
  CourseConfig,
  DrinkConfig,
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
  onAddOption: (mode?: OfferMode) => void;
  defaultMode: OfferMode;
  isLocked: boolean;
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
  defaultMode,
  isLocked,
}: OptionCardGridProps) {
  const canAdd = options.length < 5 && !isLocked;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Angebots-Optionen
        </h3>
        {canAdd && (
          <button
            onClick={() => onAddOption(defaultMode)}
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Option hinzufügen
          </button>
        )}
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
            const courseConfigs = option.offerMode === 'menu'
              ? DEFAULT_COURSE_CONFIGS
              : option.packageId
                ? (packageConfigs[option.packageId]?.courses || [])
                : [];

            return (
              <OptionCard
                key={option.id}
                option={option}
                packages={packages}
                menuItems={menuItems}
                courseConfigs={courseConfigs}
                onUpdate={(updates) => onUpdateOption(option.id, updates)}
                onRemove={() => onRemoveOption(option.id)}
                onToggleActive={() => onToggleActive(option.id)}
                isLocked={isLocked}
              />
            );
          })}
        </AnimatePresence>

        {/* Add Card */}
        {canAdd && (
          <button
            onClick={() => onAddOption(defaultMode)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 min-h-[200px]",
              "rounded-2xl border-2 border-dashed border-border/40",
              "text-muted-foreground hover:border-primary/40 hover:text-primary/60",
              "transition-colors cursor-pointer"
            )}
          >
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Weitere Option</span>
          </button>
        )}
      </div>
    </div>
  );
}
