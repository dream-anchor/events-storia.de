import { useState, useCallback } from "react";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface InlineCourseEditorProps {
  courses: CourseSelection[];
  courseConfigs: CourseConfig[];
  menuItems: CombinedMenuItem[];
  onUpdateCourse: (index: number, update: Partial<CourseSelection>) => void;
  onAddCourse: (courseType: CourseType, courseLabel: string) => void;
  onRemoveCourse: (index: number) => void;
  onReorderCourses?: (courses: CourseSelection[]) => void;
  disabled?: boolean;
}

// --- Sortierbare Zeile ---
function SortableCourseRow({
  course,
  idx,
  menuItems,
  courseConfigs,
  onDishSelect,
  onClear,
  disabled,
}: {
  course: CourseSelection;
  idx: number;
  menuItems: CombinedMenuItem[];
  courseConfigs: CourseConfig[];
  onDishSelect: (index: number, dish: { id: string; name: string; description: string | null; source: string; price: number | null }) => void;
  onClear: (index: number) => void;
  disabled: boolean;
}) {
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

      {/* DishPicker */}
      <div className="flex-1 min-w-0">
        <DishPicker
          value={course.itemId ? { id: course.itemId, name: course.itemName } : null}
          onSelect={(dish) => onDishSelect(idx, dish)}
          menuItems={menuItems}
          filterCategories={getFilterCategories(course.courseType)}
          placeholder={`${course.courseLabel} wählen...`}
          disabled={disabled}
        />
      </div>

      {/* Mülleimer direkt nach dem Dropdown */}
      {!disabled && course.itemId && (
        <button
          onClick={() => onClear(idx)}
          className="shrink-0 p-1 rounded-md hover:bg-muted/50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
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
