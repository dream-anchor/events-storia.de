import { Check, Circle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CourseConfig, CourseSelection, COURSE_ICONS } from "./types";

interface CourseProgressProps {
  courseConfigs: CourseConfig[];
  courseSelections: CourseSelection[];
  activeCourseIndex: number;
  onCourseClick: (index: number) => void;
}

export const CourseProgress = ({
  courseConfigs,
  courseSelections,
  activeCourseIndex,
  onCourseClick,
}: CourseProgressProps) => {
  const getSelectionsForCourse = (courseType: string) =>
    courseSelections.filter(s => s.courseType === courseType);

  const getCourseStatus = (courseType: string): 'completed' | 'active' | 'pending' => {
    const selections = getSelectionsForCourse(courseType);
    if (selections.some(s => s.itemId || s.isCustom)) {
      return 'completed';
    }
    const configIndex = courseConfigs.findIndex(c => c.course_type === courseType);
    if (configIndex === activeCourseIndex) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 rounded-2xl mb-6">
      {courseConfigs.map((config, index) => {
        const status = getCourseStatus(config.course_type);
        const icon = COURSE_ICONS[config.course_type] || '🍽️';
        const count = getSelectionsForCourse(config.course_type).length;

        return (
          <div key={config.id} className="flex items-center">
            <button
              onClick={() => onCourseClick(index)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-2xl transition-all min-h-[48px]",
                "hover:bg-background/80 active:scale-[0.98]",
                status === 'completed' && "bg-primary/10 text-primary",
                status === 'active' && "bg-primary text-primary-foreground shadow-sm",
                status === 'pending' && "bg-muted text-muted-foreground"
              )}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-medium hidden md:inline">
                {config.course_label}
              </span>
              {status === 'completed' && count > 1 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center">
                  {count}
                </Badge>
              )}
              {status === 'completed' && count <= 1 && (
                <Check className="h-4 w-4" />
              )}
              {status === 'active' && (
                <Circle className="h-4 w-4 fill-current" />
              )}
              {status === 'pending' && config.is_required && (
                <AlertCircle className="h-3.5 w-3.5 opacity-50" />
              )}
            </button>
            
            {/* Connector line */}
            {index < courseConfigs.length - 1 && (
              <div 
                className={cn(
                  "w-4 h-0.5 mx-1",
                  getCourseStatus(courseConfigs[index + 1].course_type) !== 'pending' ||
                  status === 'completed'
                    ? "bg-primary/50"
                    : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
