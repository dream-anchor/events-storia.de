import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { DishPicker } from "./DishPicker";
import { COURSE_ICONS } from "./types";
import type { CourseConfig, CourseSelection, CourseType } from "./types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { PricingMode } from "./pricingMode";
import { findBestMenuItem } from "./menuItemLookup";
import { haptic } from "@/lib/haptics";

interface MobileCourseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseSelection | null;
  index: number | null;
  menuItems: CombinedMenuItem[];
  courseConfigs: CourseConfig[];
  pricingMode: PricingMode;
  packageMode?: boolean;
  onUpdate: (index: number, update: Partial<CourseSelection>) => void;
  onRemove: (index: number) => void;
}

/**
 * Mobile-only Bottom Sheet for editing a single course row.
 * Provides large touch targets, decimal/numeric keyboards, and a sticky save button.
 */
export function MobileCourseSheet({
  open,
  onOpenChange,
  course,
  index,
  menuItems,
  courseConfigs,
  pricingMode,
  packageMode = false,
  onUpdate,
  onRemove,
}: MobileCourseSheetProps) {
  // Local draft so we only commit on save (no flicker mid-edit).
  const [draft, setDraft] = useState<CourseSelection | null>(course);

  useEffect(() => {
    setDraft(course);
  }, [course, open]);

  // Keyboard-aware: when an input gains focus inside the sheet,
  // scroll it into view above the on-screen keyboard.
  useEffect(() => {
    if (!open) return;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      // Defer until the virtual keyboard has actually opened.
      window.setTimeout(() => {
        try {
          t.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          /* ignore */
        }
      }, 250);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  if (!course || index == null || !draft) return null;

  const config = courseConfigs.find((c) => c.course_type === course.courseType);
  const allowedCategories = config?.allowed_categories || [];

  const menuItem = findBestMenuItem(menuItems, draft.itemId, draft.itemName);
  const catalogPrice = menuItem?.price ?? null;
  const hasOverride = draft.overridePrice != null && draft.overridePrice > 0;
  const quantity = draft.quantity ?? 1;
  const unitPrice = hasOverride
    ? draft.overridePrice!
    : catalogPrice && catalogPrice > 0
      ? catalogPrice
      : null;
  const lineTotal = unitPrice != null ? unitPrice * quantity : null;
  const fmtEUR = (n: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const handleSave = () => {
    if (index == null) return;
    onUpdate(index, {
      itemId: draft.itemId,
      itemName: draft.itemName,
      itemDescription: draft.itemDescription,
      itemSource: draft.itemSource,
      isCustom: draft.isCustom,
      overridePrice: draft.overridePrice,
      quantity: draft.quantity,
      priceMode: draft.priceMode,
    });
    haptic("success");
    onOpenChange(false);
  };

  const handleRemove = () => {
    if (index == null) return;
    onRemove(index);
    haptic("warning");
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-2xl max-h-[92vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">
              {COURSE_ICONS[course.courseType as CourseType] || "🍽️"}
            </span>
            {course.courseLabel}
          </DrawerTitle>
          <DrawerDescription>
            Wähle ein Gericht aus dem Katalog oder gib eine eigene Bezeichnung ein.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-3 space-y-5 overflow-y-auto">
          {/* Dish Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gericht</Label>
            <DishPicker
              value={draft.itemId ? { id: draft.itemId, name: draft.itemName } : null}
              onSelect={(dish) => {
                const overridePrice =
                  dish.price != null && dish.price > 0 ? dish.price : null;
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        itemId: dish.id,
                        itemName: dish.name,
                        itemDescription: dish.description,
                        itemSource: dish.source as CourseSelection["itemSource"],
                        isCustom: dish.source === "custom",
                        overridePrice,
                      }
                    : d,
                );
                haptic("select");
              }}
              menuItems={menuItems}
              filterCategories={allowedCategories}
              courseType={course.courseType}
              placeholder={`${course.courseLabel} wählen…`}
            />
          </div>

          {/* Eigene Bezeichnung */}
          {draft.itemId && (
            <div className="space-y-2">
              <Label htmlFor="course-name" className="text-sm font-medium">
                Bezeichnung anpassen (optional)
              </Label>
              <Input
                id="course-name"
                value={draft.itemName}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, itemName: e.target.value } : d))
                }
                className="h-12 text-base"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Quantity (only per_event) */}
            {pricingMode === "per_event" && (
              <div className="space-y-2">
                <Label htmlFor="course-qty" className="text-sm font-medium">
                  Menge
                </Label>
                <Input
                  id="course-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={draft.quantity ?? 1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0)
                      setDraft((d) => (d ? { ...d, quantity: v } : d));
                  }}
                  className="h-12 text-base text-right tabular-nums"
                />
              </div>
            )}

            {/* Price */}
            <div className={`space-y-2 ${pricingMode === "per_event" ? "" : "col-span-2"}`}>
              <Label htmlFor="course-price" className="text-sm font-medium">
                {packageMode ? "Aufpreis (optional)" : "Einzelpreis"}
              </Label>
              <div className="relative">
                <Input
                  id="course-price"
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  min={0}
                  value={
                    packageMode
                      ? hasOverride
                        ? draft.overridePrice!
                        : ""
                      : hasOverride
                        ? draft.overridePrice!
                        : catalogPrice && catalogPrice > 0
                          ? catalogPrice
                          : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setDraft((d) => (d ? { ...d, overridePrice: null } : d));
                      return;
                    }
                    const parsed = parseFloat(val);
                    if (isNaN(parsed) || parsed <= 0) {
                      setDraft((d) => (d ? { ...d, overridePrice: null } : d));
                      return;
                    }
                    setDraft((d) => (d ? { ...d, overridePrice: parsed } : d));
                  }}
                  placeholder={
                    packageMode
                      ? "inkl."
                      : catalogPrice != null && catalogPrice > 0
                        ? catalogPrice.toFixed(2)
                        : "—"
                  }
                  className="h-12 pr-8 text-base text-right tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  €
                </span>
              </div>
            </div>
          </div>

          {/* Line Total Hint */}
          {pricingMode === "per_event" && lineTotal != null && quantity > 1 && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {quantity} × {fmtEUR(unitPrice ?? 0)}
              </span>
              <span className="font-semibold tabular-nums">{fmtEUR(lineTotal)}</span>
            </div>
          )}

          {/* Remove */}
          <Button
            variant="ghost"
            onClick={handleRemove}
            className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Gang entfernen
          </Button>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12"
            >
              Abbrechen
            </Button>
            <Button onClick={handleSave} className="flex-1 h-12 font-semibold">
              Übernehmen
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}