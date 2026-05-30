import { useState, useCallback } from "react";
import { Plus, GripVertical, Trash2, Pencil, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DishPicker } from "./DishPicker";
import { COURSE_ICONS } from "./types";
import type { CourseConfig, CourseSelection, CourseType } from "./types";
import { LinePriceModeToggle, type LinePriceMode } from "./LinePriceModeToggle";

// Default-Labels pro CourseType — werden im Icon-Picker als Vorschlag angeboten.
const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  starter: 'Antipasto',
  pasta: 'Pasta',
  main: 'Hauptgang',
  main_fish: 'Fisch',
  main_meat: 'Fleisch',
  dessert: 'Dessert',
  fingerfood: 'Fingerfood',
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
};
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { PricingMode } from "./pricingMode";
import { findBestMenuItem } from "./menuItemLookup";
import { MobileCourseSheet } from "./MobileCourseSheet";
import { haptic } from "@/lib/haptics";

interface InlineCourseEditorProps {
  courses: CourseSelection[];
  courseConfigs: CourseConfig[];
  menuItems: CombinedMenuItem[];
  onUpdateCourse: (index: number, update: Partial<CourseSelection>) => void;
  onAddCourse: (courseType: CourseType, courseLabel: string) => void;
  onRemoveCourse: (index: number) => void;
  onReorderCourses?: (courses: CourseSelection[]) => void;
  /** Pricing-Modus der Option. Bei 'per_event' wird ein Mengen-Feld pro Zeile sichtbar. */
  pricingMode?: PricingMode;
  disabled?: boolean;
  /** Paket-Modus: Preis-Input zeigt "inkl." als Default; eingegebener Wert wird als Aufpreis interpretiert. */
  packageMode?: boolean;
}

