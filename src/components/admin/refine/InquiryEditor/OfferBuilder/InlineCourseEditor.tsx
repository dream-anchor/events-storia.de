import { useState } from "react";
import { Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  disabled?: boolean;
}

export function InlineCourseEditor({
  courses,
  courseConfigs,
  menuItems,
  onUpdateCourse,
  onAddCourse,
  onRemoveCourse,
  disabled = false,
}: InlineCourseEditorProps) {
  const handleDishSelect = (
    index: number,
    dish: { id: string; name: string; description: string | null; source: string; price: number | null }
  ) => {
    // Voller Katalogpreis als Default (Rabatt wird am Ende ausgewiesen)
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

  // Finde passende CourseConfig für erlaubte Kategorien
  const getFilterCategories = (courseType: string): string[] => {
    const config = courseConfigs.find(c => c.course_type === courseType);
    return config?.allowed_categories || [];
  };

  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-1">
      {courses.map((course, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center gap-3 py-2 px-2 rounded-lg",
            "hover:bg-muted/30 transition-colors group"
          )}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0" />
          <span className="text-base w-7 text-center shrink-0">
            {COURSE_ICONS[course.courseType as CourseType] || '🍽️'}
          </span>
          <span className="text-sm text-muted-foreground w-24 shrink-0 truncate">
            {course.courseLabel}
          </span>
          <div className="flex-1">
            <DishPicker
              value={course.itemId ? { id: course.itemId, name: course.itemName } : null}
              onSelect={(dish) => handleDishSelect(idx, dish)}
              onClear={() => handleClear(idx)}
              menuItems={menuItems}
              filterCategories={getFilterCategories(course.courseType)}
              placeholder={`${course.courseLabel} wählen...`}
              disabled={disabled}
            />
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveCourse(idx)}
              className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <span className="text-muted-foreground text-xs">×</span>
            </Button>
          )}
        </div>
      ))}

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
