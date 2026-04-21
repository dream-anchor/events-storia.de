import { useState, useCallback } from "react";
import { Plus, GripVertical, Trash2, Pencil } from "lucide-react";
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
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import type { PricingMode } from "./pricingMode";
import { findBestMenuItem } from "./menuItemLookup";

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
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveCourse,
  pricingMode,
  disabled,
  packageMode = false,
}: {
  course: CourseSelection;
  idx: number;
  menuItems: CombinedMenuItem[];
  courseConfigs: CourseConfig[];
  onDishSelect: (index: number, dish: { id: string; name: string; description: string | null; source: string; price: number | null }) => void;
  onClear: (index: number) => void;
  onUpdateName: (index: number, name: string) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdatePrice: (index: number, price: number | null) => void;
  onRemoveCourse: (index: number) => void;
  pricingMode: PricingMode;
  disabled: boolean;
  packageMode?: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
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
        "flex items-center gap-2 py-2 px-2 rounded-lg",
        "hover:bg-muted/30 transition-colors group",
        isDragging && "opacity-60 bg-muted/40 shadow-lg"
      )}
    >
      {/* Drag Handle */}
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 rounded hover:bg-muted/50"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
        </button>
      )}
      {disabled && (
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />
      )}

      <span className="text-base w-7 text-center shrink-0">
        {COURSE_ICONS[course.courseType as CourseType] || '🍽️'}
      </span>
      <span className="text-sm text-muted-foreground w-20 shrink-0 truncate">
        {course.courseLabel}
      </span>

      {/* Menge (nur bei per_event) */}
      {pricingMode === 'per_event' && (
        <div className="relative w-16 shrink-0">
          <Input
            type="number"
            min={1}
            step={1}
            value={course.quantity ?? 1}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) onUpdateQuantity(idx, v);
            }}
            disabled={disabled}
            className="h-8 rounded-lg pr-5 text-right text-sm tabular-nums"
            title="Menge"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">×</span>
        </div>
      )}

      {/* DishPicker + Inline Name Edit */}
      <div className="flex-1 min-w-0">
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
            className="h-8 text-sm"
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
                className="shrink-0 p-1 rounded-md hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
                title="Bezeichnung bearbeiten"
              >
                <Pencil className="h-3 w-3 text-muted-foreground/50" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Einzelpreis (immer sichtbar) */}
      <div className="relative w-24 shrink-0">
        <Input
          type="number"
          step={0.01}
          min={0}
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
            "h-8 rounded-lg pr-6 text-right text-sm tabular-nums",
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
        <span className="text-sm font-medium tabular-nums w-24 text-right shrink-0">
          {lineTotal != null ? fmtEUR(lineTotal) : ''}
        </span>
      )}

      {/* Gang entfernen — immer sichtbar */}
      {!disabled && (
        <button
          onClick={() => onRemoveCourse(idx)}
          className="shrink-0 p-1 rounded-md hover:bg-destructive/10 transition-colors"
          title="Gang entfernen"
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
}: InlineCourseEditorProps) {
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
            onUpdateQuantity={(index, quantity) => onUpdateCourse(index, { quantity })}
            onUpdatePrice={(index, overridePrice) => onUpdateCourse(index, { overridePrice })}
            pricingMode={pricingMode}
              onRemoveCourse={onRemoveCourse}
              disabled={disabled}
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
    </div>
  );
}