// --- Sortierbare Zeile ---
function SortableCourseRow({
  course,
  idx,
  menuItems,
  courseConfigs,
  onDishSelect,
  onClear,
  onUpdateName,
  onUpdateLabel,
  onUpdateType,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveCourse,
  pricingMode,
  disabled,
  packageMode = false,
  onOpenMobileSheet,
}: {
  course: CourseSelection;
  idx: number;
  menuItems: CombinedMenuItem[];
  courseConfigs: CourseConfig[];
  onDishSelect: (index: number, dish: { id: string; name: string; description: string | null; source: string; price: number | null }) => void;
  onClear: (index: number) => void;
  onUpdateName: (index: number, name: string) => void;
  onUpdateLabel: (index: number, label: string) => void;
  onUpdateType: (index: number, courseType: CourseType, label: string) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdatePrice: (index: number, price: number | null) => void;
  onUpdatePriceMode: (index: number, mode: LinePriceMode) => void;
  onRemoveCourse: (index: number) => void;
  pricingMode: PricingMode;
  disabled: boolean;
  packageMode?: boolean;
  onOpenMobileSheet?: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [editingLabel, setEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `course-${idx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const getFilterCategories = (courseType: string): string[] => {
    const config = courseConfigs.find(c => c.course_type === courseType);
    return config?.allowed_categories || [];
  };

  // Preis-Ableitung: catalogPrice aus MenuItem, unitPrice respektiert overridePrice,
  // lineTotal = unitPrice * quantity. formatter fuer lineTotal.
  const menuItem = findBestMenuItem(menuItems, course.itemId, course.itemName);
  const catalogPrice = menuItem?.price ?? null;
  const hasOverride = course.overridePrice != null && course.overridePrice > 0;
  const unitPrice = hasOverride
    ? course.overridePrice!
    : (catalogPrice && catalogPrice > 0 ? catalogPrice : null);
  const quantity = course.quantity ?? 1;
  const lineTotal = unitPrice != null ? unitPrice * quantity : null;
  const fmtEUR = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Mobile: 2-Zeilen-Layout (Header-Reihe + Picker/Preis-Reihe)
        // sm+: ursprüngliches einzeiliges Layout
        "flex flex-col sm:flex-row sm:items-center gap-2 py-2 px-2 rounded-lg",
        "hover:bg-muted/30 transition-colors group",
        isDragging && "opacity-60 bg-muted/40 shadow-lg"
      )}
    >
      {/* Header-Zeile (Mobile: full-width, sm+: inline) */}
      <div className="flex items-center gap-2 sm:contents">
        {/* Drag Handle — größerer Tap-Target auf Mobile */}
        {!disabled && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-2 sm:p-0.5 -m-1 sm:m-0 rounded hover:bg-muted/50"
            tabIndex={-1}
            aria-label="Gang verschieben"
          >
            <GripVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/60" />
          </button>
        )}
        {disabled && (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />
        )}

        {/* Icon — klickbar: oeffnet einen Picker fuer Gang-Typ */}
        {disabled ? (
          <span className="text-base w-7 text-center shrink-0">
            {COURSE_ICONS[course.courseType as CourseType] || '🍽️'}
          </span>
        ) : (
          <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="text-base w-7 h-7 flex items-center justify-center shrink-0 rounded-md hover:bg-muted/60 transition-colors"
                title="Gang-Typ aendern"
                aria-label="Gang-Typ aendern"
              >
                {COURSE_ICONS[course.courseType as CourseType] || '🍽️'}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              {(Object.keys(COURSE_ICONS) as CourseType[]).map((ct) => (
                <button
                  key={ct}
                  onClick={() => {
                    // Wenn der Label noch der Default-Label des alten Typs ist,
                    // dann auf den neuen Default umstellen — sonst Custom-Label belassen.
                    const oldDefault = COURSE_TYPE_LABELS[course.courseType as CourseType];
                    const keepCustom = course.courseLabel && course.courseLabel !== oldDefault;
                    onUpdateType(idx, ct, keepCustom ? course.courseLabel : COURSE_TYPE_LABELS[ct]);
                    setIconPickerOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-muted/50 text-left"
                >
                  <span className="text-base w-6 text-center">{COURSE_ICONS[ct]}</span>
                  <span>{COURSE_TYPE_LABELS[ct]}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
        {/* Gang-Label — klickbar: inline editierbar */}
        {editingLabel && !disabled ? (
          <Input
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={() => {
              const v = tempLabel.trim();
              if (v && v !== course.courseLabel) onUpdateLabel(idx, v);
              setEditingLabel(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = tempLabel.trim();
                if (v && v !== course.courseLabel) onUpdateLabel(idx, v);
                setEditingLabel(false);
              }
              if (e.key === 'Escape') setEditingLabel(false);
            }}
            autoFocus
            className="h-8 sm:w-28 text-sm"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setTempLabel(course.courseLabel); setEditingLabel(true); }}
            className={cn(
              "text-sm font-medium sm:font-normal text-foreground sm:text-muted-foreground sm:w-20 shrink-0 sm:truncate flex-1 sm:flex-initial text-left rounded px-1 -mx-1",
              !disabled && "hover:bg-muted/40 cursor-text"
            )}
            title={!disabled ? "Bezeichnung aendern" : undefined}
          >
            {course.courseLabel}
          </button>
        )}

        {/* Mobile-only Edit + Trash in der Header-Reihe; sm+: Trash am Zeilenende */}
        {!disabled && onOpenMobileSheet && (
          <button
            onClick={onOpenMobileSheet}
            className="sm:hidden shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors"
            title="Gang bearbeiten"
            aria-label="Gang bearbeiten"
          >
            <Edit3 className="h-5 w-5 text-muted-foreground/70" />
          </button>
        )}
        {!disabled && (
          <button
            onClick={() => onRemoveCourse(idx)}
            className="sm:hidden shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors"
            title="Gang entfernen"
            aria-label="Gang entfernen"
          >
            <Trash2 className="h-5 w-5 text-muted-foreground/60 hover:text-destructive" />
          </button>
        )}
      </div>

      {/* Menge (nur bei per_event) */}
      {pricingMode === 'per_event' && (
        <div className="relative w-16 shrink-0 order-2 sm:order-none">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={course.quantity ?? 1}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) onUpdateQuantity(idx, v);
            }}
            disabled={disabled}
            className="h-10 sm:h-8 rounded-lg pr-5 text-right text-sm tabular-nums"
            title="Menge"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">×</span>
        </div>
      )}

      {/* DishPicker + Inline Name Edit */}
      <div className="flex-1 min-w-0 order-3 sm:order-none w-full sm:w-auto">
        {editingName ? (
          <Input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={() => {
              if (tempName.trim()) onUpdateName(idx, tempName.trim());
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (tempName.trim()) onUpdateName(idx, tempName.trim());
                setEditingName(false);
              }
              if (e.key === 'Escape') setEditingName(false);
            }}
            autoFocus
            className="h-10 sm:h-8 text-base sm:text-sm"
          />
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <DishPicker
                value={course.itemId ? { id: course.itemId, name: course.itemName } : null}
                onSelect={(dish) => onDishSelect(idx, dish)}
                menuItems={menuItems}
                filterCategories={getFilterCategories(course.courseType)}
                courseType={course.courseType}
                placeholder={`${course.courseLabel} wählen...`}
                disabled={disabled}
              />
            </div>
            {!disabled && course.itemId && course.itemName && (
              <button
                onClick={() => { setTempName(course.itemName); setEditingName(true); }}
                className="shrink-0 h-9 w-9 sm:h-auto sm:w-auto sm:p-1 inline-flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                title="Bezeichnung bearbeiten"
                aria-label="Bezeichnung bearbeiten"
              >
                <Pencil className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground/60" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Einzelpreis (immer sichtbar) */}
      <div className="relative w-24 shrink-0 order-4 sm:order-none">
        <Input
          type="number"
          step={0.01}
          min={0}
          inputMode="decimal"
          value={
            packageMode
              ? (hasOverride ? course.overridePrice! : '')
              : (hasOverride ? course.overridePrice! : (catalogPrice && catalogPrice > 0 ? catalogPrice : ''))
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
              onUpdatePrice(idx, null);
              return;
            }
            const parsed = parseFloat(val);
            if (isNaN(parsed) || parsed <= 0) {
              // 0/negativ → null normalisieren
              onUpdatePrice(idx, null);
              return;
            }
            onUpdatePrice(idx, parsed);
          }}
          placeholder={
            packageMode
              ? 'inkl.'
              : (catalogPrice != null && catalogPrice > 0 ? catalogPrice.toFixed(2) : '—')
          }
          disabled={disabled}
          className={cn(
            "h-10 sm:h-8 rounded-lg pr-6 text-right text-sm tabular-nums",
            packageMode && !hasOverride && "placeholder:text-muted-foreground/60 placeholder:italic",
            packageMode && hasOverride && "text-foreground"
          )}
          title={packageMode ? 'Aufpreis (optional)' : 'Einzelpreis'}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">€</span>
        {packageMode && hasOverride && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">+</span>
        )}
      </div>

      {/* Zeilen-Total (nur bei per_event mit quantity > 1) */}
      {pricingMode === 'per_event' && quantity > 1 && (
        <span className="text-sm font-medium tabular-nums w-24 text-right shrink-0 order-5 sm:order-none">
          {lineTotal != null ? fmtEUR(lineTotal) : ''}
        </span>
      )}

      {/* Gang entfernen — auf sm+ am Zeilenende; auf Mobile bereits in der Header-Reihe */}
      {!disabled && (
        <button
          onClick={() => onRemoveCourse(idx)}
          className="hidden sm:inline-flex shrink-0 h-7 w-7 items-center justify-center rounded-md hover:bg-destructive/10 transition-colors"
          title="Gang entfernen"
          aria-label="Gang entfernen"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-destructive" />
        </button>
      )}
    </div>
  );
}

export function InlineCourseEditor({
  courses,
  courseConfigs,
  menuItems,
  onUpdateCourse,
  onAddCourse,
  onRemoveCourse,
  onReorderCourses,
  pricingMode = 'per_person',
  disabled = false,
  packageMode = false,
}: InlineCourseEditorProps) {
  // Mobile sheet state — tap a row to edit on small screens.
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);

  const handleDishSelect = (
    index: number,
    dish: { id: string; name: string; description: string | null; source: string; price: number | null }
  ) => {
    const overridePrice = dish.price != null && dish.price > 0
      ? dish.price
      : null;
    onUpdateCourse(index, {
      itemId: dish.id,
      itemName: dish.name,
      itemDescription: dish.description,
      itemSource: dish.source as CourseSelection['itemSource'],
      isCustom: dish.source === 'custom',
      overridePrice,
    });
  };

  const handleClear = (index: number) => {
    onUpdateCourse(index, {
      itemId: null,
      itemName: '',
      itemDescription: null,
      itemSource: 'catering',
      isCustom: false,
      overridePrice: null,
    });
  };

  const [addOpen, setAddOpen] = useState(false);

  // --- DnD ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableIds = courses.map((_, idx) => `course-${idx}`);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    // Array neu sortieren
    const reordered = [...courses];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    if (onReorderCourses) {
      onReorderCourses(reordered);
    }
  }, [courses, sortableIds, onReorderCourses]);

  return (
    <div className="space-y-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {courses.map((course, idx) => (
            <SortableCourseRow
            key={`course-${idx}`}
            course={course}
            idx={idx}
            menuItems={menuItems}
            courseConfigs={courseConfigs}
            onDishSelect={handleDishSelect}
            onClear={handleClear}
            onUpdateName={(index, name) => onUpdateCourse(index, { itemName: name })}
            onUpdateLabel={(index, courseLabel) => onUpdateCourse(index, { courseLabel })}
            onUpdateType={(index, courseType, courseLabel) => onUpdateCourse(index, { courseType, courseLabel })}
            onUpdateQuantity={(index, quantity) => onUpdateCourse(index, { quantity })}
            onUpdatePrice={(index, overridePrice) => onUpdateCourse(index, { overridePrice })}
            pricingMode={pricingMode}
              onRemoveCourse={onRemoveCourse}
              disabled={disabled}
              packageMode={packageMode}
              onOpenMobileSheet={() => { haptic('tick'); setSheetIndex(idx); }}
            />
          ))}
        </SortableContext>
      </DndContext>

      {!disabled && courseConfigs.length > 0 && (
        <div className="pt-1 pl-2">
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl gap-1.5 text-xs text-muted-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Gang hinzufügen
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              {courseConfigs.map((config) => (
                <button
                  key={config.id}
                  onClick={() => {
                    onAddCourse(config.course_type, config.course_label);
                    haptic('select');
                    setAddOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-base w-6 text-center">
                    {COURSE_ICONS[config.course_type] || '🍽️'}
                  </span>
                  <span>{config.course_label}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Mobile-only Bottom Sheet for editing a single course */}
      {!disabled && (
        <MobileCourseSheet
          open={sheetIndex !== null}
          onOpenChange={(o) => !o && setSheetIndex(null)}
          course={sheetIndex != null ? courses[sheetIndex] ?? null : null}
          index={sheetIndex}
          menuItems={menuItems}
          courseConfigs={courseConfigs}
          pricingMode={pricingMode}
          packageMode={packageMode}
          onUpdate={onUpdateCourse}
          onRemove={onRemoveCourse}
        />
      )}
    </div>
  );
}
